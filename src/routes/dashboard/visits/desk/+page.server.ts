import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import { bad, ok, parse } from '@nahu/admin-kit/server/actionResults';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { audience, customer, event, location, ticket, ticketType, visitDay, visitSlot } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { checkInTicket } from '#lib/server/visits.ts';

/**
 * The check-in desk: today's tickets, found by code or name, admitted in one tap.
 *
 * Checking in used to mean finding the ticket in the list, opening it, pressing "Check in" and
 * confirming — four steps per party, the whole party at once. This page is for the person at the
 * door with a tablet or a barcode scanner: everything for today is already loaded, the search
 * box takes a scanned code, and a party can come in a few at a time.
 */
export const load = async ({ locals }) => {
	requirePermission(locals, 'visits.view');
	const today = localToday();

	const [slots, tickets] = await Promise.all([
		db
			.select({
				id: visitSlot.id,
				startsAt: visitSlot.startsAt,
				endsAt: visitSlot.endsAt,
				capacity: visitSlot.capacity,
				sold: visitSlot.sold,
				location: enOf(location.name),
				checkedIn: sql<number>`(select coalesce(sum(t.checked_in), 0) from ticket t where t.visit_slot_id = ${visitSlot.id})`.mapWith(
					Number
				)
			})
			.from(visitSlot)
			.innerJoin(visitDay, eq(visitSlot.visitDayId, visitDay.id))
			.innerJoin(location, eq(visitDay.locationId, location.id))
			.where(and(eq(visitDay.date, today), eq(visitSlot.isClosed, false)))
			.orderBy(asc(visitSlot.startsAt)),
		db
			.select({
				id: ticket.id,
				code: ticket.code,
				status: ticket.status,
				admits: ticket.admits,
				checkedIn: ticket.checkedIn,
				holderName: ticket.holderName,
				customer: customer.name,
				phone: customer.phone,
				type: enOf(ticketType.name),
				audience: enOf(audience.name),
				slotId: ticket.visitSlotId,
				slotStart: visitSlot.startsAt,
				event: enOf(event.title)
			})
			.from(ticket)
			.innerJoin(ticketType, eq(ticket.ticketTypeId, ticketType.id))
			.innerJoin(audience, eq(ticket.audienceId, audience.id))
			.leftJoin(customer, eq(ticket.customerId, customer.id))
			.leftJoin(visitSlot, eq(ticket.visitSlotId, visitSlot.id))
			.leftJoin(event, eq(ticket.eventId, event.id))
			// Used tickets stay listed, so the desk can see who is already in.
			.where(and(eq(ticket.visitDate, today), inArray(ticket.status, ['valid', 'used'])))
			.orderBy(asc(visitSlot.startsAt), asc(ticket.code))
	]);

	return { today, slots, tickets };
};

const checkInSchema = z.object({
	id: z.coerce.number().int().positive(),
	headcount: z.coerce.number().int().positive().optional()
});

export const actions = {
	checkIn: async (event) => {
		requirePermission(event.locals, 'visits.view');
		const p = await parse(event.request, checkInSchema);
		if ('error' in p) return p.error;
		try {
			const { admitted, remaining } = await checkInTicket(event, p.data.id, p.data.headcount);
			const people = `${admitted} ${admitted === 1 ? 'person' : 'people'}`;
			return ok(remaining ? `${people} in · ${remaining} still to come` : `${people} in`);
		} catch (err) {
			if (err instanceof WriteRefused) return bad(err.message);
			throw err;
		}
	}
};
