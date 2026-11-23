import { count, desc, eq, like, sql } from 'drizzle-orm';
import { hasPermission } from '@nahu/admin-kit/server/permissions';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	orderBy,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '@nahu/admin-kit/server/queryFilters';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { db } from '#lib/server/db/index.ts';
import { event, location } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { EVENT_VISIBILITIES, PUBLISH_STATUSES } from '#lib/constants.ts';

const FILTERS = ['publishStatus', 'visibility', 'locationId'] as const;
const full = sql<number>`round(${event.registered} / nullif(${event.capacity}, 0) * 100)`.mapWith(Number);
const SORTS = { title: enOf(event.title), startsAt: event.startsAt, registered: event.registered, full };

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [notDeleted(event)],
	dateColumn: event.startsAt,
	search: (term) => like(event.title, `%${term}%`),
	filters: {
		publishStatus: (v) =>
			(PUBLISH_STATUSES as readonly string[]).includes(v)
				? eq(event.publishStatus, v as (typeof PUBLISH_STATUSES)[number])
				: undefined,
		visibility: (v) =>
			(EVENT_VISIBILITIES as readonly string[]).includes(v)
				? eq(event.visibility, v as (typeof EVENT_VISIBILITIES)[number])
				: undefined,
		locationId: (v) => eq(event.locationId, Number(v))
	}
};

export const load = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: event.id,
				title: enOf(event.title),
				startsAt: event.startsAt,
				locationId: event.locationId,
				location: enOf(location.name),
				capacity: event.capacity,
				registered: event.registered,
				full,
				isFree: event.isFree,
				visibility: event.visibility,
				publishStatus: event.publishStatus
			})
			.from(event)
			.innerJoin(location, eq(event.locationId, location.id))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(event.startsAt)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(event).where(where),
		facetCounts({
			publishStatus: () =>
				db
					.select({ value: event.publishStatus, count: count() })
					.from(event)
					.where(buildWhere(query, spec, { except: 'publishStatus' }))
					.groupBy(event.publishStatus),
			visibility: () =>
				db
					.select({ value: event.visibility, count: count() })
					.from(event)
					.where(buildWhere(query, spec, { except: 'visibility' }))
					.groupBy(event.visibility),
			locationId: () =>
				db
					.select({ value: location.id, label: enOf(location.name), count: count() })
					.from(event)
					.innerJoin(location, eq(event.locationId, location.id))
					.where(buildWhere(query, spec, { except: 'locationId' }))
					.groupBy(location.id, location.name)
		})
	]);
	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) },
		canManage: hasPermission(locals, 'events.manage')
	};
};
