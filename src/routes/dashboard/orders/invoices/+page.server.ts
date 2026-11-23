import { count, desc, eq, like, or, sql } from 'drizzle-orm';
import type { MySqlSelect } from 'drizzle-orm/mysql-core';
import { localToday } from '@nahu/admin-kit/time';
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
import { businessAccount, customer, invoice, order } from '#lib/server/db/schema.ts';
import { INVOICE_STATUSES } from '#lib/constants.ts';

const FILTERS = ['status'] as const;
const SORTS = {
	number: invoice.number,
	issuedAt: invoice.issuedAt,
	dueOn: invoice.dueOn,
	total: invoice.total
};

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	search: (term) =>
		or(
			like(invoice.number, `%${term}%`),
			like(invoice.billingName, `%${term}%`),
			like(invoice.billingTin, `%${term}%`),
			like(order.number, `%${term}%`)
		),
	dateColumn: invoice.issuedAt,
	filters: {
		status: (v) =>
			(INVOICE_STATUSES as readonly string[]).includes(v)
				? eq(invoice.status, v as (typeof INVOICE_STATUSES)[number])
				: undefined
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.innerJoin(customer, eq(invoice.customerId, customer.id))
		.leftJoin(businessAccount, eq(invoice.businessAccountId, businessAccount.id))
		.leftJoin(order, eq(invoice.orderId, order.id));

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets, [sums]] = await Promise.all([
		joined(
			db
				.select({
					id: invoice.id,
					number: invoice.number,
					status: invoice.status,
					billingName: invoice.billingName,
					customerId: invoice.customerId,
					customer: customer.name,
					businessId: invoice.businessAccountId,
					business: businessAccount.name,
					orderId: invoice.orderId,
					orderNumber: order.number,
					issuedAt: invoice.issuedAt,
					dueOn: invoice.dueOn,
					total: invoice.total,
					amountPaid: invoice.amountPaid
				})
				.from(invoice)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(invoice.id)]))
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(invoice).$dynamic()).where(where),
		facetCounts({
			status: () =>
				joined(db.select({ value: invoice.status, count: count() }).from(invoice).$dynamic())
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(invoice.status)
		}),
		db
			.select({
				outstanding:
					sql<number>`coalesce(sum(case when ${invoice.status} in ('open','overdue') then ${invoice.total} - ${invoice.amountPaid} end), 0)`.mapWith(
						Number
					),
				overdue:
					sql<number>`coalesce(sum(case when ${invoice.status} = 'overdue' or (${invoice.status} = 'open' and ${invoice.dueOn} < ${localToday()}) then 1 end), 0)`.mapWith(
						Number
					)
			})
			.from(invoice)
	]);
	return {
		rows,
		sums,
		today: localToday(),
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
