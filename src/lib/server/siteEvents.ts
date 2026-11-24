/**
 * Events on the public site (8.3): upcoming published ones, public or members-only (listed, but
 * registered for at the desk), with places left and whether registration is still open.
 */
import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	event,
	location,
	order,
	orderLine,
	ticketPrice,
	ticketType
} from '#lib/server/db/schema.ts';

/** Places taken: people registered, plus those held by unpaid orders (`eventHeld`). */
const taken = sql<number>`${event.registered} + (
	select coalesce(sum(${orderLine.quantity} * ${ticketType.admitsPerTicket}), 0)
	from ${orderLine}
	join ${order} on ${order.id} = ${orderLine.orderId}
	join ${ticketType} on ${ticketType.id} = ${orderLine.ticketTypeId}
	where ${orderLine.eventId} = ${event.id}
		and ${order.status} = 'pending_payment'
		and ${order.deletedAt} is null
)`.mapWith(Number);

const columns = {
	id: event.id,
	slug: event.slug,
	title: event.title,
	summary: event.summary,
	description: event.description,
	image: event.image,
	location: location.name,
	startsAt: event.startsAt,
	endsAt: event.endsAt,
	capacity: event.capacity,
	registered: taken,
	visibility: event.visibility,
	isFree: event.isFree,
	includesEntry: event.includesEntry,
	registrationClosesAt: event.registrationClosesAt
};

const shown = () =>
	and(
		eq(event.publishStatus, 'published'),
		eq(event.isActive, true),
		isNull(event.deletedAt),
		inArray(event.visibility, ['public', 'members_only']),
		gt(event.endsAt, new Date())
	);

type Row = {
	startsAt: Date;
	registrationClosesAt: Date | null;
	capacity: number;
	registered: number;
	visibility: string;
};

/** Registration is open: public, not started, before its closing time, and not full. */
export const registrationOpen = (e: Row, now = new Date()) =>
	e.visibility === 'public' &&
	e.startsAt > now &&
	(!e.registrationClosesAt || e.registrationClosesAt > now) &&
	e.capacity - e.registered > 0;

/** The lowest price of each event's tickets on sale here (any audience). */
async function fromPrices(ids: number[]) {
	if (!ids.length) return new Map<number, number>();
	const rows = await db
		.select({
			eventId: ticketType.eventId,
			from: sql<number>`min(${ticketPrice.price})`.mapWith(Number)
		})
		.from(ticketType)
		.innerJoin(
			ticketPrice,
			and(
				eq(ticketPrice.ticketTypeId, ticketType.id),
				eq(ticketPrice.status, true),
				isNull(ticketPrice.deletedAt)
			)
		)
		.where(
			and(
				inArray(ticketType.eventId, ids),
				eq(ticketType.isActive, true),
				isNull(ticketType.deletedAt),
				eq(ticketType.isStaffOnly, false),
				eq(ticketType.isMemberOnly, false)
			)
		)
		.groupBy(ticketType.eventId);
	return new Map(rows.map((r) => [r.eventId!, r.from]));
}

export async function upcomingEvents() {
	const rows = await db
		.select(columns)
		.from(event)
		.innerJoin(location, eq(event.locationId, location.id))
		.where(shown())
		.orderBy(asc(event.startsAt));
	const prices = await fromPrices(rows.map((r) => r.id));
	return rows.map((r) => ({
		...r,
		left: Math.max(r.capacity - r.registered, 0),
		open: registrationOpen(r),
		from: r.isFree ? 0 : (prices.get(r.id) ?? null)
	}));
}

export async function eventBySlug(slug: string) {
	const [e] = await db
		.select(columns)
		.from(event)
		.innerJoin(location, eq(event.locationId, location.id))
		.where(and(eq(event.slug, slug), shown()))
		.limit(1);
	if (!e) return null;
	return { ...e, left: Math.max(e.capacity - e.registered, 0), open: registrationOpen(e) };
}
