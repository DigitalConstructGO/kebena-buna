/**
 * What the customer is told as their order moves (questionnaire 3.3), queued in the same
 * transaction as the move. One message per order and status: setting a status again sends nothing.
 *
 * | Status                       | Template                                         |
 * | ---------------------------- | ------------------------------------------------ |
 * | paid                         | `order.paid`                                     |
 * | roasting (roast-to-order)    | `order.roasting`                                 |
 * | out for delivery             | `order.out_for_delivery` (rider) / `order.shipped` (courier) |
 * | ready for pickup             | `order.ready_for_pickup`                         |
 * | delivered / collected        | `order.delivered` / `order.collected`, with the review link |
 */
import { eq } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { courier, customer, location, order, user } from '#lib/server/db/schema.ts';
import type { Localized } from '#lib/server/db/fields.ts';
import { queueMessage, type Payload } from '#lib/server/notify.ts';
import { readSetting } from '#lib/server/stockReads.ts';
import type { OrderStatus } from '#lib/constants.ts';

type Order = typeof order.$inferSelect;

const inLocale = (text: Localized | null | undefined, locale: string) =>
	text?.[locale] || text?.am || text?.en || '';

function templateFor(o: Order, to: OrderStatus): string | null {
	switch (to) {
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
	const key = templateFor(o, to);
	if (!key) return 0;
	const [c] = await tx
		.select({ name: customer.name, phone: customer.phone, email: customer.email })
		.from(customer)
		.where(eq(customer.id, o.customerId));

	const payload: Payload = {
		name: o.contactName ?? c?.name ?? '',
		order_number: o.number,
		total: Number(o.total).toFixed(2)
	};
	if (key === 'order.out_for_delivery' && o.riderId) {
		const [r] = await tx.select({ name: user.name, phone: user.phoneNumber }).from(user).where(eq(user.id, o.riderId));
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
			if (cr?.template && o.trackingNumber) payload.tracking_url = cr.template.replace('{tracking}', encodeURIComponent(o.trackingNumber));
		}
	}
	if (key === 'order.ready_for_pickup') {
		payload.pickup_code = o.pickupCode;
		if (o.pickupLocationId) {
			const [l] = await tx.select({ name: location.name }).from(location).where(eq(location.id, o.pickupLocationId));
			payload.pickup_place = inLocale(l?.name, o.locale);
		}
	}
	if (key === 'order.delivered' || key === 'order.collected') {
		payload.review_url = await readSetting('notify.review_url', '');
	}

	return queueMessage(
		tx,
		key,
		{ phone: o.contactPhone ?? c?.phone, email: o.contactEmail ?? c?.email, locale: o.locale, customerId: o.customerId },
		payload,
		{ refType: 'order', refId: o.id, dedupe: `order:${o.id}:${to}` }
	);
}
