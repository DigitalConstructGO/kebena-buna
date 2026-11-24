/**
 * The home page's figures. Each is read only when the viewer may open the section it counts, so a
 * roaster's home shows stock and roasting, a front-desk clerk's tickets and bookings, and nobody
 * is shown a number for a page they would be refused.
 */
import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lt, sql, sum } from 'drizzle-orm';
import { hasPermission } from '@nahu/admin-kit/server/permissions';
import { addLocalDays, localDayRange, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import {
	bagSize,
	bookable,
	businessAccount,
	booking,
	bookingSession,
	customer,
	formSubmission,
	membership,
	order,
	orderLine,
	payment,
	product,
	productVariant,
	refund,
	roastLevel,
	ticket,
	visitDay
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { lowStock, stockLevels } from '#lib/server/stockReads.ts';
import type { Stat, ReportChartData } from '@nahu/admin-kit/components/reports/types';

/** Orders that have been paid and still need hands on them. */
export const TO_FULFIL = [
	'paid',
	'roasting',
	'packed',
	'ready_for_pickup',
	'out_for_delivery'
] as const;

/**
 * What "sales" means here and in Reports alike: orders that were paid (refunded ones included, so a
 * refund lowers the figure rather than hiding the order), not deleted, net of what was refunded on
 * them, dated by when they were paid.
 */
const SOLD = ['paid', 'partially_refunded', 'refunded'] as const;
export const soldOrder = () => and(inArray(order.paymentState, SOLD), isNull(order.deletedAt));
export const netSales = () => sql<string>`sum(${order.total} - ${order.amountRefunded})`;
/** The VAT inside `netSales`: each order's VAT in proportion to what it kept. */
export const netVat = () =>
	sql<string>`sum(case when ${order.total} > 0 then ${order.taxTotal} * (${order.total} - ${order.amountRefunded}) / ${order.total} else 0 end)`;
/**
 * The local (Addis Ababa, UTC+3 all year) date an order was paid. The connection runs in UTC, so a
 * plain `date(paid_at)` would put a sale at 01:00 on the day before.
 */
export const paidDay = () => sql<string>`date(convert_tz(${order.paidAt}, '+00:00', '+03:00'))`;

const n = (v: unknown) => Number(v ?? 0);

/** A chart's day as "22 Oct": the axis already says which month range it covers. */
export const dayLabel = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});

/** "last Tuesday" — what today's figure is set against. */
const sameDayLastWeek = (iso: string) =>
	`last ${new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}`;

/**
 * How many things are under their low-stock level — green lots, roasted coffee and bag sizes — as
 * the stock page lists them (`lowStock`), sold-out ones included.
 */
export const lowStockCount = async () => (await lowStock(await stockLevels())).length;

export async function homeData(locals: App.Locals) {
	const today = localToday();
	const { start, end } = localDayRange(today);
	const monthAgo = addLocalDays(today, -29);
	// Today and the six days after it: seven local days.
	const weekAhead = localDayRange(addLocalDays(today, 6)).end;
	const may = (p: string) => hasPermission(locals, p);

	const stats: Stat[] = [];
	const charts: ReportChartData[] = [];
	const days = Array.from({ length: 30 }, (_, i) => addLocalDays(monthAgo, i));
	const weekAgo = addLocalDays(today, -7);
	const D = '/dashboard';

	const tasks: Promise<unknown>[] = [];

	let waiting: {
		id: number;
		number: string;
		status: string;
		placedAt: Date;
		paidAt: Date | null;
		total: number;
		customerId: number;
		customer: string | null;
		deliveryMethod: string;
	}[] = [];
	let roastQueue: {
		roastOn: string | null;
		variantId: number | null;
		productId: number;
		roastLevelId: number | null;
		product: string;
		size: string | null;
		roast: string | null;
		bags: number;
		orders: number;
	}[] = [];
	let sessions: {
		id: number;
		startsAt: Date;
		bookableId: number;
		bookable: string;
		booked: number;
		capacity: number;
		language: string | null;
	}[] = [];

	if (may('orders.view')) {
		tasks.push(
			(async () => {
				// Today so far against the same hours a week ago, not a whole day against a part of one.
				const sameTimeLastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
				const [[sales], [salesLastWeek], [toFulfil], byDay] = await Promise.all([
					db
						.select({ total: netSales(), orders: count() })
						.from(order)
						.where(and(soldOrder(), gte(order.paidAt, start), lt(order.paidAt, end))),
					db
						.select({ total: netSales() })
						.from(order)
						.where(
							and(
								soldOrder(),
								gte(order.paidAt, localDayRange(weekAgo).start),
								lt(order.paidAt, sameTimeLastWeek)
							)
						),
					db
						.select({ c: count() })
						.from(order)
						.where(and(inArray(order.status, TO_FULFIL), isNull(order.deletedAt))),
					db
						.select({ day: paidDay(), total: netSales() })
						.from(order)
						.where(
							and(
								soldOrder(),
								gte(order.paidAt, localDayRange(monthAgo).start),
								lt(order.paidAt, end)
							)
						)
						.groupBy(paidDay())
				]);
				stats.push(
					{
						key: 'sales',
						label: 'Sales today',
						value: n(sales?.total),
						format: 'money',
						group: 'sales',
						hint: `${n(sales?.orders)} paid orders, after refunds`,
						tone: 'positive',
						href: `${D}/orders?dateStart=${today}&dateEnd=${today}`,
						compare: {
							value: n(salesLastWeek?.total),
							label: `this time ${sameDayLastWeek(weekAgo)}`
						}
					},
					{
						key: 'fulfil',
						label: 'Orders to fulfil',
						value: n(toFulfil?.c),
						format: 'count',
						group: 'sales',
						hint: 'Paid, roasting, packed or on the way',
						tone: n(toFulfil?.c) ? 'warning' : 'neutral',
						href: `${D}/orders?open=1`
					}
				);
				const totals = new Map(byDay.map((r) => [String(r.day).slice(0, 10), n(r.total)]));
				charts.push({
					key: 'sales',
					title: 'Sales, last 30 days',
					group: 'sales',
					kind: 'bar',
					money: true,
					labels: days.map(dayLabel),
					series: [{ label: 'Sales (ETB)', data: days.map((d) => totals.get(d) ?? 0) }]
				});
				waiting = await db
					.select({
						id: order.id,
						number: order.number,
						status: order.status,
						placedAt: order.placedAt,
						paidAt: order.paidAt,
						total: order.total,
						customerId: order.customerId,
						customer: customer.name,
						deliveryMethod: order.deliveryMethod
					})
					.from(order)
					.innerJoin(customer, eq(order.customerId, customer.id))
					.where(and(inArray(order.status, TO_FULFIL), isNull(order.deletedAt)))
					.orderBy(asc(order.paidAt))
					.limit(8);
			})()
		);
	}

	if (may('stock.view')) {
		tasks.push(
			(async () => {
				const low = await lowStockCount();
				stats.push({
					key: 'low',
					label: 'Low stock',
					value: low,
					format: 'count',
					group: 'stock',
					hint: 'Lots, roasted coffee and bag sizes under their level',
					tone: low ? 'warning' : 'positive',
					href: `${D}/stock`
				});
				roastQueue = await db
					.select({
						roastOn: orderLine.roastOn,
						variantId: orderLine.variantId,
						productId: product.id,
						roastLevelId: orderLine.roastLevelId,
						product: enOf(product.name),
						size: enOf(bagSize.name),
						roast: enOf(roastLevel.name),
						bags: sql<number>`sum(${orderLine.quantity})`.mapWith(Number),
						orders: sql<number>`count(distinct ${orderLine.orderId})`.mapWith(Number)
					})
					.from(orderLine)
					.innerJoin(order, eq(orderLine.orderId, order.id))
					.innerJoin(productVariant, eq(orderLine.variantId, productVariant.id))
					.innerJoin(product, eq(productVariant.productId, product.id))
					.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
					.leftJoin(roastLevel, eq(orderLine.roastLevelId, roastLevel.id))
					.where(
						and(
							isNotNull(orderLine.roastOn),
							isNull(orderLine.roastBatchId),
							inArray(order.status, ['paid', 'roasting']),
							isNull(order.deletedAt)
						)
					)
					.groupBy(
						orderLine.roastOn,
						orderLine.variantId,
						product.id,
						orderLine.roastLevelId,
						product.name,
						bagSize.name,
						roastLevel.name
					)
					.orderBy(asc(orderLine.roastOn))
					.limit(10);
			})()
		);
	}

	if (may('visits.view')) {
		tasks.push(
			(async () => {
				const [[admits], [cap], byDay] = await Promise.all([
					db
						.select({ admits: sum(ticket.admits), checkedIn: sum(ticket.checkedIn) })
						.from(ticket)
						.where(and(eq(ticket.visitDate, today), inArray(ticket.status, ['valid', 'used']))),
					db
						.select({
							capacity: sum(visitDay.capacity),
							sold: sum(visitDay.sold),
							held: sum(visitDay.held)
						})
						.from(visitDay)
						.where(eq(visitDay.date, today)),
					db
						.select({
							day: ticket.visitDate,
							admits: sum(ticket.admits),
							checkedIn: sum(ticket.checkedIn)
						})
						.from(ticket)
						.where(and(gte(ticket.visitDate, monthAgo), inArray(ticket.status, ['valid', 'used'])))
						.groupBy(ticket.visitDate)
				]);
				const capacity = n(cap?.capacity);
				const tally = new Map(byDay.map((r) => [String(r.day), r]));
				stats.push(
					{
						key: 'tickets',
						label: 'Visitors today',
						value: n(admits?.admits),
						format: 'count',
						group: 'visits',
						hint: `${n(admits?.checkedIn)} checked in so far`,
						href: `${D}/visits/tickets?dateStart=${today}&dateEnd=${today}`,
						compare: { value: n(tally.get(weekAgo)?.admits), label: sameDayLastWeek(weekAgo) }
					},
					{
						key: 'capacity',
						label: 'Capacity used today',
						value: capacity ? Math.round(((n(cap?.sold) + n(cap?.held)) / capacity) * 100) : 0,
						format: 'percent',
						group: 'visits',
						hint: capacity
							? `${n(cap?.sold)} sold, ${n(cap?.held)} held of ${capacity}`
							: 'No visit day set up for today',
						tone: 'neutral',
						href: `${D}/visits/days`
					}
				);
				// Stacked: each bar is the day's visitors, split by whether they came. Two lines for
				// "tickets" and "checked in" ran on top of each other and hid the second.
				charts.push({
					key: 'tickets',
					title: 'Visitors, last 30 days',
					group: 'visits',
					kind: 'bar',
					stacked: true,
					labels: days.map(dayLabel),
					series: [
						{ label: 'Checked in', data: days.map((d) => n(tally.get(d)?.checkedIn)) },
						{
							label: 'Not checked in',
							data: days.map((d) =>
								Math.max(0, n(tally.get(d)?.admits) - n(tally.get(d)?.checkedIn))
							)
						}
					]
				});
			})()
		);
	}

	if (may('inbox.view')) {
		tasks.push(
			db
				.select({ c: count() })
				.from(formSubmission)
				.where(and(eq(formSubmission.status, 'new'), isNull(formSubmission.deletedAt)))
				.then(([r]) => {
					stats.push({
						key: 'inbox',
						label: 'New in the inbox',
						value: n(r?.c),
						format: 'count',
						group: 'bookings',
						hint: 'Enquiries and requests nobody has opened',
						tone: n(r?.c) ? 'warning' : 'positive',
						href: `${D}/inbox?status=new`
					});
				})
		);
	}

	if (may('bookings.view')) {
		tasks.push(
			(async () => {
				const when = sql`coalesce(${bookingSession.startsAt}, ${booking.confirmedStartsAt})`;
				const [[week]] = await Promise.all([
					db
						.select({ c: count(), people: sum(booking.partySize) })
						.from(booking)
						.leftJoin(bookingSession, eq(booking.sessionId, bookingSession.id))
						.where(
							and(
								isNull(booking.deletedAt),
								inArray(booking.status, ['new', 'in_progress', 'confirmed']),
								sql`${when} >= ${start}`,
								sql`${when} < ${weekAhead}`
							)
						)
				]);
				stats.push({
					key: 'bookings',
					label: 'Bookings this week',
					value: n(week?.c),
					format: 'count',
					group: 'bookings',
					hint: `${n(week?.people)} people`,
					href: `${D}/bookings`
				});
				sessions = await db
					.select({
						id: bookingSession.id,
						startsAt: bookingSession.startsAt,
						bookableId: bookingSession.bookableId,
						bookable: enOf(bookable.name),
						booked: bookingSession.booked,
						capacity: bookingSession.capacity,
						language: bookingSession.language
					})
					.from(bookingSession)
					.innerJoin(bookable, eq(bookingSession.bookableId, bookable.id))
					.where(
						and(
							gte(bookingSession.startsAt, start),
							lt(bookingSession.startsAt, end),
							eq(bookingSession.isCancelled, false),
							isNull(bookingSession.deletedAt)
						)
					)
					.orderBy(asc(bookingSession.startsAt));
			})()
		);
	}

	if (may('memberships.view')) {
		tasks.push(
			db
				.select({ c: count() })
				.from(membership)
				.where(and(inArray(membership.status, ['active', 'grace']), isNull(membership.deletedAt)))
				.then(([r]) => {
					stats.push({
						key: 'members',
						label: 'Active members',
						value: n(r?.c),
						format: 'count',
						group: 'members',
						hint: 'Active or in their grace period',
						href: `${D}/memberships`
					});
				})
		);
	}

	/*
	 * What is waiting on someone's say-so rather than on someone's hands: each only for a viewer who
	 * may decide it, and only when there is something to decide.
	 */
	const decisions: { key: string; label: string; hint: string; count: number; href: string }[] = [];
	const decide = (item: (typeof decisions)[number]) => {
		if (item.count > 0) decisions.push(item);
	};
	if (may('orders.manage')) {
		tasks.push(
			db
				.select({ c: count() })
				.from(payment)
				.where(
					and(
						eq(payment.provider, 'bank_transfer'),
						eq(payment.status, 'pending'),
						isNotNull(payment.receiptFile)
					)
				)
				.then(([r]) =>
					decide({
						key: 'receipts',
						label: 'Transfer receipts to check',
						hint: 'Buyers say they paid; confirm each against the statement',
						count: n(r?.c),
						href: `${D}/orders/payments?provider=bank_transfer&status=pending`
					})
				)
		);
	}
	if (may('refunds.manage')) {
		tasks.push(
			db
				.select({ c: count() })
				.from(refund)
				.where(eq(refund.status, 'requested'))
				.then(([r]) =>
					decide({
						key: 'refunds',
						label: 'Refunds to approve',
						hint: 'Asked for, not yet approved or refused',
						count: n(r?.c),
						href: `${D}/orders/refunds?status=requested`
					})
				)
		);
	}
	if (may('wholesale.manage')) {
		tasks.push(
			db
				.select({ c: count() })
				.from(businessAccount)
				.where(
					and(eq(businessAccount.approvalStatus, 'pending'), isNull(businessAccount.deletedAt))
				)
				.then(([r]) =>
					decide({
						key: 'wholesale',
						label: 'Wholesale applications',
						hint: 'Businesses waiting to be approved',
						count: n(r?.c),
						href: `${D}/wholesale/accounts?approvalStatus=pending`
					})
				)
		);
	}
	if (may('bookings.view')) {
		tasks.push(
			db
				.select({ c: count() })
				.from(booking)
				.where(and(eq(booking.status, 'new'), isNull(booking.deletedAt)))
				.then(([r]) =>
					decide({
						key: 'bookings',
						label: 'New booking requests',
						hint: 'Not yet answered',
						count: n(r?.c),
						href: `${D}/bookings?status=new`
					})
				)
		);
	}
	if (may('memberships.view')) {
		const monthAhead = addLocalDays(today, 30);
		tasks.push(
			db
				.select({ c: count() })
				.from(membership)
				.where(
					and(
						eq(membership.status, 'active'),
						gte(membership.endsOn, today),
						sql`${membership.endsOn} <= ${monthAhead}`,
						isNull(membership.deletedAt)
					)
				)
				.then(([r]) =>
					decide({
						key: 'renewals',
						label: 'Memberships to renew',
						hint: 'Ending in the next 30 days',
						count: n(r?.c),
						href: `${D}/memberships?status=active&dateStart=${today}&dateEnd=${monthAhead}`
					})
				)
		);
	}

	await Promise.all(tasks);
	// Money waiting on a check first: a buyer has paid and is told nothing until it is confirmed.
	const DECISION_ORDER = ['receipts', 'refunds', 'wholesale', 'bookings', 'renewals'];
	decisions.sort((a, b) => DECISION_ORDER.indexOf(a.key) - DECISION_ORDER.indexOf(b.key));

	const ORDER = ['sales', 'fulfil', 'tickets', 'capacity', 'low', 'inbox', 'bookings', 'members'];
	stats.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
	charts.sort((a) => (a.key === 'sales' ? -1 : 1));

	return { today, stats, charts, waiting, roastQueue, sessions, decisions };
}
