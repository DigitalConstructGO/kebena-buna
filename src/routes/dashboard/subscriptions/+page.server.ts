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
import {
	bagSize,
	customer,
	membership,
	product,
	productVariant,
	roastLevel,
	subscription
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { SUBSCRIPTION_FREQUENCIES, SUBSCRIPTION_STATUSES } from '#lib/constants.ts';

const FILTERS = ['status', 'frequency'] as const;
const left =
	sql<number>`(${subscription.deliveriesPurchased} - ${subscription.deliveriesUsed})`.mapWith(
		Number
	);
const SORTS = {
	number: subscription.number,
	customer: customer.name,
	nextRoastDate: subscription.nextRoastDate,
	left,
	createdAt: subscription.createdAt
};

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [isNull(subscription.deletedAt)],
	search: (term) =>
		or(
			like(subscription.number, `%${term}%`),
			like(customer.name, `%${term}%`),
			like(customer.phone, `%${term.replace(/^0/, '')}%`),
			like(productVariant.sku, `%${term}%`)
		),
	dateColumn: subscription.nextRoastDate,
	filters: {
		status: (v) =>
			(SUBSCRIPTION_STATUSES as readonly string[]).includes(v)
				? eq(subscription.status, v as (typeof SUBSCRIPTION_STATUSES)[number])
				: undefined,
		frequency: (v) =>
			(SUBSCRIPTION_FREQUENCIES as readonly string[]).includes(v)
				? eq(subscription.frequency, v as (typeof SUBSCRIPTION_FREQUENCIES)[number])
				: undefined
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.innerJoin(customer, eq(subscription.customerId, customer.id))
		.innerJoin(productVariant, eq(subscription.variantId, productVariant.id))
		.innerJoin(product, eq(productVariant.productId, product.id))
		.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
		.innerJoin(roastLevel, eq(subscription.roastLevelId, roastLevel.id))
		.leftJoin(membership, eq(subscription.membershipId, membership.id));

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: subscription.id,
					number: subscription.number,
					customerId: subscription.customerId,
					customer: customer.name,
					productId: product.id,
					coffee: sql<string>`concat(${enOf(product.name)}, ' · ', coalesce(${enOf(bagSize.name)}, ''))`,
					roast: enOf(roastLevel.name),
					quantity: subscription.quantity,
					frequency: subscription.frequency,
					status: subscription.status,
					nextRoastDate: subscription.nextRoastDate,
					left,
					membershipId: subscription.membershipId,
					membership: membership.number
				})
				.from(subscription)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(subscription.id)]))
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(subscription).$dynamic()).where(where),
		facetCounts({
			status: () =>
				joined(
					db.select({ value: subscription.status, count: count() }).from(subscription).$dynamic()
				)
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(subscription.status),
			frequency: () =>
				joined(
					db.select({ value: subscription.frequency, count: count() }).from(subscription).$dynamic()
				)
					.where(buildWhere(query, spec, { except: 'frequency' }))
					.groupBy(subscription.frequency)
		})
	]);
	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
