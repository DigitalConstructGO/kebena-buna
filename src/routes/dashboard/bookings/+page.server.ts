import { count, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
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
import { bookable, booking, bookingSession } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { userAlias } from '#lib/server/people.ts';
import { WORKFLOW_STATUSES } from '#lib/constants.ts';

const assignee = userAlias('assignee');
const FILTERS = ['status', 'bookableId', 'assignedTo'] as const;
/** When it happens: the confirmed time, else the session's, else the first date asked for. */
const when = sql<string | null>`coalesce(${booking.confirmedStartsAt}, ${bookingSession.startsAt})`;
const SORTS = {
	number: booking.number,
	when,
	partySize: booking.partySize,
	createdAt: booking.createdAt
};

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [isNull(booking.deletedAt)],
	search: (term) =>
		or(
			like(booking.number, `%${term}%`),
			like(booking.contactName, `%${term}%`),
			like(booking.contactPhone, `%${term.replace(/^0/, '')}%`),
			like(booking.organisationName, `%${term}%`)
		),
	dateColumn: booking.createdAt,
	filters: {
		status: (v) =>
			(WORKFLOW_STATUSES as readonly string[]).includes(v)
				? eq(booking.status, v as (typeof WORKFLOW_STATUSES)[number])
				: undefined,
		bookableId: (v) => eq(booking.bookableId, Number(v)),
		assignedTo: (v) => eq(booking.assignedTo, v)
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.innerJoin(bookable, eq(booking.bookableId, bookable.id))
		.leftJoin(bookingSession, eq(booking.sessionId, bookingSession.id))
		.leftJoin(assignee, eq(booking.assignedTo, assignee.id));

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: booking.id,
					number: booking.number,
					bookableId: booking.bookableId,
					bookable: enOf(bookable.name),
					sessionId: booking.sessionId,
					customerId: booking.customerId,
					contactName: booking.contactName,
					organisationName: booking.organisationName,
					partySize: booking.partySize,
					when,
					status: booking.status,
					assignedTo: booking.assignedTo,
					assignee: assignee.name,
					createdAt: booking.createdAt
				})
				.from(booking)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(booking.id)]))
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(booking).$dynamic()).where(where),
		facetCounts({
			status: () =>
				joined(db.select({ value: booking.status, count: count() }).from(booking).$dynamic())
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(booking.status),
			bookableId: () =>
				joined(db.select({ value: bookable.id, label: enOf(bookable.name), count: count() }).from(booking).$dynamic())
					.where(buildWhere(query, spec, { except: 'bookableId' }))
					.groupBy(bookable.id),
			assignedTo: () =>
				joined(db.select({ value: assignee.id, label: assignee.name, count: count() }).from(booking).$dynamic())
					.where(buildWhere(query, spec, { except: 'assignedTo' }))
					.groupBy(assignee.id, assignee.name)
		})
	]);
	return { rows, server: { pagination: pagination(query, total), facets, filters: currentQuery(query) } };
};
