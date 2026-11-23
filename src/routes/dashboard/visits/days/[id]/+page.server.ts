import { error } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import {
	audience,
	customer,
	location,
	ticket,
	ticketType,
	visitDay,
	visitSlot
} from '#lib/server/db/schema.ts';
import { enOf, packLocalized, unpackLocalized } from '#lib/server/localized.ts';
import { stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { dayEditSchema, slotEditSchema } from '#lib/schemas/visits.ts';

async function loadDay(raw: string) {
	const id = idParam(raw, 'Visit day');
	const [row] = await db
		.select({ day: visitDay, location: enOf(location.name) })
		.from(visitDay)
		.innerJoin(location, eq(visitDay.locationId, location.id))
		.where(eq(visitDay.id, id));
	if (!row) error(404, 'Visit day not found');
	return row;
}

export const load = async ({ params, locals }) => {
	const { day, location: place } = await loadDay(params.id);
	const [slots, tickets, stamps] = await Promise.all([
		db
			.select({
				id: visitSlot.id,
				startsAt: visitSlot.startsAt,
				endsAt: visitSlot.endsAt,
				capacity: visitSlot.capacity,
				sold: visitSlot.sold,
				held: visitSlot.held,
				isClosed: visitSlot.isClosed,
				checkedIn:
					sql<number>`(select coalesce(sum(t.checked_in), 0) from ticket t where t.visit_slot_id = visit_slot.id)`.mapWith(
						Number
					)
			})
			.from(visitSlot)
			.where(eq(visitSlot.visitDayId, day.id))
			.orderBy(asc(visitSlot.startsAt)),
		db
			.select({
				id: ticket.id,
				code: ticket.code,
				slotId: ticket.visitSlotId,
				slotStart: visitSlot.startsAt,
				typeId: ticket.ticketTypeId,
				type: enOf(ticketType.name),
				audience: enOf(audience.name),
				customerId: ticket.customerId,
				customer: customer.name,
				holderName: ticket.holderName,
				admits: ticket.admits,
				checkedIn: ticket.checkedIn,
				status: ticket.status
			})
			.from(ticket)
			.innerJoin(visitSlot, eq(ticket.visitSlotId, visitSlot.id))
			.innerJoin(ticketType, eq(ticket.ticketTypeId, ticketType.id))
			.innerJoin(audience, eq(ticket.audienceId, audience.id))
			.leftJoin(customer, eq(ticket.customerId, customer.id))
			.where(eq(visitSlot.visitDayId, day.id))
			.orderBy(asc(visitSlot.startsAt), asc(ticket.id)),
		stampsOf(day)
	]);
	return {
		day,
		location: place,
		slots,
		tickets,
		stamps,
		canManage: hasPermission(locals, 'visits.manage'),
		dayForm: await superValidate(unpackLocalized(day, ['closedReason']), zod4(dayEditSchema), {
			errors: false
		}),
		slotForm: await superValidate(zod4(slotEditSchema), { id: 'slot' })
	};
};

export const actions = {
	day: async (event) => {
		requirePermission(event.locals, 'visits.manage');
		const form = await superValidate(event.request, zod4(dayEditSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { id, ...values } = form.data;
		const { day: before } = await loadDay(String(id));
		if (values.capacity < before.sold + before.held) {
			return message(
				form,
				{ type: 'error', text: `${before.sold + before.held} places are already sold or held` },
				{ status: 400 }
			);
		}
		const row = packLocalized({ ...values }, ['closedReason']);
		await db.transaction(async (tx) => {
			await tx
				.update(visitDay)
				.set({ ...row, updatedBy: event.locals.user?.id })
				.where(eq(visitDay.id, id));
			// Closing the day closes its slots: nothing more is sold for it.
			if (values.isClosed && !before.isClosed) {
				await tx.update(visitSlot).set({ isClosed: true }).where(eq(visitSlot.visitDayId, id));
			}
			await recordAudit(tx, event, {
				table: 'visit_day',
				recordId: id,
				action: 'update',
				before,
				after: row
			});
		});
		return message(form, { type: 'success', text: 'Day saved' });
	},
	slot: async (event) => {
		requirePermission(event.locals, 'visits.manage');
		const { day } = await loadDay(event.params.id);
		const form = await superValidate(event.request, zod4(slotEditSchema), { id: 'slot' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const [slot] = await db
			.select()
			.from(visitSlot)
			.where(and(eq(visitSlot.id, form.data.slotId), eq(visitSlot.visitDayId, day.id)));
		if (!slot) return message(form, { type: 'error', text: 'Slot not found' }, { status: 404 });
		if (form.data.capacity < slot.sold + slot.held) {
			return message(
				form,
				{ type: 'error', text: `${slot.sold + slot.held} places are already sold or held` },
				{ status: 400 }
			);
		}
		const after = { capacity: form.data.capacity, isClosed: form.data.isClosed };
		await db.transaction(async (tx) => {
			await tx.update(visitSlot).set(after).where(eq(visitSlot.id, slot.id));
			await recordAudit(tx, event, {
				table: 'visit_slot',
				recordId: slot.id,
				action: 'update',
				before: slot,
				after
			});
		});
		return message(form, { type: 'success', text: 'Slot saved' });
	}
};
