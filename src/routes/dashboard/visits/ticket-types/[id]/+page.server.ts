import { error } from '@sveltejs/kit';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { db } from '#lib/server/db/index.ts';
import { audience, event, taxRate, ticket, ticketPrice, ticketType } from '#lib/server/db/schema.ts';
import { enOf, packLocalized, unpackLocalized } from '#lib/server/localized.ts';
import { stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { eventOptions, taxRateOptions } from '#lib/server/options.ts';
import {
	audienceColumns,
	hasValidTickets,
	priceGridSchema,
	savePriceGrid,
	ticketTypeCodeTaken
} from '#lib/server/visits.ts';
import { ticketTypeEditSchema } from '#lib/schemas/visits.ts';

async function loadType(raw: string) {
	const id = idParam(raw, 'Ticket type');
	const [row] = await db
		.select({ type: ticketType, event: enOf(event.title), taxRate: enOf(taxRate.name) })
		.from(ticketType)
		.leftJoin(event, eq(ticketType.eventId, event.id))
		.leftJoin(taxRate, eq(ticketType.taxRateId, taxRate.id))
		.where(and(eq(ticketType.id, id), isNull(ticketType.deletedAt)));
	if (!row) error(404, 'Ticket type not found');
	return row;
}

export const load = async ({ params, locals }) => {
	const row = await loadType(params.id);
	const t = row.type;
	const [audiences, prices, byStatus, recent, stamps, taxRates, events] = await Promise.all([
		audienceColumns(),
		db.select().from(ticketPrice).where(eq(ticketPrice.ticketTypeId, t.id)),
		db
			.select({ status: ticket.status, tickets: count() })
			.from(ticket)
			.where(eq(ticket.ticketTypeId, t.id))
			.groupBy(ticket.status),
		db
			.select({
				id: ticket.id,
				code: ticket.code,
				visitDate: ticket.visitDate,
				holderName: ticket.holderName,
				audience: enOf(audience.name),
				admits: ticket.admits,
				status: ticket.status
			})
			.from(ticket)
			.innerJoin(audience, eq(ticket.audienceId, audience.id))
			.where(eq(ticket.ticketTypeId, t.id))
			.orderBy(desc(ticket.visitDate), desc(ticket.id))
			.limit(50),
		stampsOf(t),
		taxRateOptions(),
		eventOptions()
	]);
	const grid = audiences.map((a) => {
		const p = prices.find((x) => x.audienceId === a.id);
		return { ...a, price: p ? Number(p.price) : null };
	});
	const gridSchema = priceGridSchema(audiences.map((a) => a.id));
	return {
		type: t,
		event: row.event,
		taxRate: row.taxRate,
		grid,
		byStatus,
		recent,
		stamps,
		taxRates,
		events,
		canManage: hasPermission(locals, 'visits.manage'),
		editForm: await superValidate(
			unpackLocalized(t, ['name', 'description', 'requiresProof']),
			zod4(ticketTypeEditSchema),
			{ errors: false }
		),
		priceForm: await superValidate(
			Object.fromEntries(grid.map((g) => [`p${g.id}`, g.price])),
			zod4(gridSchema),
			{ errors: false, id: 'prices' }
		)
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'visits.manage');
		const form = await superValidate(event.request, zod4(ticketTypeEditSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		// The type named by the URL, never the form's hidden id.
		const { type: before } = await loadType(event.params.id);
		const id = before.id;
		const values: Partial<typeof form.data> = { ...form.data };
		delete values.id;
		if (await ticketTypeCodeTaken(form.data.code, form.data.eventId, id)) {
			setError(form, 'code', 'That code is already used');
			return message(form, { type: 'error', text: 'That code is already used' }, { status: 400 });
		}
		// Sold tickets moved the slot counters by the flag they were sold under; cancel and
		// reschedule read it again, so it is fixed while any of them is still valid.
		if (values.countsTowardCapacity !== before.countsTowardCapacity && (await hasValidTickets(id))) {
			const text = 'Valid tickets of this type are out: make a new type instead of changing whether it counts toward capacity';
			setError(form, 'countsTowardCapacity', text);
			return message(form, { type: 'error', text }, { status: 400 });
		}
		const row = packLocalized({ ...values }, ['name', 'description', 'requiresProof']);
		try {
			await db.transaction(async (tx) => {
				await tx
					.update(ticketType)
					.set({ ...(row as Partial<typeof ticketType.$inferInsert>), updatedBy: event.locals.user?.id })
					.where(eq(ticketType.id, id));
				await recordAudit(tx, event, { table: 'ticket_type', recordId: id, action: 'update', before, after: row });
			});
		} catch (err) {
			if (isDuplicateKey(err)) return message(form, { type: 'error', text: 'That code is already used' }, { status: 400 });
			throw err;
		}
		return message(form, { type: 'success', text: 'Ticket type saved' });
	},
	/** The price grid: one price per audience; an emptied one stops selling to that audience. */
	prices: async (event) => {
		requirePermission(event.locals, 'visits.manage');
		const { type: t } = await loadType(event.params.id);
		const audiences = await audienceColumns();
		const form = await superValidate(event.request, zod4(priceGridSchema(audiences.map((a) => a.id))), {
			id: 'prices'
		});
		if (!form.valid) return message(form, { type: 'error', text: 'Check the prices' }, { status: 400 });
		await savePriceGrid(event, t.id, form.data as Record<string, number | null>);
		return message(form, { type: 'success', text: 'Prices saved' });
	},
	delete: async (event) => {
		requirePermission(event.locals, 'visits.manage');
		const { type: t } = await loadType(event.params.id);
		const [{ sold }] = await db.select({ sold: count() }).from(ticket).where(eq(ticket.ticketTypeId, t.id));
		if (sold) {
			return { message: { type: 'error', text: `${sold} tickets were issued of this type: take it off sale instead.` } };
		}
		await db.transaction(async (tx) => {
			await tx.update(ticketType).set(deletionStamp(event.locals.user?.id)).where(eq(ticketType.id, t.id));
			await recordAudit(tx, event, { table: 'ticket_type', recordId: t.id, action: 'delete' });
		});
		redirect('/dashboard/visits/ticket-types', { type: 'success', message: 'Ticket type deleted' }, event.cookies);
	}
};
