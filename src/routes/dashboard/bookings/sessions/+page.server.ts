import { count, desc, eq, like, or, sql } from 'drizzle-orm';
import type { MySqlSelect } from 'drizzle-orm/mysql-core';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	orderBy,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '@nahu/admin-kit/server/queryFilters';
import { db } from '#lib/server/db/index.ts';
import { bookable, bookingSession, staffAssignment } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';

const FILTERS = ['bookableId', 'state', 'language'] as const;
/** Upcoming, past or cancelled — what a session list is filtered by first. */
const state = sql<string>`case when ${bookingSession.isCancelled} then 'cancelled' when ${bookingSession.startsAt} >= now() then 'upcoming' else 'past' end`;
const free = sql<number>`(${bookingSession.capacity} - ${bookingSession.booked})`.mapWith(Number);
const SORTS = { startsAt: bookingSession.startsAt, booked: bookingSession.booked, free };

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [sql`${bookingSession.deletedAt} is null`],
	search: (term) => or(like(bookingSession.notes, `%${term}%`), like(bookable.name, `%${term}%`)),
	dateColumn: bookingSession.startsAt,
	filters: {
		bookableId: (v) => eq(bookingSession.bookableId, Number(v)),
		state: (v) =>
			['cancelled', 'upcoming', 'past'].includes(v) ? sql`${state} = ${v}` : undefined,
		language: (v) => eq(bookingSession.language, v)
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q.innerJoin(bookable, eq(bookingSession.bookableId, bookable.id));

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: bookingSession.id,
					bookableId: bookingSession.bookableId,
					bookable: enOf(bookable.name),
					startsAt: bookingSession.startsAt,
					endsAt: bookingSession.endsAt,
					language: bookingSession.language,
					capacity: bookingSession.capacity,
					booked: bookingSession.booked,
					free,
					state,
					notes: bookingSession.notes,
					staff: sql<
						string | null
					>`(select group_concat(u.name separator ', ') from ${staffAssignment} sa join user u on u.id = sa.user_id where sa.session_id = ${bookingSession.id})`
				})
				.from(bookingSession)
				.$dynamic()
		)
			.where(where)
			// Upcoming first, soonest at the top — what the front desk is looking for — then the past.
			.orderBy(
				...(orderBy(query, SORTS) ?? [
					sql`${bookingSession.startsAt} < now()`,
					sql`case when ${bookingSession.startsAt} >= now() then ${bookingSession.startsAt} end`,
					desc(bookingSession.startsAt)
				])
			)
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(bookingSession).$dynamic()).where(where),
		facetCounts({
			bookableId: () =>
				joined(
					db
						.select({ value: bookable.id, label: enOf(bookable.name), count: count() })
						.from(bookingSession)
						.$dynamic()
				)
					.where(buildWhere(query, spec, { except: 'bookableId' }))
					.groupBy(bookable.id),
			state: () =>
				joined(db.select({ value: state, count: count() }).from(bookingSession).$dynamic())
					.where(buildWhere(query, spec, { except: 'state' }))
					.groupBy(state),
			language: () =>
				joined(
					db
						.select({ value: bookingSession.language, count: count() })
						.from(bookingSession)
						.$dynamic()
				)
					.where(buildWhere(query, spec, { except: 'language' }))
					.groupBy(bookingSession.language)
		})
	]);
	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
