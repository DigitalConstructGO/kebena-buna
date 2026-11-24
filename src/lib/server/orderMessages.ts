/**
 * What the customer is told as their order moves (questionnaire 3.3), queued in the same
 * transaction as the move. One message per order and status: setting a status again sends nothing.
 *
 * | Status                       | Template                                         |
 * | ---------------------------- | ------------------------------------------------ |
 * | placed on the website        | `order.placed`, with the link to pay and follow it |
 * | paid                         | `order.paid`, or `order.tickets` when it has tickets |
 * | roasting (roast-to-order)    | `order.roasting`                                 |
 * | out for delivery             | `order.out_for_delivery` (rider) / `order.shipped` (courier) |
 * | ready for pickup             | `order.ready_for_pickup`                         |
 * | delivered / collected        | `order.delivered` / `order.collected`, with the review link |
 */
import { and, eq, inArray } from 'drizzle-orm';
import { ORIGIN } from '$app/env/private';
import type { Writer } from '@nahu/admin-kit/server/db';
import { courier, customer, location, order, orderLine, user } from '#lib/server/db/schema.ts';
import type { Localized } from '#lib/server/db/fields.ts';
import { queueMessage, type Payload } from '#lib/server/notify.ts';
import { readSetting } from '#lib/server/stockReads.ts';
import type { OrderStatus } from '#lib/constants.ts';
import { siteHref } from '#lib/site/locale.ts';
import { locales, type Locale } from '#lib/paraglide/runtime.js';

type Order = typeof order.$inferSelect;

const inLocale = (text: Localized | null | undefined, locale: string) =>
	text?.[locale] || text?.am || text?.en || '';

/**
 * The order's own page, in its buyer's language, as a full address for a text or an email: its
 * status, its tickets, and — while unpaid — the ways to pay. Null for an order without a link.
 */
export function orderUrl(o: Pick<Order, 'number' | 'payToken' | 'locale'>) {
	if (!o.payToken) return null;
	const locale = ((locales as readonly string[]).includes(o.locale) ? o.locale : 'en') as Locale;
	const path = siteHref(`/track/${encodeURIComponent(o.number)}`, locale);
	return `${ORIGIN.replace(/\/$/, '')}${path}?k=${encodeURIComponent(o.payToken)}`;
}

function templateFor(o: Order, to: OrderStatus): string | null {
	switch (to) {
		case 'pending_payment':
			return 'order.placed';
		case 'paid':
		case 'roasting':
		case 'ready_for_pickup':
		case 'delivered':
		case 'collected':
			return `order.${to}`;
		case 'out_for_delivery':
			return o.deliveryMethod === 'courier' ? 'order.shipped' : 'order.out_for_delivery';
		default:
			return null;
	}
}

/**
 * Queues the message for `o` having reached `to`, read as it is after the move. Returns how many
 * were queued (0 for a status that tells the customer nothing, or with no phone or email).
 */
export async function queueOrderMessage(tx: Writer, o: Order, to: OrderStatus): Promise<number> {
	let key = templateFor(o, to);
	if (!key) return 0;
	// Paid with tickets in it: the message is the tickets, and where their QR codes are.
	if (key === 'order.paid') {
		const [entry] = await tx
			.select({ id: orderLine.id })
			.from(orderLine)
			.where(
				and(eq(orderLine.orderId, o.id), inArray(orderLine.itemType, ['ticket', 'event_ticket']))
			)
			.limit(1);
		if (entry) key = 'order.tickets';
	}
	const [c] = await tx
		.select({ name: customer.name, phone: customer.phone, email: customer.email })
		.from(customer)
		.where(eq(customer.id, o.customerId));

	const payload: Payload = {
		name: o.contactName ?? c?.name ?? '',
		order_number: o.number,
		total: Number(o.total).toFixed(2),
		order_url: orderUrl(o)
	};
	if (key === 'order.out_for_delivery' && o.riderId) {
		const [r] = await tx
			.select({ name: user.name, phone: user.phoneNumber })
			.from(user)
			.where(eq(user.id, o.riderId));
		payload.rider_name = r?.name;
		payload.rider_phone = r?.phone;
	}
	if (key === 'order.shipped') {
		payload.tracking_number = o.trackingNumber;
		if (o.courierId) {
			const [cr] = await tx
				.select({ name: courier.name, template: courier.trackingUrlTemplate })
				.from(courier)
				.where(eq(courier.id, o.courierId));
			payload.courier = cr?.name;
			if (cr?.template && o.trackingNumber)
				payload.tracking_url = cr.template.replace(
					'{tracking}',
					encodeURIComponent(o.trackingNumber)
				);
		}
	}
	if (key === 'order.ready_for_pickup') {
		payload.pickup_code = o.pickupCode;
		if (o.pickupLocationId) {
			const [l] = await tx
				.select({ name: location.name })
				.from(location)
				.where(eq(location.id, o.pickupLocationId));
			payload.pickup_place = inLocale(l?.name, o.locale);
		}
	}
	if (key === 'order.delivered' || key === 'order.collected') {
		payload.review_url = await readSetting('notify.review_url', '');
	}

	return queueMessage(
		tx,
		key,
		{
			phone: o.contactPhone ?? c?.phone,
			email: o.contactEmail ?? c?.email,
			locale: o.locale,
			customerId: o.customerId
		},
		payload,
		{ refType: 'order', refId: o.id, dedupe: `order:${o.id}:${to}` }
	);
}

/**
 * Sends an order's link (`order.link`) to the phone and email it was placed with, for a buyer who
 * asked for it on `/track`. Only those two ever get it, so knowing an order's number and phone is
 * not enough to open it. At most one per order every ten minutes, so the form cannot be used to
 * flood someone's phone.
 */
export async function queueOrderLink(tx: Writer, o: Order): Promise<number> {
	const url = orderUrl(o);
	if (!url) return 0;
	const window = Math.floor(Date.now() / (10 * 60_000));
	return queueMessage(
		tx,
		'order.link',
		{
			phone: o.contactPhone,
			email: o.contactEmail,
			locale: o.locale,
			customerId: o.customerId
		},
		{ name: o.contactName ?? '', order_number: o.number, order_url: url },
		{ refType: 'order', refId: o.id, dedupe: `order:${o.id}:link:${window}` }
	);
}
