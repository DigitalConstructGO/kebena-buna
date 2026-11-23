/**
 * The museum's capacity and tickets: the price grid, building days and slots from the weekly
 * pattern, and the desk's ticket actions (reschedule, cancel, check in).
 *
 * Capacity is a counter on the slot and its day (`sold`, `held`), changed under a row lock in the
 * same transaction as the ticket, so the website and the desk draw from one pool.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import type { RequestEvent } from '@sveltejs/kit';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { addLocalDays, fromLocal, localToday } from '@nahu/admin-kit/time';
import type { Writer } from '@nahu/admin-kit/server/db';
import {
	audience,
	calendarException,
	event as eventTable,
	openingHours,
	slotTemplate,
	ticket,
	ticketChange,
	ticketPrice,
	ticketScan,
	ticketType,
	visitDay,
	visitSlot
} from '#lib/server/db/schema.ts';
import { db } from '#lib/server/db/index.ts';
import { enOf } from '#lib/server/localized.ts';
import { optionalMoney } from '#lib/schemas/common.ts';

/** Statuses whose people count against capacity. */
export const LIVE_STATUSES = ['valid', 'used', 'expired'] as const;

/** The audiences a price can be set for, in order. */
export const audienceColumns = () =>
	db
		.select({ id: audience.id, code: audience.code, name: enOf(audience.name), colour: audience.colour })
		.from(audience)
		.where(isNull(audience.deletedAt))
		.orderBy(audience.sortOrder);

/** One field per audience (`p12`): a price, or empty for "not sold to them". */
export const priceGridSchema = (audienceIds: number[]) =>
	z.object(Object.fromEntries(audienceIds.map((id) => [`p${id}`, optionalMoney])));

/** Writes a type's price grid, audited: an emptied price stops selling to that audience. */
export async function savePriceGrid(
	event: RequestEvent,
	ticketTypeId: number,
	values: Record<string, number | null | undefined>
) {
	await db.transaction(async (tx) => {
		const current = await tx
			.select()
			.from(ticketPrice)
			.where(and(eq(ticketPrice.ticketTypeId, ticketTypeId), eq(ticketPrice.currency, 'ETB')));
		for (const [key, raw] of Object.entries(values)) {
			const audienceId = Number(key.slice(1));
			const price = raw ?? null;
			const row = current.find((p) => p.audienceId === audienceId);
			if (row && price === null) {
				await tx.delete(ticketPrice).where(eq(ticketPrice.id, row.id));
				await recordAudit(tx, event, { table: 'ticket_price', recordId: row.id, action: 'delete' });
			} else if (row && Number(row.price) !== price) {
				await tx.update(ticketPrice).set({ price: price! }).where(eq(ticketPrice.id, row.id));
				await recordAudit(tx, event, {
					table: 'ticket_price',
					recordId: row.id,
					action: 'update',
					before: { price: Number(row.price) },
					after: { price }
				});
			} else if (!row && price !== null) {
				const [res] = await tx.insert(ticketPrice).values({ ticketTypeId, audienceId, price });
				await recordAudit(tx, event, {
					table: 'ticket_price',
					recordId: res.insertId,
					action: 'create',
					detail: { ticketTypeId, audienceId, price }
				});
			}
		}
	});
}

/**
 * Whether another live ticket type already has this code: per event, or among entry types. The
 * unique index cannot catch the second, because MySQL lets any number of null `event_id`s through.
 */
export async function ticketTypeCodeTaken(code: string, eventId: number | null | undefined, exceptId?: number) {
	const [row] = await db
		.select({ id: ticketType.id })
		.from(ticketType)
		.where(
			and(
				eq(ticketType.code, code),
				sql`${ticketType.eventId} <=> ${eventId ?? null}`,
				isNull(ticketType.deletedAt),
				exceptId ? ne(ticketType.id, exceptId) : undefined
			)
		)
		.limit(1);
	return Boolean(row);
}

/**
 * Whether a type still has valid tickets. Their counters were moved by the type's capacity flag
 * at sale, and cancel and reschedule read the flag again, so it cannot change under them.
 */
export async function hasValidTickets(ticketTypeId: number) {
	const [row] = await db
		.select({ id: ticket.id })
		.from(ticket)
		.where(and(eq(ticket.ticketTypeId, ticketTypeId), eq(ticket.status, 'valid')))
		.limit(1);
	return Boolean(row);
}

/**
 * Builds visit days and their slots from the weekly pattern, from `from` for `count` days.
 * A weekday with no pattern, closed in `opening_hours`, or closed by a `calendar_exception` (for
 * the location or everywhere) gets no day. Days that already exist are left as they are: their
 * slots may have been edited and sold. Returns how many days were made.
 */
export async function generateDays(
	from: string,
	count: number,
	dayCapacity: number,
	userId: string | undefined
): Promise<{ days: number; slots: number }> {
	const templates = await db
		.select()
		.from(slotTemplate)
		.where(and(eq(slotTemplate.status, true), isNull(slotTemplate.deletedAt)));
	const dates = Array.from({ length: count }, (_, i) => addLocalDays(from, i));
	const [closures, hours, existing] = await Promise.all([
		db
			.select({ date: calendarException.date, locationId: calendarException.locationId })
			.from(calendarException)
			.where(
				and(
					inArray(calendarException.date, dates),
					eq(calendarException.isClosed, true),
					isNull(calendarException.deletedAt)
				)
			),
		db.select().from(openingHours),
		db
			.select({ date: visitDay.date, locationId: visitDay.locationId })
			.from(visitDay)
			.where(inArray(visitDay.date, dates))
	]);

	let days = 0;
	let slots = 0;
	await db.transaction(async (tx) => {
		for (const date of dates) {
			const js = new Date(`${date}T12:00:00Z`).getUTCDay();
			const weekday = js === 0 ? 7 : js;
			const byLocation = Map.groupBy(
				templates.filter((t) => t.weekday === weekday),
				(t) => t.locationId
			);
			for (const [locationId, pattern] of byLocation) {
				if (existing.some((d) => d.date === date && d.locationId === locationId)) continue;
				if (closures.some((c) => c.date === date && (c.locationId === null || c.locationId === locationId))) continue;
				if (hours.some((h) => h.locationId === locationId && h.weekday === weekday && h.isClosed)) continue;
				const [res] = await tx
					.insert(visitDay)
					.values({ locationId, date, capacity: dayCapacity, createdBy: userId });
				await tx.insert(visitSlot).values(
					pattern.map((t) => ({
						visitDayId: res.insertId,
						startsAt: fromLocal(date, t.startsAt.slice(0, 5)),
						endsAt: fromLocal(date, t.endsAt.slice(0, 5)),
						capacity: t.capacity
					}))
				);
				days++;
				slots += pattern.length;
			}
		}
	});
	return { days, slots };
}

/** The ticket, its type's capacity flag, locked for the change. */
async function lockTicket(tx: Writer, ticketId: number) {
	const [row] = await tx
		.select({ ticket, counts: ticketType.countsTowardCapacity })
		.from(ticket)
		.innerJoin(ticketType, eq(ticket.ticketTypeId, ticketType.id))
		.where(eq(ticket.id, ticketId))
		.for('update');
	if (!row) throw new WriteRefused(null, 'Ticket not found');
	return row;
}

type CounterOptions = {
	/** `sold` for tickets, `held` for unpaid group holds (6.6). */
	column?: 'sold' | 'held';
	/** The form field a refusal is reported under. */
	field?: string;
	/** False for a move inside one day: the day's total does not change, so it is neither checked nor moved. */
	day?: boolean;
};

/**
 * Adds `delta` people to a slot and its day, refusing to go over either capacity. Callers that
 * touch two slots lock them first with `lockSlots`, so opposite moves cannot deadlock.
 */
export async function moveCounters(
	tx: Writer,
	slotId: number,
	delta: number,
	{ column = 'sold', field = 'toSlotId', day: withDay = true }: CounterOptions = {}
) {
	const [slot] = await tx
		.select({ id: visitSlot.id, dayId: visitSlot.visitDayId, sold: visitSlot.sold, held: visitSlot.held, capacity: visitSlot.capacity, isClosed: visitSlot.isClosed })
		.from(visitSlot)
		.where(eq(visitSlot.id, slotId))
		.for('update');
	if (!slot) throw new WriteRefused(field, 'Slot not found');
	const [day] = await tx
		.select({ sold: visitDay.sold, held: visitDay.held, capacity: visitDay.capacity, isClosed: visitDay.isClosed })
		.from(visitDay)
		.where(eq(visitDay.id, slot.dayId))
		.for('update');
	if (delta > 0) {
		if (slot.isClosed || day.isClosed) throw new WriteRefused(field, 'That slot is closed');
		if (slot.sold + slot.held + delta > slot.capacity)
			throw new WriteRefused(field, `Only ${Math.max(slot.capacity - slot.sold - slot.held, 0)} places left in that slot`);
		if (withDay && day.sold + day.held + delta > day.capacity)
			throw new WriteRefused(field, `Only ${Math.max(day.capacity - day.sold - day.held, 0)} places left that day`);
	}
	const slotCol = visitSlot[column];
	await tx
		.update(visitSlot)
		.set({ [column]: sql`greatest(${slotCol} + ${delta}, 0)` })
		.where(eq(visitSlot.id, slotId));
	if (!withDay) return;
	const dayCol = visitDay[column];
	await tx
		.update(visitDay)
		.set({ [column]: sql`greatest(${dayCol} + ${delta}, 0)` })
		.where(eq(visitDay.id, slot.dayId));
}

/** Locks slots and then their days, each in id order: the one order every two-slot change takes. */
async function lockSlots(tx: Writer, slotIds: number[]) {
	const slots = await tx
		.select({ id: visitSlot.id, dayId: visitSlot.visitDayId })
		.from(visitSlot)
		.where(inArray(visitSlot.id, slotIds))
		.orderBy(visitSlot.id)
		.for('update');
	const dayIds = [...new Set(slots.map((s) => s.dayId))];
	if (dayIds.length) {
		await tx.select({ id: visitDay.id }).from(visitDay).where(inArray(visitDay.id, dayIds)).orderBy(visitDay.id).for('update');
	}
}

/**
 * Moves a valid ticket to another slot; its people move with it. The new slot must be at the same
 * location, open and not over. Within one day only the slots' counters move: the day's total stays.
 */
export async function rescheduleTicket(
	event: RequestEvent,
	ticketId: number,
	toSlotId: number,
	reason: string | null | undefined
) {
	await db.transaction(async (tx) => {
		const { ticket: t, counts } = await lockTicket(tx, ticketId);
		if (t.status !== 'valid') throw new WriteRefused(null, 'Only a valid, unused ticket can be moved');
		if (!t.visitSlotId) throw new WriteRefused(null, 'An event ticket has no slot to move');
		if (t.visitSlotId === toSlotId) throw new WriteRefused('toSlotId', 'That is the slot it already has');
		const fromSlotId = t.visitSlotId;
		await lockSlots(tx, [fromSlotId, toSlotId]);
		const slots = await tx
			.select({
				id: visitSlot.id,
				endsAt: visitSlot.endsAt,
				isClosed: visitSlot.isClosed,
				dayId: visitDay.id,
				date: visitDay.date,
				locationId: visitDay.locationId,
				dayClosed: visitDay.isClosed
			})
			.from(visitSlot)
			.innerJoin(visitDay, eq(visitSlot.visitDayId, visitDay.id))
			.where(inArray(visitSlot.id, [fromSlotId, toSlotId]));
		const from = slots.find((s) => s.id === fromSlotId);
		const target = slots.find((s) => s.id === toSlotId);
		if (!target) throw new WriteRefused('toSlotId', 'Slot not found');
		if (from && from.locationId !== target.locationId)
			throw new WriteRefused('toSlotId', 'That slot is at another location');
		if (target.endsAt <= new Date()) throw new WriteRefused('toSlotId', 'That slot is over');
		if (target.isClosed || target.dayClosed) throw new WriteRefused('toSlotId', 'That slot is closed');
		if (counts) {
			// Same day: free the old place first, and leave the day's total as it is.
			const sameDay = from?.dayId === target.dayId;
			if (sameDay) {
				await moveCounters(tx, fromSlotId, -t.admits, { day: false });
				await moveCounters(tx, toSlotId, t.admits, { day: false });
			} else {
				await moveCounters(tx, toSlotId, t.admits);
				await moveCounters(tx, fromSlotId, -t.admits);
			}
		}
		await tx.update(ticket).set({ visitSlotId: toSlotId, visitDate: target.date }).where(eq(ticket.id, ticketId));
		await tx.insert(ticketChange).values({
			ticketId,
			kind: 'reschedule',
			fromSlotId,
			toSlotId,
			amount: 0,
			reason: reason ?? null,
			changedBy: event.locals.user?.id
		});
	});
}

/** Cancels a ticket that has not been used; its places go back to the slot, or to the event. */
export async function cancelTicket(event: RequestEvent, ticketId: number, reason: string | null | undefined) {
	await db.transaction(async (tx) => {
		const { ticket: t, counts } = await lockTicket(tx, ticketId);
		if (t.status !== 'valid') throw new WriteRefused(null, `A ${t.status} ticket cannot be cancelled`);
		if (counts && t.visitSlotId) await moveCounters(tx, t.visitSlotId, -t.admits);
		if (t.eventId) {
			// The event's registrations are its own counter: give the party's places back.
			await tx.select({ id: eventTable.id }).from(eventTable).where(eq(eventTable.id, t.eventId)).for('update');
			await tx
				.update(eventTable)
				.set({ registered: sql`greatest(${eventTable.registered} - ${t.admits}, 0)` })
				.where(eq(eventTable.id, t.eventId));
		}
		await tx.update(ticket).set({ status: 'cancelled', cancelledAt: new Date() }).where(eq(ticket.id, ticketId));
		await tx.insert(ticketChange).values({
			ticketId,
			kind: 'cancel',
			fromSlotId: t.visitSlotId,
			amount: 0,
			reason: reason ?? null,
			changedBy: event.locals.user?.id
		});
	});
}

/**
 * Admits people on a ticket at the desk, recorded as a scan with no device. Only on its visit date.
 *
 * `headcount` admits part of the party — two of a family of five arrive first — and the ticket
 * stays valid for the rest; left out, everyone still to come is admitted. Answers how many came in
 * and how many are still to come.
 */
export async function checkInTicket(event: RequestEvent, ticketId: number, headcount?: number) {
	return db.transaction(async (tx) => {
		const { ticket: t } = await lockTicket(tx, ticketId);
		if (t.status !== 'valid') throw new WriteRefused(null, `A ${t.status} ticket cannot be checked in`);
		if (t.visitDate !== localToday()) throw new WriteRefused(null, `This ticket is for ${t.visitDate}, not today`);
		const remaining = Math.max(t.admits - t.checkedIn, 0);
		const people = headcount === undefined ? remaining : Math.min(Math.max(Math.trunc(headcount), 1), remaining);
		if (people < 1) throw new WriteRefused(null, 'Everyone on this ticket is already in');
		const checkedIn = t.checkedIn + people;
		const now = new Date();
		await tx
			.update(ticket)
			.set({
				status: checkedIn >= t.admits ? 'used' : 'valid',
				checkedIn,
				firstCheckedInAt: t.firstCheckedInAt ?? now
			})
			.where(eq(ticket.id, ticketId));
		await tx.insert(ticketScan).values({
			clientScanId: randomUUID(),
			scannedCode: t.code,
			ticketId,
			scannedBy: event.locals.user?.id,
			result: 'admitted',
			headcount: people,
			scannedAt: now
		});
		return { admitted: people, remaining: t.admits - checkedIn };
	});
}
