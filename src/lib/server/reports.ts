/**
 * The reports of questionnaire 5.2, for one period: sales with VAT, best sellers, tickets and
 * check-ins, members and renewals, stock levels and value, roast yield, bookings and the inbox,
 * discount codes. Each block is read only when the viewer may open the records it sums.
 */
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, sql, sum } from 'drizzle-orm';
import { hasPermission } from '@nahu/admin-kit/server/permissions';
import { addLocalDays, isIsoDate, localDayRange, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import {
	audience,
	bagSize,
	booking,
	discountCode,
	discountRedemption,
	formSubmission,
	membership,
	membershipPlan,
	customer,
	order,
	orderLine,
	product,
	productVariant,
	refund,
	roastBatch,
	roastLevel,
	subscription,
	ticket
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { dayLabel, lowStockCount, netSales, netVat, paidDay, soldOrder } from '#lib/server/dashboard.ts';
import type { ReportChartData, Stat } from '@nahu/admin-kit/components/reports/types';

const n = (v: unknown) => Number(v ?? 0);

/** The period from the URL, or this month so far. */
export function periodOf(url: URL) {
	const today = localToday();
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const period = {
		from: isIsoDate(from) ? from : `${today.slice(0, 8)}01`,
		to: isIsoDate(to) ? to : today
	};
	return period.from > period.to ? { from: period.to, to: period.from } : period;
}

const LINE_GROUP: Record<string, string> = {
	product: 'Shop',
	custom: 'Shop',
	subscription_bundle: 'Subscriptions',
	ticket: 'Tickets',
	event_ticket: 'Tickets',
	ticket_upgrade: 'Tickets',
	booking: 'Bookings',
	membership: 'Memberships'
};

export async function reportData(locals: App.Locals, period: { from: string; to: string }) {
	const start = localDayRange(period.from).start;
	const end = localDayRange(period.to).end;
	const may = (p: string) => hasPermission(locals, p);
	// Sales as the home page counts them (`soldOrder`, net of refunds), paid in the period.
	const paidIn = and(soldOrder(), gte(order.paidAt, start), lt(order.paidAt, end));

	const out = {
		period,
		sales: null as null | {
			stats: Stat[];
			byGroup: { group: string; lines: number; revenue: number; vat: number }[];
			byDay: ReportChartData;
		},
		bestSellers: [] as {
			variantId: number | null;
			product: string;
			size: string | null;
			roast: string | null;
			bags: number;
			revenue: number;
		}[],
		visits: null as null | {
			stats: Stat[];
			byDay: ReportChartData;
			byAudience: { audience: string; tickets: number; admits: number; checkedIn: number }[];
		},
		members: null as null | {
			stats: Stat[];
			renewals: {
				id: number;
				number: string;
				customerId: number;
				customer: string | null;
				plan: string;
				endsOn: string | null;
				status: string;
			}[];
		},
		stock: null as null | { stats: Stat[] },
		roasts: [] as {
			id: number;
			code: string;
			roastedAt: Date;
			roast: string;
			greenKgIn: number;
			roastedKgOut: number;
			weightLossPct: number | null;
			lots: string | null;
		}[],
		workflow: null as null | { bookings: { status: string; count: number }[]; submissions: { status: string; count: number }[] },
		discounts: [] as { id: number; code: string; kind: string; uses: number; discount: number; orders: number }[]
	};

	const tasks: Promise<void>[] = [];

	if (may('orders.view')) {
		tasks.push(
			(async () => {
				const [[totals], [refunds], groups, days] = await Promise.all([
					db
						.select({ orders: count(), total: netSales(), vat: netVat(), discount: sum(order.discountTotal), delivery: sum(order.deliveryFee) })
						.from(order)
						.where(paidIn),
					db
						.select({ amount: sum(refund.amount) })
						.from(refund)
						.where(and(eq(refund.status, 'succeeded'), gte(refund.processedAt, start), lt(refund.processedAt, end))),
					db
						.select({
							itemType: orderLine.itemType,
							lines: sql<string>`sum(${orderLine.quantity} - ${orderLine.refundedQuantity})`,
							revenue: sql<string>`sum(${orderLine.lineTotal} - ${orderLine.refundedAmount})`,
							vat: sql<string>`sum(case when ${orderLine.lineTotal} > 0 then ${orderLine.taxAmount} * (${orderLine.lineTotal} - ${orderLine.refundedAmount}) / ${orderLine.lineTotal} else 0 end)`
						})
						.from(orderLine)
						.innerJoin(order, eq(orderLine.orderId, order.id))
						.where(paidIn)
						.groupBy(orderLine.itemType),
					db
						.select({ day: paidDay(), total: netSales(), vat: netVat() })
						.from(order)
						.where(paidIn)
						.groupBy(paidDay())
						.orderBy(paidDay())
				]);
				const byGroup = new Map<string, { group: string; lines: number; revenue: number; vat: number }>();
				for (const g of groups) {
					const name = LINE_GROUP[g.itemType] ?? 'Other';
					const row = byGroup.get(name) ?? { group: name, lines: 0, revenue: 0, vat: 0 };
					row.lines += n(g.lines);
					row.revenue += n(g.revenue);
					row.vat += n(g.vat);
					byGroup.set(name, row);
				}
				const dayList: string[] = [];
				for (let d = period.from; d <= period.to && dayList.length < 400; d = addLocalDays(d, 1)) dayList.push(d);
				const totalsByDay = new Map(days.map((d) => [String(d.day).slice(0, 10), d]));
				out.sales = {
					stats: [
						{ key: 'revenue', label: 'Sales (VAT included)', value: n(totals?.total), format: 'money', group: 'sales', tone: 'positive', hint: `${n(totals?.orders)} paid orders, after refunds` },
						{ key: 'vat', label: 'VAT collected', value: n(totals?.vat), format: 'money', group: 'sales' },
						{ key: 'net', label: 'Sales before VAT', value: n(totals?.total) - n(totals?.vat), format: 'money', group: 'sales' },
						{ key: 'discounts', label: 'Discounts given', value: n(totals?.discount), format: 'money', group: 'sales', tone: 'neutral' },
						{ key: 'refunds', label: 'Refunded', value: n(refunds?.amount), format: 'money', group: 'sales', tone: 'negative', hint: 'Paid back in the period' }
					],
					byGroup: [...byGroup.values()].sort((a, b) => b.revenue - a.revenue),
					byDay: {
						key: 'salesByDay',
						title: 'Sales by day',
						group: 'sales',
						kind: 'bar',
						money: true,
						stacked: true,
						wide: true,
						labels: dayList.map(dayLabel),
						series: [
							{ label: 'Before VAT', data: dayList.map((d) => n(totalsByDay.get(d)?.total) - n(totalsByDay.get(d)?.vat)) },
							{ label: 'VAT', data: dayList.map((d) => n(totalsByDay.get(d)?.vat)) }
						]
					}
				};
				out.bestSellers = await db
					.select({
						variantId: orderLine.variantId,
						product: enOf(product.name),
						size: sql<string | null>`coalesce(${enOf(bagSize.name)}, ${enOf(productVariant.name)})`,
						roast: enOf(roastLevel.name),
						bags: sql<number>`sum(${orderLine.quantity} - ${orderLine.refundedQuantity})`.mapWith(Number),
						revenue: sql<number>`sum(${orderLine.lineTotal} - ${orderLine.refundedAmount})`.mapWith(Number)
					})
					.from(orderLine)
					.innerJoin(order, eq(orderLine.orderId, order.id))
					.innerJoin(productVariant, eq(orderLine.variantId, productVariant.id))
					.innerJoin(product, eq(productVariant.productId, product.id))
					.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
					.leftJoin(roastLevel, eq(orderLine.roastLevelId, roastLevel.id))
					.where(and(paidIn, eq(orderLine.itemType, 'product')))
					.groupBy(orderLine.variantId, product.name, bagSize.name, productVariant.name, roastLevel.name)
					.orderBy(desc(sql`sum(${orderLine.quantity} - ${orderLine.refundedQuantity})`))
					.limit(15);
			})()
		);
	}

	if (may('orders.view')) {
		tasks.push(
			(async () => {
				out.discounts = await db
					.select({
						id: discountCode.id,
						code: discountCode.code,
						kind: discountCode.kind,
						uses: sql<number>`count(*)`.mapWith(Number),
						discount: sql<number>`sum(${discountRedemption.amount})`.mapWith(Number),
						orders: sql<number>`count(distinct ${discountRedemption.orderId})`.mapWith(Number)
					})
					.from(discountRedemption)
					.innerJoin(discountCode, eq(discountRedemption.discountCodeId, discountCode.id))
					.where(and(gte(discountRedemption.createdAt, start), lt(discountRedemption.createdAt, end)))
					.groupBy(discountCode.id, discountCode.code, discountCode.kind)
					.orderBy(desc(sql`count(*)`));
			})()
		);
	}

	if (may('visits.view')) {
		tasks.push(
			(async () => {
				const live = and(gte(ticket.visitDate, period.from), lte(ticket.visitDate, period.to), inArray(ticket.status, ['valid', 'used']));
				const [[t], days, byAudience] = await Promise.all([
					db.select({ tickets: count(), admits: sum(ticket.admits), checkedIn: sum(ticket.checkedIn) }).from(ticket).where(live),
					db
						.select({ day: ticket.visitDate, code: audience.code, name: enOf(audience.name), admits: sum(ticket.admits) })
						.from(ticket)
						.innerJoin(audience, eq(ticket.audienceId, audience.id))
						.where(live)
						.groupBy(ticket.visitDate, audience.code, audience.name)
						.orderBy(asc(ticket.visitDate)),
					db
						.select({ audience: enOf(audience.name), tickets: count(), admits: sum(ticket.admits), checkedIn: sum(ticket.checkedIn) })
						.from(ticket)
						.innerJoin(audience, eq(ticket.audienceId, audience.id))
						.where(live)
						.groupBy(audience.id, audience.name)
				]);
				const labels = [...new Set(days.map((d) => String(d.day)))];
				const codes = [...new Set(days.map((d) => d.code))];
				// The legend names the audience ("Foreign visitor"), not its code ("FOR").
				const nameOf = new Map(days.map((d) => [d.code, d.name || d.code]));
				out.visits = {
					stats: [
						{ key: 'visitors', label: 'Visitors booked', value: n(t?.admits), format: 'count', group: 'visits', hint: `${n(t?.tickets)} tickets` },
						{ key: 'checkedIn', label: 'Checked in', value: n(t?.checkedIn), format: 'count', group: 'visits', tone: 'positive' },
						{
							key: 'showRate',
							label: 'Turned up',
							value: n(t?.admits) ? Math.round((n(t?.checkedIn) / n(t?.admits)) * 100) : 0,
							format: 'percent',
							group: 'visits'
						}
					],
					byDay: {
						key: 'visitsByDay',
						title: 'Visitors by day, resident and foreign',
						group: 'visits',
						kind: 'bar',
						stacked: true,
						wide: true,
						labels: labels.map(dayLabel),
						series: codes.map((code) => ({
							label: nameOf.get(code) ?? code,
							data: labels.map((d) => n(days.find((x) => String(x.day) === d && x.code === code)?.admits))
						}))
					},
					byAudience: byAudience.map((a) => ({ audience: a.audience, tickets: n(a.tickets), admits: n(a.admits), checkedIn: n(a.checkedIn) }))
				};
			})()
		);
	}

	if (may('memberships.view')) {
		tasks.push(
			(async () => {
				const soon = addLocalDays(localToday(), 30);
				const [[active], [subs], renewals] = await Promise.all([
					db.select({ c: count() }).from(membership).where(and(inArray(membership.status, ['active', 'grace']), isNull(membership.deletedAt))),
					db.select({ c: count() }).from(subscription).where(and(eq(subscription.status, 'active'), isNull(subscription.deletedAt))),
					db
						.select({
							id: membership.id,
							number: membership.number,
							customerId: membership.customerId,
							customer: customer.name,
							plan: enOf(membershipPlan.name),
							endsOn: membership.endsOn,
							status: membership.status
						})
						.from(membership)
						.innerJoin(membershipPlan, eq(membership.planId, membershipPlan.id))
						.innerJoin(customer, eq(membership.customerId, customer.id))
						.where(and(inArray(membership.status, ['active', 'grace']), lte(membership.endsOn, soon), isNull(membership.deletedAt)))
						.orderBy(asc(membership.endsOn))
				]);
				out.members = {
					stats: [
						{ key: 'members', label: 'Active members', value: n(active?.c), format: 'count', group: 'members' },
						{ key: 'subs', label: 'Active subscriptions', value: n(subs?.c), format: 'count', group: 'members' },
						{ key: 'renewals', label: 'Renewals due in 30 days', value: renewals.length, format: 'count', group: 'members', tone: renewals.length ? 'warning' : 'neutral' }
					],
					renewals
				};
			})()
		);
	}

	if (may('stock.view')) {
		tasks.push(
			(async () => {
				const scalar = async (q: ReturnType<typeof sql>) => n(((await db.execute(q)) as unknown as [Record<string, unknown>[]])[0]?.[0]?.v);
				const [low, greenKg, roastedKg, packedUnits, greenValue, roastedValue, packedValue] = await Promise.all([
					lowStockCount(),
					scalar(sql`select coalesce(sum(kg), 0) v from green_stock`),
					scalar(sql`select coalesce(sum(kg), 0) v from roasted_stock`),
					scalar(sql`select coalesce(sum(units), 0) v from packed_stock`),
					scalar(sql`select coalesce(sum(kg * cost_per_kg), 0) v from green_stock`),
					// Roasted and packed stock carry the unit cost their roast or packing movement recorded.
					scalar(sql`select coalesce(sum(rs.kg * coalesce((select max(m.unit_cost) from stock_movement m where m.roast_batch_id = rs.roast_batch_id and m.reason = 'roast_output'), 0)), 0) v from roasted_stock rs`),
					scalar(sql`select coalesce(sum(ps.units * coalesce((select max(m.unit_cost) from stock_movement m where m.packing_run_id = ps.packing_run_id and m.reason = 'pack_output'), 0)), 0) v from packed_stock ps`)
				]);
				out.stock = {
					stats: [
						{ key: 'greenKg', label: 'Green coffee (kg)', value: greenKg, format: 'count', group: 'stock' },
						{ key: 'roastedKg', label: 'Roasted coffee (kg)', value: roastedKg, format: 'count', group: 'stock' },
						{ key: 'packedUnits', label: 'Packed bags', value: packedUnits, format: 'count', group: 'stock' },
						{ key: 'low', label: 'Low stock', value: low, format: 'count', group: 'stock', tone: low ? 'warning' : 'positive', hint: 'Lots, roasted coffee and bag sizes under their level' },
						{ key: 'value', label: 'Stock value', value: greenValue + roastedValue + packedValue, format: 'money', group: 'stock', hint: `Green ${Math.round(greenValue).toLocaleString()} · roasted ${Math.round(roastedValue).toLocaleString()} · packed ${Math.round(packedValue).toLocaleString()}` }
					]
				};
				out.roasts = await db
					.select({
						id: roastBatch.id,
						code: roastBatch.code,
						roastedAt: roastBatch.roastedAt,
						roast: enOf(roastLevel.name),
						greenKgIn: roastBatch.greenKgIn,
						roastedKgOut: roastBatch.roastedKgOut,
						weightLossPct: roastBatch.weightLossPct,
						lots: sql<string | null>`(select group_concat(l.code separator ', ') from roast_batch_input i join lot l on l.id = i.lot_id where i.roast_batch_id = ${roastBatch.id})`
					})
					.from(roastBatch)
					.innerJoin(roastLevel, eq(roastBatch.roastLevelId, roastLevel.id))
					.where(and(gte(roastBatch.roastedAt, start), lt(roastBatch.roastedAt, end), isNull(roastBatch.deletedAt)))
					.orderBy(desc(roastBatch.roastedAt));
			})()
		);
	}

	if (may('bookings.view') || may('inbox.view')) {
		tasks.push(
			(async () => {
				const [bookings, submissions] = await Promise.all([
					may('bookings.view')
						? db
								.select({ status: booking.status, count: count() })
								.from(booking)
								.where(and(gte(booking.createdAt, start), lt(booking.createdAt, end), isNull(booking.deletedAt)))
								.groupBy(booking.status)
						: Promise.resolve([]),
					may('inbox.view')
						? db
								.select({ status: formSubmission.status, count: count() })
								.from(formSubmission)
								.where(and(gte(formSubmission.submittedAt, start), lt(formSubmission.submittedAt, end), isNull(formSubmission.deletedAt)))
								.groupBy(formSubmission.status)
						: Promise.resolve([])
				]);
				out.workflow = { bookings, submissions };
			})()
		);
	}

	await Promise.all(tasks);
	return out;
}
