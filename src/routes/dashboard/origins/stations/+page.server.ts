import { count, eq, isNull, like, or } from 'drizzle-orm';
import type { MySqlSelect } from 'drizzle-orm/mysql-core';
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
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '#lib/server/db/index.ts';
import { region, station } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { creator } from '#lib/server/people.ts';
import { greenKgOfStation, lotCountOfStation } from '#lib/server/origins.ts';
import { certificationOptions, regionOptions } from '#lib/server/options.ts';
import { stationSchema } from '#lib/schemas/origins.ts';
import { STATION_TYPES } from '#lib/constants.ts';
import { addStation } from './write.ts';

const FILTERS = ['type', 'regionId'] as const;
const SORTS = {
	code: station.code,
	name: enOf(station.name),
	farmerCount: station.farmerCount,
	lots: lotCountOfStation,
	greenKg: greenKgOfStation
};

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [isNull(station.deletedAt)],
	search: (term) => or(like(station.code, `%${term}%`), like(station.name, `%${term}%`)),
	filters: {
		type: (v) =>
			(STATION_TYPES as readonly string[]).includes(v)
				? eq(station.type, v as (typeof STATION_TYPES)[number])
				: undefined,
		regionId: (v) => eq(station.regionId, Number(v))
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.innerJoin(region, eq(station.regionId, region.id))
		.leftJoin(creator, eq(station.createdBy, creator.id));

export const load = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets, regions, certifications] = await Promise.all([
		joined(
			db
				.select({
					id: station.id,
					code: station.code,
					name: enOf(station.name),
					type: station.type,
					regionId: station.regionId,
					region: enOf(region.name),
					altitudeMinM: station.altitudeMinM,
					altitudeMaxM: station.altitudeMaxM,
					farmerCount: station.farmerCount,
					lots: lotCountOfStation,
					greenKg: greenKgOfStation,
					isActive: station.isActive,
					createdById: station.createdBy,
					createdBy: creator.name
				})
				.from(station)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [station.code]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(station).where(where),
		facetCounts({
			type: () =>
				db
					.select({ value: station.type, count: count() })
					.from(station)
					.where(buildWhere(query, spec, { except: 'type' }))
					.groupBy(station.type),
			regionId: () =>
				db
					.select({ value: region.id, label: enOf(region.name), count: count() })
					.from(station)
					.innerJoin(region, eq(station.regionId, region.id))
					.where(buildWhere(query, spec, { except: 'regionId' }))
					.groupBy(region.id)
		}),
		regionOptions(),
		certificationOptions()
	]);

	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) },
		canManage: hasPermission(locals, 'origins.manage'),
		addForm: await superValidate({ type: 'washing_station' }, zod4(stationSchema), {
			errors: false
		}),
		options: { regions, certifications }
	};
};

export const actions = { add: addStation };
