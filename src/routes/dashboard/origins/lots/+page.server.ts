import { and, count, desc, eq, isNull, like, or } from 'drizzle-orm';
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
import { db } from '#lib/server/db/index.ts';
import { lot, region, station } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { creator } from '#lib/server/people.ts';
import { greenKgOfLot } from '#lib/server/origins.ts';
import { PROCESSING_METHODS } from '#lib/constants.ts';

const FILTERS = ['process', 'stationId', 'cropYear'] as const;
const SORTS = {
	code: lot.code,
	cropYear: lot.cropYear,
	grade: lot.grade,
	cuppingScore: lot.cuppingScore,
	greenKg: greenKgOfLot,
	createdAt: lot.createdAt
};

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [isNull(lot.deletedAt)],
	search: (term) =>
		or(
			like(lot.code, `%${term}%`),
			like(lot.externalRef, `%${term}%`),
			like(lot.tastingNotes, `%${term}%`)
		),
	dateColumn: lot.createdAt,
	filters: {
		process: (v) =>
			(PROCESSING_METHODS as readonly string[]).includes(v)
				? eq(lot.process, v as (typeof PROCESSING_METHODS)[number])
				: undefined,
		stationId: (v) => eq(lot.stationId, Number(v)),
		cropYear: (v) => eq(lot.cropYear, Number(v))
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.innerJoin(station, eq(lot.stationId, station.id))
		.innerJoin(region, eq(lot.regionId, region.id))
		.leftJoin(creator, eq(lot.createdBy, creator.id));

export const load = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: lot.id,
					code: lot.code,
					stationId: lot.stationId,
					station: station.code,
					regionId: lot.regionId,
					region: enOf(region.name),
					process: lot.process,
					cropYear: lot.cropYear,
					grade: lot.grade,
					cuppingScore: lot.cuppingScore,
					greenKg: greenKgOfLot,
					isActive: lot.isActive,
					createdById: lot.createdBy,
					createdBy: creator.name,
					createdAt: lot.createdAt
				})
				.from(lot)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(lot.id)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(lot).where(where),
		facetCounts({
			process: () =>
				db
					.select({ value: lot.process, count: count() })
					.from(lot)
					.where(buildWhere(query, spec, { except: 'process' }))
					.groupBy(lot.process),
			stationId: () =>
				db
					.select({ value: station.id, label: station.code, count: count() })
					.from(lot)
					.innerJoin(station, eq(lot.stationId, station.id))
					.where(buildWhere(query, spec, { except: 'stationId' }))
					.groupBy(station.id, station.code),
			cropYear: () =>
				db
					.select({ value: lot.cropYear, count: count() })
					.from(lot)
					.where(and(buildWhere(query, spec, { except: 'cropYear' })))
					.groupBy(lot.cropYear)
		})
	]);

	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) },
		canManage: hasPermission(locals, 'origins.manage')
	};
};
