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
import {
	bookable,
	booking,
	bookingSession,
	event as eventTable,
	staffAssignment
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { userAlias } from '#lib/server/people.ts';

const staffer = userAlias('staffer');
const assigner = userAlias('assigner');

const FILTERS = ['userId', 'role'] as const;
const SORTS = { startsAt: staffAssignment.startsAt, user: staffer.name };

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	search: (term) => or(like(staffer.name, `%${term}%`), like(booking.number, `%${term}%`)),
	dateColumn: staffAssignment.startsAt,
	filters: {
		userId: (v) => eq(staffAssignment.userId, v),
		role: (v) => eq(staffAssignment.role, v)
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.innerJoin(staffer, eq(staffAssignment.userId, staffer.id))
		.leftJoin(assigner, eq(staffAssignment.assignedBy, assigner.id))
		.leftJoin(bookingSession, eq(staffAssignment.sessionId, bookingSession.id))
		.leftJoin(booking, eq(staffAssignment.bookingId, booking.id))
		.leftJoin(eventTable, eq(staffAssignment.eventId, eventTable.id))
		.leftJoin(bookable, sql`${bookable.id} = coalesce(${bookingSession.bookableId}, ${booking.bookableId})`);

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: staffAssignment.id,
					userId: staffAssignment.userId,
					user: staffer.name,
					role: staffAssignment.role,
					startsAt: staffAssignment.startsAt,
					endsAt: staffAssignment.endsAt,
					sessionId: staffAssignment.sessionId,
					bookingId: staffAssignment.bookingId,
					bookingNumber: booking.number,
					eventId: staffAssignment.eventId,
					event: enOf(eventTable.title),
					bookableId: bookable.id,
					bookable: enOf(bookable.name),
					assignedById: staffAssignment.assignedBy,
					assignedBy: assigner.name
				})
				.from(staffAssignment)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(staffAssignment.startsAt)]))
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(staffAssignment).$dynamic()).where(where),
		facetCounts({
			userId: () =>
				joined(db.select({ value: staffer.id, label: staffer.name, count: count() }).from(staffAssignment).$dynamic())
					.where(buildWhere(query, spec, { except: 'userId' }))
					.groupBy(staffer.id, staffer.name),
			role: () =>
				joined(db.select({ value: staffAssignment.role, count: count() }).from(staffAssignment).$dynamic())
					.where(buildWhere(query, spec, { except: 'role' }))
					.groupBy(staffAssignment.role)
		})
	]);
	return { rows, server: { pagination: pagination(query, total), facets, filters: currentQuery(query) } };
};
