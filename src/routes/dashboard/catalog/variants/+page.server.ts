import { and, count, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
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
import { bagSize, product, productVariant } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { packedLowDefault, packedUnitsOfVariant } from '#lib/server/catalog.ts';

const FILTERS = ['productId', 'bagSizeId', 'stock'] as const;

export const load = async ({ url }) => {
	const lowDefault = await packedLowDefault();
	const isLow = sql<boolean>`${packedUnitsOfVariant} < coalesce(${productVariant.lowStockUnits}, ${lowDefault})`;
	const SORTS = {
		sku: productVariant.sku,
		product: enOf(product.name),
		price: productVariant.price,
		packed: packedUnitsOfVariant
	};
	const spec: WhereSpec<(typeof FILTERS)[number]> = {
		base: [isNull(productVariant.deletedAt), isNull(product.deletedAt)],
		search: (term) =>
			or(
				like(productVariant.sku, `%${term}%`),
				like(productVariant.barcode, `%${term}%`),
				like(product.name, `%${term}%`)
			),
		filters: {
			productId: (v) => eq(productVariant.productId, Number(v)),
			bagSizeId: (v) => eq(productVariant.bagSizeId, Number(v)),
			stock: (v) => (v === 'low' ? isLow : v === 'ok' ? sql`not ${isLow}` : undefined)
		}
	};
	const joined = <T extends MySqlSelect>(q: T) =>
		q
			.innerJoin(product, eq(productVariant.productId, product.id))
			.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id));

	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: productVariant.id,
					sku: productVariant.sku,
					productId: product.id,
					product: enOf(product.name),
					size: sql<string>`coalesce(${enOf(bagSize.name)}, ${enOf(productVariant.name)})`,
					price: productVariant.price,
					compareAtPrice: productVariant.compareAtPrice,
					packed: packedUnitsOfVariant,
					lowAt: sql<number>`coalesce(${productVariant.lowStockUnits}, ${lowDefault})`.mapWith(Number),
					isActive: productVariant.isActive
				})
				.from(productVariant)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [product.sortOrder, productVariant.sortOrder, desc(productVariant.id)]))
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(productVariant).$dynamic()).where(where),
		facetCounts({
			productId: () =>
				joined(db.select({ value: product.id, label: enOf(product.name), count: count() }).from(productVariant).$dynamic())
					.where(buildWhere(query, spec, { except: 'productId' }))
					.groupBy(product.id),
			bagSizeId: () =>
				joined(db.select({ value: bagSize.id, label: enOf(bagSize.name), count: count() }).from(productVariant).$dynamic())
					.where(and(buildWhere(query, spec, { except: 'bagSizeId' }), sql`${productVariant.bagSizeId} is not null`))
					.groupBy(bagSize.id),
			stock: () =>
				joined(
					db
						.select({
							value: sql<string>`if(${isLow}, 'low', 'ok')`,
							label: sql<string>`if(${isLow}, 'Low', 'In stock')`,
							count: count()
						})
						.from(productVariant)
						.$dynamic()
				)
					.where(buildWhere(query, spec, { except: 'stock' }))
					.groupBy(sql`1`, sql`2`)
		})
	]);

	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
