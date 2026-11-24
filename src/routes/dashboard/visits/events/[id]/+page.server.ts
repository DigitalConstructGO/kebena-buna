import { error } from '@sveltejs/kit';
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { db } from '#lib/server/db/index.ts';
import {
	audience,
	customer,
	event,
	location,
	staffAssignment,
	ticket,
	ticketPrice,
	ticketType
} from '#lib/server/db/schema.ts';
import { enOf, packLocalized } from '#lib/server/localized.ts';
import { stampsOf, staffOptions, userAlias } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { taxRateOptions } from '#lib/server/options.ts';
import { assignStaffAt } from '#lib/server/bookings.ts';
import { ticketTypeCodeTaken } from '#lib/server/visits.ts';
import { assignmentSchema, ticketTypeSchema } from '#lib/schemas/visits.ts';
import { cancelSchema } from '#lib/schemas/orders.ts';
import { cancelEvent } from '#lib/server/events.ts';

async function loadEvent(raw: string) {
	const [row] = await db
		.select({ event, location: enOf(location.name) })
		.from(event)
		.innerJoin(location, eq(event.locationId, location.id))
		.where(and(eq(event.id, idParam(raw, 'Event')), isNull(event.deletedAt)));
	if (!row) error(404, 'Event not found');
	return row;
}

const staff = userAlias('staff');
const assigner = userAlias('assigner');

export const load = async ({ params, locals }) => {
	const { event: e, location: place } = await loadEvent(params.id);
	const [types, prices, sold, registrations, assignments, stamps, staffList, taxRates] =
		await Promise.all([
			db
				.select({
					id: ticketType.id,
					code: ticketType.code,
					name: enOf(ticketType.name),
					isActive: ticketType.isActive,
					isMemberOnly: ticketType.isMemberOnly
				})
				.from(ticketType)
				.where(and(eq(ticketType.eventId, e.id), isNull(ticketType.deletedAt)))
				.orderBy(asc(ticketType.sortOrder)),
			db
				.select({
					ticketTypeId: ticketPrice.ticketTypeId,
					audience: audience.code,
					price: ticketPrice.price
				})
				.from(ticketPrice)
				.innerJoin(ticketType, eq(ticketPrice.ticketTypeId, ticketType.id))
				.innerJoin(audience, eq(ticketPrice.audienceId, audience.id))
				.where(eq(ticketType.eventId, e.id)),
			db
				.select({ ticketTypeId: ticket.ticketTypeId, tickets: count() })
				.from(ticket)
				.where(eq(ticket.eventId, e.id))
				.groupBy(ticket.ticketTypeId),
			db
				.select({
					id: ticket.id,
					code: ticket.code,
					typeId: ticket.ticketTypeId,
					type: enOf(ticketType.name),
					audience: enOf(audience.name),
					customerId: ticket.customerId,
					customer: customer.name,
					holderName: ticket.holderName,
					orderId: ticket.orderId,
					status: ticket.status,
					issuedAt: ticket.issuedAt
				})
				.from(ticket)
				.innerJoin(ticketType, eq(ticket.ticketTypeId, ticketType.id))
				.innerJoin(audience, eq(ticket.audienceId, audience.id))
				.leftJoin(customer, eq(ticket.customerId, customer.id))
				.where(eq(ticket.eventId, e.id))
				.orderBy(desc(ticket.issuedAt)),
			db
				.select({
					id: staffAssignment.id,
					userId: staffAssignment.userId,
					name: staff.name,
					role: staffAssignment.role,
					startsAt: staffAssignment.startsAt,
					endsAt: staffAssignment.endsAt,
					byId: staffAssignment.assignedBy,
					by: assigner.name
				})
				.from(staffAssignment)
				.innerJoin(staff, eq(staffAssignment.userId, staff.id))
				.leftJoin(assigner, eq(staffAssignment.assignedBy, assigner.id))
				.where(eq(staffAssignment.eventId, e.id)),
			stampsOf(e),
			staffOptions(),
			taxRateOptions()
		]);
	return {
		event: e,
		location: place,
		types: types.map((t) => ({
			...t,
			prices: prices
				.filter((p) => p.ticketTypeId === t.id)
				.map((p) => `${p.audience} ${Number(p.price).toLocaleString('en-US')}`)
				.join(' · '),
			sold: sold.find((s) => s.ticketTypeId === t.id)?.tickets ?? 0
		})),
		registrations,
		assignments,
		stamps,
		staff: staffList,
		taxRates,
		canManage: hasPermission(locals, 'events.manage'),
		canCancel:
			hasPermission(locals, 'events.manage') &&
			hasPermission(locals, 'refunds.manage') &&
			e.isActive &&
			e.endsAt > new Date(),
		cancelForm: await superValidate(zod4(cancelSchema), { id: 'cancel' }),
		typeForm: await superValidate({ eventId: e.id }, zod4(ticketTypeSchema), {
			errors: false,
			id: 'type'
		}),
		assignForm: await superValidate(zod4(assignmentSchema), { id: 'assign' })
	};
};

export const actions = {
	/** Draft ↔ published. */
	publish: async (req) => {
		requirePermission(req.locals, 'events.manage');
		const { event: e } = await loadEvent(req.params.id);
		const to = e.publishStatus === 'published' ? 'draft' : 'published';
		await db.transaction(async (tx) => {
			await tx
				.update(event)
				.set({ publishStatus: to, updatedBy: req.locals.user?.id })
				.where(eq(event.id, e.id));
			await recordAudit(tx, req, {
				table: 'event',
				recordId: e.id,
				action: 'update',
				before: e,
				after: { publishStatus: to }
			});
		});
		return {
			message: { type: 'success', text: to === 'published' ? 'Published' : 'Taken off the website' }
		};
	},
	/** One of the event's own ticket types; its prices are set on the type's page. */
	addType: async (req) => {
		requirePermission(req.locals, 'events.manage');
		const { event: e } = await loadEvent(req.params.id);
		const form = await superValidate(req.request, zod4(ticketTypeSchema), { id: 'type' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		if (await ticketTypeCodeTaken(form.data.code, e.id)) {
			return message(
				form,
				{ type: 'error', text: 'The event has a type with that code' },
				{ status: 400 }
			);
		}
		try {
			await db.transaction(async (tx) => {
				const values = packLocalized({ ...form.data, eventId: e.id }, [
					'name',
					'description',
					'requiresProof'
				]);
				const [res] = await tx.insert(ticketType).values({
					...(values as unknown as typeof ticketType.$inferInsert),
					createdBy: req.locals.user?.id
				});
				await recordAudit(tx, req, {
					table: 'ticket_type',
					recordId: res.insertId,
					action: 'create'
				});
			});
		} catch (err) {
			if (isDuplicateKey(err))
				return message(
					form,
					{ type: 'error', text: 'The event has a type with that code' },
					{ status: 400 }
				);
			throw err;
		}
		return message(form, {
			type: 'success',
			text: 'Ticket type added — set its prices on its page'
		});
	},
	assign: async (req) => {
		requirePermission(req.locals, 'events.manage');
		const { event: e } = await loadEvent(req.params.id);
		const form = await superValidate(req.request, zod4(assignmentSchema), { id: 'assign' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		// Through the shared helper, so a clash with another session, booking or event is named.
		const result = await assignStaffAt(
			{
				userId: form.data.userId,
				role: form.data.role,
				startsAt: e.startsAt,
				endsAt: e.endsAt,
				eventId: e.id
			},
			req.locals.user?.id
		);
		if (!result.ok) return message(form, { type: 'error', text: result.text }, { status: 400 });
		return message(form, { type: 'success', text: result.text });
	},
	unassign: async (req) => {
		requirePermission(req.locals, 'events.manage');
		const { event: e } = await loadEvent(req.params.id);
		const id = Number((await req.request.formData()).get('id'));
		await db
			.delete(staffAssignment)
			.where(and(eq(staffAssignment.id, id), eq(staffAssignment.eventId, e.id)));
		return { message: { type: 'success', text: 'Removed from the event' } };
	},
	/** Called off: tickets cancelled, paid orders sent for refund, buyers told (`cancelEvent`). */
	cancel: async (req) => {
		requirePermission(req.locals, 'events.manage');
		requirePermission(req.locals, 'refunds.manage');
		const form = await superValidate(req.request, zod4(cancelSchema), { id: 'cancel' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { event: e } = await loadEvent(req.params.id);
		const done = await cancelEvent(req, e.id, form.data.reason);
		return message(form, {
			type: 'success',
			text: `Cancelled: ${done.tickets} tickets voided, ${done.refunds} refunds to approve, ${done.orders} buyers told`
		});
	},
	delete: async (req) => {
		requirePermission(req.locals, 'events.manage');
		const { event: e } = await loadEvent(req.params.id);
		const [{ tickets }] = await db
			.select({ tickets: count() })
			.from(ticket)
			.where(eq(ticket.eventId, e.id));
		if (tickets)
			return {
				message: {
					type: 'error',
					text: `${tickets} tickets were issued: take it off the website instead.`
				}
			};
		await db.transaction(async (tx) => {
			await tx.update(event).set(deletionStamp(req.locals.user?.id)).where(eq(event.id, e.id));
			await recordAudit(tx, req, { table: 'event', recordId: e.id, action: 'delete' });
		});
		redirect(
			'/dashboard/visits/events',
			{ type: 'success', message: 'Event deleted' },
			req.cookies
		);
	}
};
