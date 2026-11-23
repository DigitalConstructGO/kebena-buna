/**
 * Tours, ceremonies and cuppings on the public site (8.1): what each is, what it costs per
 * audience, and its upcoming sessions with room. Private hire and school visits are not listed
 * here; they are booked by request on `/groups`.
 */
import { and, asc, eq, gt, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { addLocalDays, fromLocal, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { audience, bookable, bookablePrice, bookingSession } from '#lib/server/db/schema.ts';

const BY_REQUEST = ['private_event', 'school_visit'] as const;
const SESSION_DAYS = 45;

const columns = {
	id: bookable.id,
	slug: bookable.slug,
	kind: bookable.kind,
	name: bookable.name,
	description: bookable.description,
	image: bookable.image,
	durationMin: bookable.durationMin,
	minParty: bookable.minParty,
	maxParty: bookable.maxParty,
	pricing: bookable.pricing,
	isEnquiryOnly: bookable.isEnquiryOnly,
	languages: bookable.languages
};

const listed = and(
	eq(bookable.publishStatus, 'published'),
	eq(bookable.isActive, true),
	isNull(bookable.deletedAt),
	notInArray(bookable.kind, [...BY_REQUEST])
);

/** Prices per audience, for a set of bookables. */
async function pricesOf(ids: number[]) {
	if (!ids.length) return [];
	return db
		.select({ bookableId: bookablePrice.bookableId, audience: audience.name, price: bookablePrice.price })
		.from(bookablePrice)
		.innerJoin(audience, eq(bookablePrice.audienceId, audience.id))
		.where(
			and(
				inArray(bookablePrice.bookableId, ids),
				eq(bookablePrice.status, true),
				isNull(bookablePrice.deletedAt),
				eq(audience.status, true)
			)
		)
		.orderBy(asc(audience.sortOrder));
}

/** Every bookable a visitor can book online, with its prices. */
export async function experiences() {
	const rows = await db.select(columns).from(bookable).where(listed).orderBy(asc(bookable.sortOrder), asc(bookable.id));
	const prices = await pricesOf(rows.map((r) => r.id));
	return rows.map((r) => ({
		...r,
		prices: prices.filter((p) => p.bookableId === r.id).map((p) => ({ audience: p.audience, price: Number(p.price) }))
	}));
}

/** One bookable by slug, with its prices and the sessions still open in the next weeks. */
export async function experience(slug: string) {
	const [b] = await db.select(columns).from(bookable).where(and(eq(bookable.slug, slug), listed)).limit(1);
	if (!b) return null;
	const [prices, sessions] = await Promise.all([pricesOf([b.id]), b.isEnquiryOnly ? [] : openSessions(b.id)]);
	return {
		...b,
		prices: prices.map((p) => ({ audience: p.audience, price: Number(p.price) })),
		sessions
	};
}

/** Upcoming sessions of a bookable with at least one place left. */
export async function openSessions(bookableId: number, sessionId?: number) {
	return db
		.select({
			id: bookingSession.id,
			startsAt: bookingSession.startsAt,
			language: bookingSession.language,
			free: sql<number>`greatest(${bookingSession.capacity} - ${bookingSession.booked}, 0)`.mapWith(Number)
		})
		.from(bookingSession)
		.where(
			and(
				eq(bookingSession.bookableId, bookableId),
				sessionId ? eq(bookingSession.id, sessionId) : undefined,
				eq(bookingSession.isCancelled, false),
				eq(bookingSession.isActive, true),
				isNull(bookingSession.deletedAt),
				gt(bookingSession.startsAt, new Date()),
				sql`${bookingSession.startsAt} < ${fromLocal(addLocalDays(localToday(), SESSION_DAYS), '00:00')}`,
				gt(sql`${bookingSession.capacity} - ${bookingSession.booked}`, 0)
			)
		)
		.orderBy(asc(bookingSession.startsAt))
		.limit(120);
}
