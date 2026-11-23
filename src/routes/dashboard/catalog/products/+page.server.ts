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
import { product, productCategory } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { creator } from '#lib/server/people.ts';
import { fromPriceOf, packedUnitsOfProduct, variantCountOf } from '#lib/server/catalog.ts';
import { FULFILMENT_MODES, PRODUCT_KINDS, PUBLISH_STATUSES } from '#lib/constants.ts';

const FILTERS = ['categoryId', 'kind', 'publishStatus', 'fulfilment'] as const;
const SORTS = {
	name: enOf(product.name),
	sortOrder: product.sortOrder,
	fromPrice: fromPriceOf,
	packed: packedUnitsOfProduct,
	createdAt: product.createdAt
};

const oneOf = <T extends readonly string[]>(list: T, v: string): v is T[number] =>
	(list as readonly string[]).includes(v);

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [isNull(product.deletedAt)],
	search: (term) =>
		or(
			like(product.name, `%${term}%`),
			like(product.slug, `%${term}%`),
			like(product.tastingNotes, `%${term}%`)
		),
	dateColumn: product.createdAt,
	filters: {
		categoryId: (v) => eq(product.categoryId, Number(v)),
		kind: (v) => (oneOf(PRODUCT_KINDS, v) ? eq(product.kind, v) : undefined),
		publishStatus: (v) => (oneOf(PUBLISH_STATUSES, v) ? eq(product.publishStatus, v) : undefined),
		fulfilment: (v) => (oneOf(FULFILMENT_MODES, v) ? eq(product.fulfilment, v) : undefined)
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.leftJoin(productCategory, eq(product.categoryId, productCategory.id))
		.leftJoin(creator, eq(product.createdBy, creator.id));

export const load = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const tally = (key: (typeof FILTERS)[number], column: typeof product.kind | typeof product.publishStatus | typeof product.fulfilment) =>
		() =>
			db
				.select({ value: column, count: count() })
				.from(product)
				.where(buildWhere(query, spec, { except: key }))
				.groupBy(column);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: product.id,
					name: enOf(product.name),
					slug: product.slug,
					kind: product.kind,
					categoryId: product.categoryId,
					category: enOf(productCategory.name),
					fulfilment: product.fulfilment,
					publishStatus: product.publishStatus,
					variants: variantCountOf,
					fromPrice: fromPriceOf,
					packed: packedUnitsOfProduct,
					isActive: product.isActive,
					createdById: product.createdBy,
					createdBy: creator.name,
					createdAt: product.createdAt
				})
				.from(product)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [product.sortOrder, desc(product.id)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(product).where(where),
		facetCounts({
			categoryId: () =>
				db
					.select({ value: productCategory.id, label: enOf(productCategory.name), count: count() })
					.from(product)
					.innerJoin(productCategory, eq(product.categoryId, productCategory.id))
					.where(buildWhere(query, spec, { except: 'categoryId' }))
					.groupBy(productCategory.id),
			kind: tally('kind', product.kind),
			publishStatus: tally('publishStatus', product.publishStatus),
			fulfilment: tally('fulfilment', product.fulfilment)
		})
	]);

	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) },
		canManage: hasPermission(locals, 'catalog.manage')
	};
};
