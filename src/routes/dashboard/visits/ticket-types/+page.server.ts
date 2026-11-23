import { asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { db } from '#lib/server/db/index.ts';
import { audience, event, ticket, ticketPrice, ticketType } from '#lib/server/db/schema.ts';
import { enOf, packLocalized } from '#lib/server/localized.ts';
import { eventOptions, taxRateOptions } from '#lib/server/options.ts';
import { LIVE_STATUSES, ticketTypeCodeTaken } from '#lib/server/visits.ts';
import { ticketTypeSchema } from '#lib/schemas/visits.ts';

/** Every ticket type: museum entry first, then each event's own. A short list, filtered in the browser. */
export const load = async ({ locals }) => {
	const [rows, prices, sold, taxRates, events] = await Promise.all([
		db
			.select({
				id: ticketType.id,
				code: ticketType.code,
				name: enOf(ticketType.name),
				eventId: ticketType.eventId,
				event: enOf(event.title),
				admitsPerTicket: ticketType.admitsPerTicket,
				minQuantity: ticketType.minQuantity,
				isStaffOnly: ticketType.isStaffOnly,
				isMemberOnly: ticketType.isMemberOnly,
				countsTowardCapacity: ticketType.countsTowardCapacity,
				isActive: ticketType.isActive
			})
			.from(ticketType)
			.leftJoin(event, eq(ticketType.eventId, event.id))
			.where(isNull(ticketType.deletedAt))
			.orderBy(asc(ticketType.eventId), asc(ticketType.sortOrder)),
		db
			.select({ ticketTypeId: ticketPrice.ticketTypeId, audience: audience.code, price: ticketPrice.price })
			.from(ticketPrice)
			.innerJoin(audience, eq(ticketPrice.audienceId, audience.id))
			.orderBy(asc(audience.sortOrder)),
		db
			.select({ ticketTypeId: ticket.ticketTypeId, tickets: count() })
			.from(ticket)
			.where(inArray(ticket.status, [...LIVE_STATUSES]))
			.groupBy(ticket.ticketTypeId),
		taxRateOptions(),
		eventOptions()
	]);
	return {
		rows: rows.map((r) => ({
			...r,
			kind: r.eventId ? 'Event' : 'Entry',
			prices: prices
				.filter((p) => p.ticketTypeId === r.id)
				.map((p) => `${p.audience} ${Number(p.price).toLocaleString('en-US')}`)
				.join(' · '),
			sold: sold.find((s) => s.ticketTypeId === r.id)?.tickets ?? 0
		})),
		taxRates,
		events,
		canManage: hasPermission(locals, 'visits.manage'),
		addForm: await superValidate(zod4(ticketTypeSchema))
	};
};

export const actions = {
	add: async (event) => {
		requirePermission(event.locals, 'visits.manage');
		const form = await superValidate(event.request, zod4(ticketTypeSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		if (await ticketTypeCodeTaken(form.data.code, form.data.eventId)) {
			return message(form, { type: 'error', text: 'That code is already used' }, { status: 400 });
		}
		let id: number;
		try {
			id = await db.transaction(async (tx) => {
				const values = packLocalized({ ...form.data }, ['name', 'description', 'requiresProof']);
				const [res] = await tx
					.insert(ticketType)
					.values({ ...(values as unknown as typeof ticketType.$inferInsert), createdBy: event.locals.user?.id });
				await recordAudit(tx, event, { table: 'ticket_type', recordId: res.insertId, action: 'create' });
				return res.insertId;
			});
		} catch (err) {
			if (isDuplicateKey(err)) {
				return message(form, { type: 'error', text: 'That code is already used' }, { status: 400 });
			}
			throw err;
		}
		redirect(
			`/dashboard/visits/ticket-types/${id}`,
			{ type: 'success', message: 'Ticket type added — now set its prices' },
			event.cookies
		);
	}
};

