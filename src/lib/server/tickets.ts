/**
 * Tickets sold through orders: places held at checkout, tickets issued once the order is paid.
 *
 * A web order for entry tickets holds its places (`visit_slot.held`) the moment it is placed, so
 * two buyers cannot pay for the last place. Payment turns the hold into tickets: one per unit, each
 * with its own code and signed QR (`#lib/server/ticketQr`), and the places move from `held` to
 * `sold`. Until then there is no ticket to scan. Event tickets are held the same way, counted from
 * the event's unpaid orders (`eventHeld`), and become `registered` people when paid.
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { localDate } from '@nahu/admin-kit/time';
import {
	event,
	order,
	orderLine,
	ticket,
	ticketType,
	visitDay,
	visitSlot
} from '#lib/server/db/schema.ts';
import { moveCounters } from '#lib/server/visits.ts';
import { newTicketCode } from '#lib/server/ticketQr.ts';

const TICKET_ITEMS = ['ticket', 'event_ticket'] as const;

type TicketLine = {
	quantity: number;
	ticketTypeId: number | null;
	visitSlotId: number | null;
	eventId: number | null;
};

/** People a set of lines brings, per slot, counting only types that use capacity. */
async function peoplePerSlot(tx: Writer, lines: TicketLine[]) {
	const typeIds = [
		...new Set(lines.map((l) => l.ticketTypeId).filter((id): id is number => Boolean(id)))
	];
	const types = typeIds.length
		? await tx
				.select({
					id: ticketType.id,
					admits: ticketType.admitsPerTicket,
					counts: ticketType.countsTowardCapacity
				})
				.from(ticketType)
				.where(inArray(ticketType.id, typeIds))
		: [];
	const perSlot = new Map<number, number>();
	for (const l of lines) {
		const type = types.find((t) => t.id === l.ticketTypeId);
		if (!l.visitSlotId || !type?.counts) continue;
		perSlot.set(l.visitSlotId, (perSlot.get(l.visitSlotId) ?? 0) + l.quantity * type.admits);
	}
	// Slots in id order: the order every multi-slot change locks them in (`visits.ts`).
	return [...perSlot.entries()].sort(([a], [b]) => a - b);
}

/**
 * Holds the places an order's ticket lines need, at checkout. Refuses (`WriteRefused`, under
 * `field`) when a slot or its day is closed or full; the caller's transaction then rolls back.
 * Event tickets are held while their order is unpaid (`eventHeld`) and counted when issued.
 */
export async function holdTicketPlaces(tx: Writer, lines: TicketLine[], field = 'slot') {
	for (const [slotId, people] of await peoplePerSlot(tx, lines)) {
		await moveCounters(tx, slotId, people, { column: 'held', field });
	}
	const perEvent = new Map<number, number>();
	for (const [eventId, people] of await peoplePerEvent(tx, lines))
		perEvent.set(eventId, (perEvent.get(eventId) ?? 0) + people);
	for (const [eventId, people] of [...perEvent].sort(([a], [b]) => a - b)) {
		// Locked, so two checkouts for the last places queue here and the second sees the first.
		const [e] = await tx
			.select({ capacity: event.capacity, registered: event.registered })
			.from(event)
			.where(eq(event.id, eventId))
			.for('update');
		if (!e) throw new WriteRefused(field, 'Event not found');
		const taken = e.registered + (await eventHeld(tx, eventId));
		if (taken + people > e.capacity) {
			throw new WriteRefused(field, `Only ${Math.max(e.capacity - taken, 0)} places left`);
		}
	}
}

/** People a set of lines brings to each event: tickets times the people each admits. */
async function peoplePerEvent(tx: Writer, lines: TicketLine[]) {
	const evLines = lines.filter((l) => l.eventId && l.ticketTypeId);
	const typeIds = [...new Set(evLines.map((l) => l.ticketTypeId!))];
	const types = typeIds.length
		? await tx
				.select({ id: ticketType.id, admits: ticketType.admitsPerTicket })
				.from(ticketType)
				.where(inArray(ticketType.id, typeIds))
		: [];
	return evLines.map(
		(l) =>
			[l.eventId!, l.quantity * (types.find((t) => t.id === l.ticketTypeId)?.admits ?? 1)] as const
	);
}

/**
 * People in an event's unpaid orders: their places are held until they pay or the order lapses
 * (`expireUnpaidOrders`), counted from the orders themselves so a cancelled one lets go by itself.
 */
export async function eventHeld(tx: Writer, eventId: number) {
	const [row] = await tx
		.select({
			people:
				sql<number>`coalesce(sum(${orderLine.quantity} * ${ticketType.admitsPerTicket}), 0)`.mapWith(
					Number
				)
		})
		.from(orderLine)
		.innerJoin(order, eq(orderLine.orderId, order.id))
		.innerJoin(ticketType, eq(orderLine.ticketTypeId, ticketType.id))
		.where(
			and(
				eq(orderLine.eventId, eventId),
				eq(order.status, 'pending_payment'),
				isNull(order.deletedAt)
			)
		);
	return row?.people ?? 0;
}

/** Gives back the places an unpaid order held (cancelled, or its payment window closed). */
export async function releaseTicketPlaces(tx: Writer, orderId: number) {
	const lines = await tx
		.select({
			quantity: orderLine.quantity,
			ticketTypeId: orderLine.ticketTypeId,
			visitSlotId: orderLine.visitSlotId,
			eventId: orderLine.eventId
		})
		.from(orderLine)
		.where(and(eq(orderLine.orderId, orderId), inArray(orderLine.itemType, TICKET_ITEMS)));
	const issued = await tx
		.select({ id: ticket.id })
		.from(ticket)
		.where(eq(ticket.orderId, orderId))
		.limit(1);
	if (issued.length) return;
	for (const [slotId, people] of await peoplePerSlot(
		tx,
		lines.map((l) => ({ ...l, quantity: Number(l.quantity) }))
	)) {
		await moveCounters(tx, slotId, -people, { column: 'held' });
	}
}

/**
 * Issues the tickets of a paid order: one per unit of each ticket line, unless that line already
 * has its tickets. Held places become sold; an event's `registered` count goes up. Runs inside the
 * payment's transaction (`applyOrderPayment`), so a payment never lands without its tickets.
 */
export async function issueOrderTickets(tx: Writer, orderId: number) {
	const [o] = await tx
		.select({ customerId: order.customerId, locale: order.locale, contactName: order.contactName })
		.from(order)
		.where(eq(order.id, orderId));
	if (!o) return 0;
	const lines = await tx
		.select({
			id: orderLine.id,
			quantity: orderLine.quantity,
			ticketTypeId: orderLine.ticketTypeId,
			audienceId: orderLine.audienceId,
			visitSlotId: orderLine.visitSlotId,
			eventId: orderLine.eventId,
			admits: ticketType.admitsPerTicket,
			slotDate: visitDay.date,
			eventStart: event.startsAt,
			hasTickets:
				sql<number>`(select count(*) from ${ticket} t where t.order_line_id = ${orderLine.id})`.mapWith(
					Number
				)
		})
		.from(orderLine)
		.innerJoin(ticketType, eq(orderLine.ticketTypeId, ticketType.id))
		.leftJoin(visitSlot, eq(orderLine.visitSlotId, visitSlot.id))
		.leftJoin(visitDay, eq(visitSlot.visitDayId, visitDay.id))
		.leftJoin(event, eq(orderLine.eventId, event.id))
		.where(and(eq(orderLine.orderId, orderId), inArray(orderLine.itemType, TICKET_ITEMS)));

	const fresh = lines.filter((l) => !l.hasTickets && l.audienceId);
	if (!fresh.length) return 0;

	// Held places become sold: take the hold off first, so the sale fits under the capacity.
	const asLines = fresh.map((l) => ({ ...l, quantity: Number(l.quantity) }));
	for (const [slotId, people] of await peoplePerSlot(tx, asLines)) {
		await moveCounters(tx, slotId, -people, { column: 'held' });
		await moveCounters(tx, slotId, people, { column: 'sold' });
	}

	let made = 0;
	for (const l of fresh) {
		const visitDate = l.slotDate ?? (l.eventStart ? localDate(l.eventStart) : null);
		if (!visitDate) continue;
		for (let n = 0; n < Number(l.quantity); n++) {
			await tx.insert(ticket).values({
				code: newTicketCode(),
				orderId,
				orderLineId: l.id,
				customerId: o.customerId,
				ticketTypeId: l.ticketTypeId!,
				audienceId: l.audienceId!,
				visitSlotId: l.visitSlotId,
				eventId: l.eventId,
				visitDate,
				holderName: o.contactName,
				admits: l.admits,
				locale: o.locale
			});
			made++;
		}
		// The event counts people, as cancelling a ticket gives back its `admits`.
		if (l.eventId) {
			await tx
				.update(event)
				.set({ registered: sql`${event.registered} + ${Number(l.quantity) * l.admits}` })
				.where(eq(event.id, l.eventId));
		}
	}
	return made;
}
