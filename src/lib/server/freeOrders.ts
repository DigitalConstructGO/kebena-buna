/**
 * An order with nothing to pay — under-6 entry, a free event, a 100% discount code — is complete
 * the moment it is placed: it goes straight to `paid`, gets its confirmation message, its coffee
 * comes off the shelf, its tickets are issued and its memberships and subscriptions start, so the
 * buyer leaves with them instead of a payment button.
 */
import { and, eq } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { order, orderStatusHistory } from '#lib/server/db/schema.ts';
import { queueOrderMessage } from '#lib/server/orderMessages.ts';
import { issueOrderTickets } from '#lib/server/tickets.ts';
import { activateOrderItems } from '#lib/server/activation.ts';
import { takeOrderStock } from '#lib/server/stock.ts';

/** Marks a zero-total `pending_payment` order paid and issues its tickets. No-op on anything else. */
export async function completeFreeOrder(tx: Writer, orderId: number) {
	const [o] = await tx.select().from(order).where(eq(order.id, orderId)).for('update');
	if (!o || o.status !== 'pending_payment' || Number(o.total) > 0.005) return false;
	const paidAt = new Date();
	await tx
		.update(order)
		.set({ status: 'paid', paymentState: 'paid', paidAt })
		.where(and(eq(order.id, o.id), eq(order.status, 'pending_payment')));
	const queued = await queueOrderMessage(
		tx,
		{ ...o, status: 'paid', paymentState: 'paid', paidAt },
		'paid'
	);
	await tx.insert(orderStatusHistory).values({
		orderId: o.id,
		fromStatus: 'pending_payment',
		toStatus: 'paid',
		note: 'Free — no payment needed',
		notified: queued > 0
	});
	await takeOrderStock(tx, o.id);
	await issueOrderTickets(tx, o.id);
	await activateOrderItems(tx, o.id);
	return true;
}
