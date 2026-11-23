import { count, desc, eq, like, or, sql } from 'drizzle-orm';
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
import { customer, order, refund } from '#lib/server/db/schema.ts';
import { userAlias } from '#lib/server/people.ts';
import { REFUND_STATUSES } from '#lib/constants.ts';

const FILTERS = ['status'] as const;
const SORTS = { createdAt: refund.createdAt, amount: refund.amount };
const requester = userAlias('requester');
const approver = userAlias('approver');

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	search: (term) =>
		or(
			like(order.number, `%${term}%`),
			like(refund.reason, `%${term}%`),
			like(customer.name, `%${term}%`)
		),
	dateColumn: refund.createdAt,
	filters: {
		status: (v) =>
			(REFUND_STATUSES as readonly string[]).includes(v)
				? eq(refund.status, v as (typeof REFUND_STATUSES)[number])
				: undefined
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.innerJoin(order, eq(refund.orderId, order.id))
		.innerJoin(customer, eq(order.customerId, customer.id));

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets, [sums]] = await Promise.all([
		joined(
			db
				.select({
					id: refund.id,
					createdAt: refund.createdAt,
					orderId: refund.orderId,
					orderNumber: order.number,
					customerId: order.customerId,
					customer: customer.name,
					status: refund.status,
					reason: refund.reason,
					toStoreCredit: refund.toStoreCredit,
					amount: refund.amount,
					requestedById: refund.requestedBy,
					requestedBy: requester.name,
					approvedById: refund.approvedBy,
					approvedBy: approver.name
				})
				.from(refund)
				.leftJoin(requester, eq(refund.requestedBy, requester.id))
				.leftJoin(approver, eq(refund.approvedBy, approver.id))
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(refund.createdAt)]))
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(refund).$dynamic()).where(where),
		facetCounts({
			status: () =>
				joined(db.select({ value: refund.status, count: count() }).from(refund).$dynamic())
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(refund.status)
		}),
		db
			.select({
				waiting: sql<number>`sum(${refund.status} = 'requested')`.mapWith(Number),
				refunded:
					sql<number>`coalesce(sum(case when ${refund.status} = 'succeeded' then ${refund.amount} end), 0)`.mapWith(
						Number
					)
			})
			.from(refund)
	]);
	return {
		rows,
		sums,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
