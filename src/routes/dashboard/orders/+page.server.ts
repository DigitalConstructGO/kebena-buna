import { and, count, desc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm';
import { z } from 'zod/v4';
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
import { bad, ok, parse } from '@nahu/admin-kit/server/actionResults';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import { businessAccount, customer, order, orderLine } from '#lib/server/db/schema.ts';
import { moveOrder, nextStatuses } from '#lib/server/orders.ts';
import { userAlias } from '#lib/server/people.ts';
import { TO_FULFIL } from '#lib/server/dashboard.ts';
import { DELIVERY_METHODS, ORDER_STATUSES, PAYMENT_STATES, SALES_CHANNELS, type OrderStatus } from '#lib/constants.ts';

/** `open=1` is the home page's "Orders to fulfil": every status that still needs hands on it. */
const FILTERS = ['status', 'paymentState', 'channel', 'deliveryMethod', 'open'] as const;
const SORTS = { number: order.number, placedAt: order.placedAt, total: order.total, status: order.status };
const rider = userAlias('rider');

/** Only values from the list the column is typed by reach the `WHERE`. */
const oneOf = <T extends readonly string[]>(list: T, v: string) =>
	(list as readonly string[]).includes(v) ? (v as T[number]) : undefined;

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [isNull(order.deletedAt)],
	search: (term) =>
		or(
			like(order.number, `%${term}%`),
			like(order.contactName, `%${term}%`),
			like(order.contactPhone, `%${term.replace(/^0/, '')}%`),
			like(order.contactEmail, `%${term}%`),
			like(order.receiptNumber, `%${term}%`)
		),
	dateColumn: order.placedAt,
	filters: {
		status: (v) => (oneOf(ORDER_STATUSES, v) ? eq(order.status, oneOf(ORDER_STATUSES, v)!) : undefined),
		paymentState: (v) => (oneOf(PAYMENT_STATES, v) ? eq(order.paymentState, oneOf(PAYMENT_STATES, v)!) : undefined),
		channel: (v) => (oneOf(SALES_CHANNELS, v) ? eq(order.channel, oneOf(SALES_CHANNELS, v)!) : undefined),
		deliveryMethod: (v) =>
			oneOf(DELIVERY_METHODS, v) ? eq(order.deliveryMethod, oneOf(DELIVERY_METHODS, v)!) : undefined,
		open: (v) => (v === '1' ? inArray(order.status, TO_FULFIL) : undefined)
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.innerJoin(customer, eq(order.customerId, customer.id))
		.leftJoin(businessAccount, eq(order.businessAccountId, businessAccount.id))
		.leftJoin(rider, eq(order.riderId, rider.id));

/** One facet's tally over its own column. */
const tally = (column: typeof order.status | typeof order.paymentState | typeof order.channel | typeof order.deliveryMethod, where: ReturnType<typeof buildWhere>) =>
	db.select({ value: column, count: count() }).from(order).where(where).groupBy(column);

export const load = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets, [sums]] = await Promise.all([
		joined(
			db
				.select({
					id: order.id,
					number: order.number,
					placedAt: order.placedAt,
					channel: order.channel,
					customerId: order.customerId,
					customer: sql<string>`coalesce(${customer.name}, ${order.contactName}, 'Guest')`,
					businessId: order.businessAccountId,
					business: businessAccount.name,
					status: order.status,
					paymentState: order.paymentState,
					deliveryMethod: order.deliveryMethod,
					riderId: order.riderId,
					rider: rider.name,
					total: order.total,
					amountPaid: order.amountPaid
				})
				.from(order)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(order.placedAt)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(order).where(where),
		facetCounts({
			status: () => tally(order.status, buildWhere(query, spec, { except: 'status' })),
			paymentState: () => tally(order.paymentState, buildWhere(query, spec, { except: 'paymentState' })),
			channel: () => tally(order.channel, buildWhere(query, spec, { except: 'channel' })),
			deliveryMethod: () => tally(order.deliveryMethod, buildWhere(query, spec, { except: 'deliveryMethod' }))
		}),
		db
			.select({
				total: sql<number>`coalesce(sum(${order.total}), 0)`.mapWith(Number),
				paid: sql<number>`coalesce(sum(${order.amountPaid} - ${order.amountRefunded}), 0)`.mapWith(Number)
			})
			.from(order)
			.where(where)
	]);

	return {
		rows,
		sums,
		canManage: hasPermission(locals, 'orders.manage'),
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};

/**
 * The packing bench's steps, for many orders at once. Each order goes to its own next status for
 * the step — "sent" is out for delivery for a rider or courier, ready for pickup for a pickup —
 * through the same `moveOrder` as the order page, so its history and audit are written the same
 * way. An order the step does not fit is left as it is and named in the answer.
 */
const BULK_STEPS = {
	packed: { label: 'packed', to: (_o: { status: string }, next: OrderStatus[]) => (next.includes('packed') ? 'packed' : null) },
	sent: {
		label: 'sent',
		to: (o: { status: string }, next: OrderStatus[]) =>
			o.status === 'packed' ? (next.find((s) => s === 'out_for_delivery' || s === 'ready_for_pickup' || s === 'completed') ?? null) : null
	},
	delivered: {
		label: 'delivered or collected',
		to: (o: { status: string }, next: OrderStatus[]) => (next.find((s) => s === 'delivered' || s === 'collected') ?? null)
	}
} as const;

const bulkSchema = z.object({
	step: z.enum(['packed', 'sent', 'delivered']),
	ids: z
		.string()
		.transform((v) => [...new Set(v.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))])
		.refine((ids) => ids.length > 0 && ids.length <= 200, 'Pick between 1 and 200 orders')
});

export const actions = {
	bulk: async (event) => {
		requirePermission(event.locals, 'orders.manage');
		const p = await parse(event.request, bulkSchema);
		if ('error' in p) return p.error;
		const step = BULK_STEPS[p.data.step];
		const orders = await db
			.select()
			.from(order)
			.where(and(inArray(order.id, p.data.ids), isNull(order.deletedAt)));
		const roasted = new Set(
			(
				await db
					.selectDistinct({ id: orderLine.orderId })
					.from(orderLine)
					.where(and(inArray(orderLine.orderId, p.data.ids), eq(orderLine.fulfilment, 'roast_to_order')))
			).map((r) => r.id)
		);

		let moved = 0;
		const skipped: string[] = [];
		for (const o of orders) {
			const to = step.to(o, nextStatuses(o, roasted.has(o.id)));
			if (!to) {
				skipped.push(o.number);
				continue;
			}
			try {
				// One transaction per order: one that cannot move does not hold back the rest.
				await db.transaction((tx) => moveOrder(tx, event, o, to));
				moved++;
			} catch (err) {
				if (!(err instanceof WriteRefused)) throw err;
				skipped.push(o.number);
			}
		}

		const done = `${moved} ${moved === 1 ? 'order' : 'orders'} marked ${step.label}`;
		if (!skipped.length) return ok(done);
		const list = skipped.slice(0, 5).join(', ') + (skipped.length > 5 ? ` and ${skipped.length - 5} more` : '');
		const why = `${skipped.length} left as they were (${list}): not at that step.`;
		return moved ? ok(`${done}. ${why}`) : bad(`No orders moved. ${why}`);
	}
};
