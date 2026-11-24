import { count, desc, eq, isNull, like, or } from 'drizzle-orm';
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
import { location, product, roastBatch, roastLevel, roastMachine } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { userAlias } from '#lib/server/people.ts';
import { stockLevels } from '#lib/server/stockReads.ts';

const roaster = userAlias('roaster');
const FILTERS = ['roastLevelId', 'machineId', 'locationId', 'productId'] as const;
const SORTS = {
	code: roastBatch.code,
	roastedAt: roastBatch.roastedAt,
	greenKgIn: roastBatch.greenKgIn,
	roastedKgOut: roastBatch.roastedKgOut,
	weightLossPct: roastBatch.weightLossPct,
	cuppingScore: roastBatch.cuppingScore
};

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	// A voided batch was never roasted.
	base: [isNull(roastBatch.deletedAt)],
	search: (term) => or(like(roastBatch.code, `%${term}%`), like(roastBatch.notes, `%${term}%`)),
	dateColumn: roastBatch.roastedAt,
	filters: {
		roastLevelId: (v) => eq(roastBatch.roastLevelId, Number(v)),
		machineId: (v) => eq(roastBatch.machineId, Number(v)),
		locationId: (v) => eq(roastBatch.locationId, Number(v)),
		productId: (v) => eq(roastBatch.productId, Number(v))
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.innerJoin(roastLevel, eq(roastBatch.roastLevelId, roastLevel.id))
		.innerJoin(location, eq(roastBatch.locationId, location.id))
		.leftJoin(roastMachine, eq(roastBatch.machineId, roastMachine.id))
		.leftJoin(product, eq(roastBatch.productId, product.id))
		.leftJoin(roaster, eq(roastBatch.roasterId, roaster.id));

export const load = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const facet = <K extends (typeof FILTERS)[number]>(key: K) =>
		buildWhere(query, spec, { except: key });
	const [rows, [{ total }], facets, levels] = await Promise.all([
		joined(
			db
				.select({
					id: roastBatch.id,
					code: roastBatch.code,
					roastedAt: roastBatch.roastedAt,
					productId: roastBatch.productId,
					product: enOf(product.name),
					roastLevel: enOf(roastLevel.name),
					machine: roastMachine.name,
					locationId: roastBatch.locationId,
					location: enOf(location.name),
					greenKgIn: roastBatch.greenKgIn,
					roastedKgOut: roastBatch.roastedKgOut,
					weightLossPct: roastBatch.weightLossPct,
					cuppingScore: roastBatch.cuppingScore,
					isToOrder: roastBatch.isToOrder,
					roasterId: roastBatch.roasterId,
					roaster: roaster.name
				})
				.from(roastBatch)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(roastBatch.roastedAt)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(roastBatch).where(where),
		facetCounts({
			roastLevelId: () =>
				db
					.select({ value: roastLevel.id, label: enOf(roastLevel.name), count: count() })
					.from(roastBatch)
					.innerJoin(roastLevel, eq(roastBatch.roastLevelId, roastLevel.id))
					.where(facet('roastLevelId'))
					.groupBy(roastLevel.id, roastLevel.name),
			machineId: () =>
				db
					.select({ value: roastMachine.id, label: roastMachine.name, count: count() })
					.from(roastBatch)
					.innerJoin(roastMachine, eq(roastBatch.machineId, roastMachine.id))
					.where(facet('machineId'))
					.groupBy(roastMachine.id, roastMachine.name),
			locationId: () =>
				db
					.select({ value: location.id, label: enOf(location.name), count: count() })
					.from(roastBatch)
					.innerJoin(location, eq(roastBatch.locationId, location.id))
					.where(facet('locationId'))
					.groupBy(location.id, location.name),
			productId: () =>
				db
					.select({ value: product.id, label: enOf(product.name), count: count() })
					.from(roastBatch)
					.innerJoin(product, eq(roastBatch.productId, product.id))
					.where(facet('productId'))
					.groupBy(product.id, product.name)
		}),
		stockLevels()
	]);

	return {
		rows,
		lossRange: levels.lossRange,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) },
		canManage: hasPermission(locals, 'stock.manage')
	};
};
