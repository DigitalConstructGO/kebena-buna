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
import { invoice, order, payment } from '#lib/server/db/schema.ts';
import { userAlias } from '#lib/server/people.ts';
import { PAYMENT_PROVIDERS, PAYMENT_STATUSES } from '#lib/constants.ts';

const FILTERS = ['provider', 'status'] as const;
const SORTS = { createdAt: payment.createdAt, paidAt: payment.paidAt, amount: payment.amount };
const recorder = userAlias('recorder');
const oneOf = <T extends readonly string[]>(list: T, v: string) =>
	(list as readonly string[]).includes(v) ? (v as T[number]) : undefined;

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	search: (term) =>
		or(
			like(payment.txRef, `%${term}%`),
			like(payment.providerRef, `%${term}%`),
			like(payment.reference, `%${term}%`),
			like(order.number, `%${term}%`),
			like(invoice.number, `%${term}%`)
		),
	dateColumn: payment.createdAt,
	filters: {
		provider: (v) => (oneOf(PAYMENT_PROVIDERS, v) ? eq(payment.provider, oneOf(PAYMENT_PROVIDERS, v)!) : undefined),
		status: (v) => (oneOf(PAYMENT_STATUSES, v) ? eq(payment.status, oneOf(PAYMENT_STATUSES, v)!) : undefined)
	}
};

/** Search reaches the order and invoice numbers, so every query joins them. */
const joined = <T extends MySqlSelect>(q: T) =>
	q.leftJoin(order, eq(payment.orderId, order.id)).leftJoin(invoice, eq(payment.invoiceId, invoice.id));

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets, [sums]] = await Promise.all([
		joined(
			db
				.select({
					id: payment.id,
					txRef: payment.txRef,
					provider: payment.provider,
					method: payment.method,
					status: payment.status,
					amount: payment.amount,
					fee: payment.fee,
					orderId: payment.orderId,
					orderNumber: order.number,
					invoiceId: payment.invoiceId,
					invoiceNumber: invoice.number,
					recordedById: payment.recordedBy,
					recordedBy: recorder.name,
					paidAt: payment.paidAt,
					createdAt: payment.createdAt
				})
				.from(payment)
				.leftJoin(recorder, eq(payment.recordedBy, recorder.id))
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(payment.createdAt)]))
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(payment).$dynamic()).where(where),
		facetCounts({
			provider: () =>
				joined(db.select({ value: payment.provider, count: count() }).from(payment).$dynamic())
					.where(buildWhere(query, spec, { except: 'provider' }))
					.groupBy(payment.provider),
			status: () =>
				joined(db.select({ value: payment.status, count: count() }).from(payment).$dynamic())
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(payment.status)
		}),
		joined(
			db
				.select({
					received: sql<number>`coalesce(sum(case when ${payment.status} = 'succeeded' then ${payment.amount} end), 0)`.mapWith(Number),
					fees: sql<number>`coalesce(sum(case when ${payment.status} = 'succeeded' then ${payment.fee} end), 0)`.mapWith(Number)
				})
				.from(payment)
				.$dynamic()
		).where(where)
	]);
	return {
		rows,
		sums,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
