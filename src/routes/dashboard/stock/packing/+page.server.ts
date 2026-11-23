import { count, desc, eq, like, or } from 'drizzle-orm';
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
import {
	grind,
	location,
	packingRun,
	product,
	productVariant,
	roastLevel
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { userAlias } from '#lib/server/people.ts';

const packer = userAlias('packer');
const FILTERS = ['productId', 'roastLevelId', 'locationId'] as const;
const SORTS = { code: packingRun.code, packedAt: packingRun.packedAt, units: packingRun.units, bestBefore: packingRun.bestBefore };

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	search: (term) => or(like(packingRun.code, `%${term}%`), like(productVariant.sku, `%${term}%`)),
	dateColumn: packingRun.packedAt,
	filters: {
		productId: (v) => eq(productVariant.productId, Number(v)),
		roastLevelId: (v) => eq(packingRun.roastLevelId, Number(v)),
		locationId: (v) => eq(packingRun.locationId, Number(v))
	}
};

/** The variant is joined for every count too: search and the product filter read it. */
const base = <T extends MySqlSelect>(q: T) =>
	q.innerJoin(productVariant, eq(packingRun.variantId, productVariant.id));

export const load = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const facet = (key: (typeof FILTERS)[number]) => buildWhere(query, spec, { except: key });
	const [rows, [{ total }], facets] = await Promise.all([
		base(
			db
				.select({
					id: packingRun.id,
					code: packingRun.code,
					packedAt: packingRun.packedAt,
					variantId: packingRun.variantId,
					sku: productVariant.sku,
					productId: productVariant.productId,
					product: enOf(product.name),
					roastLevel: enOf(roastLevel.name),
					grind: enOf(grind.name),
					locationId: packingRun.locationId,
					location: enOf(location.name),
					units: packingRun.units,
					bestBefore: packingRun.bestBefore,
					labelPrintedAt: packingRun.labelPrintedAt,
					isToOrder: packingRun.isToOrder,
					packedById: packingRun.packedBy,
					packedBy: packer.name
				})
				.from(packingRun)
				.$dynamic()
		)
			.innerJoin(product, eq(productVariant.productId, product.id))
			.innerJoin(roastLevel, eq(packingRun.roastLevelId, roastLevel.id))
			.innerJoin(location, eq(packingRun.locationId, location.id))
			.leftJoin(grind, eq(packingRun.grindId, grind.id))
			.leftJoin(packer, eq(packingRun.packedBy, packer.id))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(packingRun.packedAt)]))
			.limit(query.limit)
			.offset(query.offset),
		base(db.select({ total: count() }).from(packingRun).$dynamic()).where(where),
		facetCounts({
			productId: () =>
				base(db.select({ value: product.id, label: enOf(product.name), count: count() }).from(packingRun).$dynamic())
					.innerJoin(product, eq(productVariant.productId, product.id))
					.where(facet('productId'))
					.groupBy(product.id, product.name),
			roastLevelId: () =>
				base(db.select({ value: roastLevel.id, label: enOf(roastLevel.name), count: count() }).from(packingRun).$dynamic())
					.innerJoin(roastLevel, eq(packingRun.roastLevelId, roastLevel.id))
					.where(facet('roastLevelId'))
					.groupBy(roastLevel.id, roastLevel.name),
			locationId: () =>
				base(db.select({ value: location.id, label: enOf(location.name), count: count() }).from(packingRun).$dynamic())
					.innerJoin(location, eq(packingRun.locationId, location.id))
					.where(facet('locationId'))
					.groupBy(location.id, location.name)
		})
	]);

	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) },
		canManage: hasPermission(locals, 'stock.manage')
	};
};
