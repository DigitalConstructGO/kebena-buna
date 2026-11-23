import { randomUUID } from 'node:crypto';
import { fail } from '@sveltejs/kit';
import { and, asc, between, eq, gt, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { addLocalDays, localClock, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { visitDay, visitSlot } from '#lib/server/db/schema.ts';
import { floodRefused, isTrapped, paymentsOn } from '#lib/server/site.ts';
import { activeAudiences, afterOrder, OrderRefused, placeTicketOrder, ticketTypesFor } from '#lib/server/ticketOrders.ts';
import { ticketOrderSchema } from '#lib/schemas/siteVisit.ts';
import { errorPath } from '#lib/site/visit/errorPath.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

/** Groups of 10 and more book through the request form (6.6), not this checkout. */
const GROUP_SIZE = 10;
const DAYS_AHEAD = 30;

const slotFree = sql<number>`greatest(${visitSlot.capacity} - ${visitSlot.sold} - ${visitSlot.held}, 0)`.mapWith(Number);
const dayFree = sql<number>`greatest(${visitDay.capacity} - ${visitDay.sold} - ${visitDay.held}, 0)`.mapWith(Number);

/** Open days with an arrival slot still to come, and how many places each has left. */
async function openDays() {
	const today = localToday();
	const rows = await db
		.select({
			date: visitDay.date,
			free: sql<number>`sum(greatest(${visitSlot.capacity} - ${visitSlot.sold} - ${visitSlot.held}, 0))`.mapWith(Number),
			dayFree: sql<number>`min(greatest(${visitDay.capacity} - ${visitDay.sold} - ${visitDay.held}, 0))`.mapWith(Number)
		})
		.from(visitDay)
		.innerJoin(visitSlot, eq(visitSlot.visitDayId, visitDay.id))
		.where(
			and(
				between(visitDay.date, today, addLocalDays(today, DAYS_AHEAD)),
				eq(visitDay.isClosed, false),
				eq(visitDay.isActive, true),
				isNull(visitDay.deletedAt),
				eq(visitSlot.isClosed, false),
				gt(visitSlot.endsAt, new Date())
			)
		)
		.groupBy(visitDay.date)
		.orderBy(asc(visitDay.date));
	return rows.map((r) => ({ date: r.date, free: Math.min(r.free, r.dayFree) }));
}

/** A day's arrival slots, each with what is left (never more than the day itself has left). */
async function slotsOn(date: string) {
	const rows = await db
		.select({ id: visitSlot.id, startsAt: visitSlot.startsAt, free: slotFree, dayFree })
		.from(visitSlot)
		.innerJoin(visitDay, eq(visitSlot.visitDayId, visitDay.id))
		.where(
			and(
				eq(visitDay.date, date),
				eq(visitDay.isClosed, false),
				eq(visitDay.isActive, true),
				isNull(visitDay.deletedAt),
				eq(visitSlot.isClosed, false),
				gt(visitSlot.endsAt, new Date())
			)
		)
		.orderBy(asc(visitSlot.startsAt));
	return rows.map((r) => ({ id: r.id, label: localClock(r.startsAt), remaining: Math.min(r.free, r.dayFree) }));
}

export const load: PageServerLoad = async ({ url }) => {
	const audiences = await activeAudiences();
	const audience =
		audiences.find((a) => a.code === url.searchParams.get('audience')) ?? audiences.find((a) => a.isDefault) ?? audiences[0];
	const days = await openDays();
	const asked = days.find((d) => d.date === url.searchParams.get('date') && d.free > 0);
	const date = asked?.date ?? days.find((d) => d.free > 0)?.date ?? null;

	const [slots, types] = await Promise.all([
		date ? slotsOn(date) : [],
		audience ? ticketTypesFor(audience.id, null) : []
	]);
	const onSale = types.filter((t) => t.minQuantity < GROUP_SIZE).map((t) => ({ ...t, price: Number(t.price) }));

	const form = await superValidate(
		{
			audienceId: audience?.id,
			items: onSale.map((t) => ({ ticketTypeId: t.id, quantity: 0 })),
			idempotencyKey: randomUUID()
		},
		zod4(ticketOrderSchema),
		{ errors: false }
	);

	return {
		form,
		audiences: audiences.map((a) => ({ code: a.code, name: a.name })),
		audience: audience ? { id: audience.id, code: audience.code, declaration: audience.requiresIdCheck ? audience.declaration : null } : null,
		days,
		date,
		slots,
		types: onSale,
		paymentsOn: paymentsOn()
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(ticketOrderSchema));
		if (!form.valid) return fail(400, { form });
		if (isTrapped(form.data)) return message(form, m.visit_sent());
		if (floodRefused(event, 'tickets', 4)) return message(form, m.site_err_flood(), { status: 429 });

		let placed;
		try {
			placed = await placeTicketOrder(event, form.data);
		} catch (err) {
			if (err instanceof OrderRefused) return setError(form, errorPath(err.field), err.message);
			throw err;
		}
		return afterOrder(event, placed);
	}
};
