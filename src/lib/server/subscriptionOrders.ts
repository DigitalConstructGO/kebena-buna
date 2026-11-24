/**
 * Coffee subscriptions turned into orders (7.5). Each prepaid delivery becomes an order two days
 * before its roast day — the last moment its coffee, roast and grind could still change — as a
 * zero-total, already-paid order whose line is roasted to order on that day, so it joins the roast
 * queue with the shop's own roast-to-order lines and is packed and sent like any other order.
 *
 * A delivery is `scheduled`, then `ordered` (it has its order), then `delivered` when that order
 * reaches the customer (`moveOrder`). Skipped deliveries stay prepaid:
 * once their day has passed they are added again after the last one, and a subscription with none
 * left is `completed`. A pause ends by itself on its last day.
 */
import { and, asc, count, eq, inArray, isNull, lt, lte, ne } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import {
	customer,
	customerAddress,
	deliveryArea,
	deliveryZone,
	product,
	productVariant,
	subscription,
	subscriptionDelivery
} from '#lib/server/db/schema.ts';
import { priceCart } from '#lib/server/cart.ts';
import { createWebOrder } from '#lib/server/site.ts';
import { completeFreeOrder } from '#lib/server/freeOrders.ts';
import { deliverySchedule, roastDayFrom } from '#lib/server/activation.ts';
import { addDays, addMonths } from '#lib/server/memberships.ts';
import { readSetting } from '#lib/server/stockReads.ts';
import { systemEvent } from '#lib/server/systemEvent.ts';
import { tr } from '#lib/format.ts';

/** Days before the roast day a delivery is ordered: until then it can still be changed (7.5). */
export const ORDER_LEAD_DAYS = 2;

/**
 * A subscription's counters, read from its deliveries: the next roast date is the first still
 * scheduled, and the deliveries used are those ordered or delivered. A skipped one is not used —
 * it stays prepaid, as Skip and Pause promise.
 */
export async function refreshSubscription(tx: Writer, id: number) {
	const [next] = await tx
		.select({ roastDate: subscriptionDelivery.roastDate })
		.from(subscriptionDelivery)
		.where(
			and(eq(subscriptionDelivery.subscriptionId, id), eq(subscriptionDelivery.status, 'scheduled'))
		)
		.orderBy(asc(subscriptionDelivery.roastDate))
		.limit(1);
	const [used] = await tx
		.select({ n: count() })
		.from(subscriptionDelivery)
		.where(
			and(
				eq(subscriptionDelivery.subscriptionId, id),
				inArray(subscriptionDelivery.status, ['delivered', 'ordered'])
			)
		);
	await tx
		.update(subscription)
		.set({ nextRoastDate: next?.roastDate ?? null, deliveriesUsed: used?.n ?? 0 })
		.where(eq(subscription.id, id));
}

/**
 * A delivery order cancelled by staff: its delivery counts as skipped, so it stays prepaid and is
 * sent again at the end.
 */
export async function skipCancelledDelivery(tx: Writer, orderId: number, userId?: string | null) {
	const rows = await tx
		.select({ id: subscriptionDelivery.id, subscriptionId: subscriptionDelivery.subscriptionId })
		.from(subscriptionDelivery)
		.where(
			and(eq(subscriptionDelivery.orderId, orderId), eq(subscriptionDelivery.status, 'ordered'))
		);
	for (const r of rows) {
		await tx
			.update(subscriptionDelivery)
			.set({ status: 'skipped', skippedAt: new Date(), skippedBy: userId ?? null })
			.where(eq(subscriptionDelivery.id, r.id));
		await refreshSubscription(tx, r.subscriptionId);
	}
}

/** One due delivery made into its order, under the delivery's lock. False when it was not due. */
async function orderDelivery(deliveryId: number) {
	return db.transaction(async (tx) => {
		const [d] = await tx
			.select()
			.from(subscriptionDelivery)
			.where(eq(subscriptionDelivery.id, deliveryId))
			.for('update');
		if (!d || d.status !== 'scheduled') return false;
		const [s] = await tx.select().from(subscription).where(eq(subscription.id, d.subscriptionId));
		if (!s || s.status !== 'active') return false;
		const [c] = await tx.select().from(customer).where(eq(customer.id, s.customerId));
		const [address] = s.addressId
			? await tx
					.select({ a: customerAddress, area: deliveryArea.name })
					.from(customerAddress)
					.leftJoin(deliveryArea, eq(customerAddress.areaId, deliveryArea.id))
					.where(eq(customerAddress.id, s.addressId))
			: [];
		const [zone] = s.deliveryZoneId
			? await tx.select().from(deliveryZone).where(eq(deliveryZone.id, s.deliveryZoneId))
			: [];
		const [priced] = (
			await priceCart(
				[
					{
						variantId: s.variantId,
						roastLevelId: s.roastLevelId,
						grindId: s.grindId,
						packagingId: null,
						quantity: s.quantity
					}
				],
				{ staff: true }
			)
		).lines;
		// The coffee was switched off since: staff choose another on the subscription.
		if (!priced) {
			console.warn(`[subscriptions] ${s.number}: its coffee is no longer sold; not ordered`);
			return false;
		}
		const shipped = Boolean(address) && !zone?.isPickup;
		const a = address?.a;
		const placed = await createWebOrder(tx, systemEvent(), {
			customerId: s.customerId,
			contact: {
				name: a?.recipientName ?? c?.name ?? 'Subscriber',
				phone: a?.phone ?? c?.phone ?? '',
				email: c?.email ?? null
			},
			deliveryMethod: shipped ? (zone?.usesCourier ? 'courier' : 'rider') : 'pickup',
			deliveryZoneId: s.deliveryZoneId,
			deliveryAddress: a
				? {
						recipientName: a.recipientName ?? undefined,
						phone: a.phone ?? undefined,
						area: address.area ? tr(address.area) : undefined,
						city: a.city,
						woreda: a.woreda ?? undefined,
						line1: a.line1,
						landmark: a.landmark ?? undefined
					}
				: null,
			deliveryFee: 0,
			lines: [
				{
					itemType: 'product',
					description: priced.description,
					sku: priced.sku,
					variantId: s.variantId,
					roastLevelId: priced.choice.roastLevelId,
					grindId: priced.choice.grindId,
					fulfilment: 'roast_to_order',
					roastOn: d.roastDate,
					subscriptionId: s.id,
					taxRateId: priced.taxRateId,
					quantity: s.quantity,
					// Prepaid with the subscription's bundle.
					unitPrice: 0
				}
			],
			staff: {
				channel: 'system',
				userId: null,
				locale: c?.locale ?? 'am',
				staffNote: `Subscription ${s.number}, delivery ${d.sequence} of ${s.deliveriesPurchased}`,
				notify: false
			}
		});
		await completeFreeOrder(tx, placed.id);
		await tx
			.update(subscriptionDelivery)
			.set({ status: 'ordered', orderId: placed.id })
			.where(eq(subscriptionDelivery.id, d.id));
		await refreshSubscription(tx, s.id);
		return true;
	});
}

/**
 * An active subscription with nothing scheduled: deliveries skipped in the past are added again
 * after the last, else it has run its course and is completed. Future skipped days could still be
 * brought back, so they are left for when their day passes.
 */
async function extendOrComplete(subscriptionId: number, weekdays: number[]) {
	return db.transaction(async (tx) => {
		const [s] = await tx
			.select()
			.from(subscription)
			.where(eq(subscription.id, subscriptionId))
			.for('update');
		if (!s || s.status !== 'active') return 0;
		const today = localToday();
		const rows = await tx
			.select({
				status: subscriptionDelivery.status,
				roastDate: subscriptionDelivery.roastDate,
				sequence: subscriptionDelivery.sequence
			})
			.from(subscriptionDelivery)
			.where(eq(subscriptionDelivery.subscriptionId, s.id));
		if (rows.some((r) => r.status === 'scheduled')) return 0;
		const used = rows.filter((r) => r.status === 'ordered' || r.status === 'delivered').length;
		const ahead = rows.filter((r) => r.status === 'skipped' && r.roastDate > today).length;
		const left = s.deliveriesPurchased - used - ahead;
		if (left > 0) {
			// After the last roast day on record, at the subscription's pace; or, all of them past, as
			// soon as a new delivery can still be changed.
			const last = rows.reduce((max, r) => (r.roastDate > max ? r.roastDate : max), today);
			const base =
				last > today
					? s.frequency === 'biweekly'
						? addDays(last, 14)
						: addMonths(last, 1)
					: addDays(today, ORDER_LEAD_DAYS);
			const first = roastDayFrom(base, weekdays);
			const dates = deliverySchedule(first, left, s.frequency, weekdays);
			const seq = rows.reduce((max, r) => Math.max(max, r.sequence), 0);
			await tx
				.insert(subscriptionDelivery)
				.values(
					dates.map((roastDate, i) => ({ subscriptionId: s.id, sequence: seq + i + 1, roastDate }))
				);
			await refreshSubscription(tx, s.id);
			return dates.length;
		}
		if (ahead === 0) {
			await tx
				.update(subscription)
				.set({ status: 'completed', nextRoastDate: null })
				.where(eq(subscription.id, s.id));
			return 1;
		}
		return 0;
	});
}

/**
 * The `subscriptions` job's ordering step: pauses that have ended are lifted, deliveries due within
 * the lead days get their orders, and subscriptions with nothing scheduled are extended or
 * completed. Returns how many things it did.
 */
export async function orderDueDeliveries(): Promise<number> {
	const today = localToday();
	let done = 0;

	const [resumed] = await db
		.update(subscription)
		.set({ status: 'active', pausedUntil: null })
		.where(and(eq(subscription.status, 'paused'), lt(subscription.pausedUntil, today)));
	done += resumed.affectedRows;

	const due = await db
		.select({ id: subscriptionDelivery.id })
		.from(subscriptionDelivery)
		.innerJoin(subscription, eq(subscriptionDelivery.subscriptionId, subscription.id))
		.innerJoin(productVariant, eq(subscription.variantId, productVariant.id))
		.innerJoin(product, eq(productVariant.productId, product.id))
		.where(
			and(
				eq(subscriptionDelivery.status, 'scheduled'),
				lte(subscriptionDelivery.roastDate, addDays(today, ORDER_LEAD_DAYS)),
				eq(subscription.status, 'active'),
				isNull(subscription.deletedAt)
			)
		)
		.orderBy(asc(subscriptionDelivery.roastDate))
		.limit(100);
	for (const d of due) if (await orderDelivery(d.id)) done++;

	const weekdays = await readSetting<number[]>('roast.weekdays', [2, 5]);
	const idle = await db
		.select({ id: subscription.id })
		.from(subscription)
		.where(
			and(
				eq(subscription.status, 'active'),
				isNull(subscription.nextRoastDate),
				isNull(subscription.deletedAt),
				ne(subscription.deliveriesPurchased, 0)
			)
		)
		.limit(100);
	for (const s of idle) done += await extendOrComplete(s.id, weekdays);
	return done;
}
