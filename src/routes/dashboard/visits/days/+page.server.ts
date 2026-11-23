import { count, desc, eq, sql } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	orderBy,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '@nahu/admin-kit/server/queryFilters';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { location, visitDay } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { generateDays } from '#lib/server/visits.ts';
import { generateDaysSchema } from '#lib/schemas/visits.ts';

const FILTERS = ['locationId', 'open'] as const;
const full =
	sql<number>`round((${visitDay.sold} + ${visitDay.held}) / nullif(${visitDay.capacity}, 0) * 100)`.mapWith(
		Number
	);
const SORTS = { date: visitDay.date, sold: visitDay.sold, held: visitDay.held, full };

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	dateColumn: visitDay.date,
	search: (term) => sql`${visitDay.date} like ${`%${term}%`}`,
	filters: {
		locationId: (v) => eq(visitDay.locationId, Number(v)),
		open: (v) => eq(visitDay.isClosed, v === 'closed')
	}
};

export const load = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: visitDay.id,
				date: visitDay.date,
				locationId: visitDay.locationId,
				location: enOf(location.name),
				capacity: visitDay.capacity,
				sold: visitDay.sold,
				held: visitDay.held,
				full,
				isClosed: visitDay.isClosed,
				slots:
					sql<number>`(select count(*) from visit_slot vs where vs.visit_day_id = visit_day.id)`.mapWith(
						Number
					),
				closedSlots:
					sql<number>`(select count(*) from visit_slot vs where vs.visit_day_id = visit_day.id and vs.is_closed)`.mapWith(
						Number
					)
			})
			.from(visitDay)
			.innerJoin(location, eq(visitDay.locationId, location.id))
			.where(where)
			// Newest first by default: next month's days, then today, then the past.
			.orderBy(...(orderBy(query, SORTS) ?? [desc(visitDay.date)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(visitDay).where(where),
		facetCounts({
			locationId: () =>
				db
					.select({ value: location.id, label: enOf(location.name), count: count() })
					.from(visitDay)
					.innerJoin(location, eq(visitDay.locationId, location.id))
					.where(buildWhere(query, spec, { except: 'locationId' }))
					.groupBy(location.id, location.name),
			open: () =>
				db
					.select({
						value: sql<string>`if(${visitDay.isClosed}, 'closed', 'open')`,
						count: count()
					})
					.from(visitDay)
					.where(buildWhere(query, spec, { except: 'open' }))
					.groupBy(visitDay.isClosed)
		})
	]);
	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) },
		today: localToday(),
		canManage: hasPermission(locals, 'visits.manage'),
		generateForm: await superValidate(
			{ from: localToday(), days: 30, dayCapacity: 400 },
			zod4(generateDaysSchema),
			{
				errors: false
			}
		)
	};
};

export const actions = {
	/** Days and slots from the slot pattern; days that exist already are left alone. */
	generate: async (event) => {
		requirePermission(event.locals, 'visits.manage');
		const form = await superValidate(event.request, zod4(generateDaysSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const made = await generateDays(
			form.data.from,
			form.data.days,
			form.data.dayCapacity,
			event.locals.user?.id
		);
		return message(form, {
			type: 'success',
			text: made.days
				? `${made.days} days and ${made.slots} slots made`
				: 'Nothing to make: those days exist already or are closed'
		});
	}
};
