/**
 * Unpaid web orders are cancelled once their buyer has had time to pay, so the order list holds
 * what is real and what an order held goes back.
 *
 * - **Ticket orders** hold their places (`visit_slot.held`, `holdTicketPlaces`) until paid; one
 *   still unpaid after the `tickets.pay_window_hours` setting (24 by default: long enough for
 *   staff to take a payment by phone while Chapa is not set up) is cancelled and its places
 *   released.
 * - **Everything else** — shop, memberships, subscriptions — after `orders.pay_window_hours` (72
 *   by default: a bank transfer can take a working day or two). Its memberships and subscriptions
 *   waiting for that payment are cancelled with it, and a discount code it used counts again.
 *
 * An order with a Chapa payment started in the last half hour is left alone, since the buyer may
 * be paying right now. So is one with a transfer receipt waiting for staff, or one turned down
 * within the window: the buyer has paid, or gets the same time again to send a receipt that
 * matches.
 */
import { and, eq, gt, inArray, isNull, lte, notExists, or, sql } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { db } from '#lib/server/db/index.ts';
import {
	membership,
	order,
	orderLine,
	orderStatusHistory,
	payment,
	subscription,
	ticket
} from '#lib/server/db/schema.ts';
import { releaseTicketPlaces } from '#lib/server/tickets.ts';
import { readSetting } from '#lib/server/stockReads.ts';
import { releaseDiscount } from '#lib/server/discounts.ts';

const TICKET_LINES = ['ticket', 'event_ticket'] as const;

/** Unpaid web orders placed more than `hours` ago, with or without ticket lines. Exported for its test. */
export function staleOrders(hours: number, tickets: boolean) {
	const hasTickets = db
		.select({ id: orderLine.id })
		.from(orderLine)
		.where(and(eq(orderLine.orderId, order.id), inArray(orderLine.itemType, TICKET_LINES)));
	return db
		.select({ id: order.id })
		.from(order)
		.where(
			and(
				eq(order.channel, 'web'),
				eq(order.status, 'pending_payment'),
				isNull(order.deletedAt),
				lte(order.placedAt, sql`NOW() - INTERVAL ${hours} HOUR`),
				tickets ? sql`exists (${hasTickets})` : notExists(hasTickets)
			)
		)
		.limit(100);
}

/** A payment under way or just turned down: the buyer gets more time. */
async function stillPaying(tx: Writer, orderId: number, hours: number) {
	const [paying] = await tx
		.select({ id: payment.id })
		.from(payment)
		.where(
			and(
				eq(payment.orderId, orderId),
				or(
					and(
						inArray(payment.status, ['initiated', 'pending']),
						gt(payment.createdAt, sql`NOW() - INTERVAL 30 MINUTE`)
					),
					and(eq(payment.provider, 'bank_transfer'), eq(payment.status, 'pending')),
					and(
						eq(payment.provider, 'bank_transfer'),
						eq(payment.status, 'failed'),
						gt(payment.updatedAt, sql`NOW() - INTERVAL ${hours} HOUR`)
					)
				)
			)
		)
		.limit(1);
	return Boolean(paying);
}

/** Cancels one stale order under its lock; false when it was paid, cancelled or is still being paid. */
async function expire(id: number, hours: number, note: string) {
	return db.transaction(async (tx) => {
		// Re-read under the lock: it may have been paid or cancelled since.
		const [o] = await tx
			.select({ status: order.status })
			.from(order)
			.where(eq(order.id, id))
			.for('update');
		if (o?.status !== 'pending_payment') return false;
		if (await stillPaying(tx, id, hours)) return false;
		const [issued] = await tx
			.select({ id: ticket.id })
			.from(ticket)
			.where(and(eq(ticket.orderId, id), isNull(ticket.cancelledAt)))
			.limit(1);
		if (issued) return false;

		await releaseTicketPlaces(tx, id);
		const lines = tx.select({ id: orderLine.id }).from(orderLine).where(eq(orderLine.orderId, id));
		const subs = tx
			.select({ id: orderLine.subscriptionId })
			.from(orderLine)
			.where(eq(orderLine.orderId, id));
		const now = new Date();
		await tx
			.update(membership)
			.set({ status: 'cancelled', cancelledAt: now, cancelReason: note })
			.where(and(inArray(membership.orderLineId, lines), eq(membership.status, 'pending_payment')));
		await tx
			.update(subscription)
			.set({ status: 'cancelled' })
			.where(and(inArray(subscription.id, subs), eq(subscription.status, 'pending_payment')));
		await releaseDiscount(tx, id);
		await tx
			.update(order)
			.set({ status: 'cancelled', cancelledAt: now, cancelReason: note })
			.where(eq(order.id, id));
		await tx
			.insert(orderStatusHistory)
			.values({ orderId: id, fromStatus: 'pending_payment', toStatus: 'cancelled', note });
		return true;
	});
}

/** Returns how many orders it cancelled. */
export async function expireUnpaidOrders(): Promise<number> {
	const ticketHours = Number(await readSetting('tickets.pay_window_hours', 24)) || 24;
	const orderHours = Number(await readSetting('orders.pay_window_hours', 72)) || 72;
	let cancelled = 0;
	for (const { id } of await staleOrders(ticketHours, true)) {
		if (await expire(id, ticketHours, `Not paid within ${ticketHours} hours: places released`))
			cancelled++;
	}
	for (const { id } of await staleOrders(orderHours, false)) {
		if (await expire(id, orderHours, `Not paid within ${orderHours} hours`)) cancelled++;
	}
	return cancelled;
}
