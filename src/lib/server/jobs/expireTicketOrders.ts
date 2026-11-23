/**
 * Unpaid web ticket orders give their places back. Buying tickets online holds the places
 * (`visit_slot.held`, `holdTicketPlaces`) until the order is paid; one still unpaid after the
 * `tickets.pay_window_hours` setting (24 by default: long enough for staff to take a payment by
 * phone while Chapa is not set up) is cancelled and its places released. An order with a Chapa
 * payment started in the last half hour is left alone, since the buyer may be paying right now.
 */
import { and, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { order, orderLine, orderStatusHistory, payment, ticket } from '#lib/server/db/schema.ts';
import { releaseTicketPlaces } from '#lib/server/tickets.ts';
import { readSetting } from '#lib/server/stockReads.ts';

/** Returns how many orders it cancelled. */
export async function expireUnpaidTicketOrders(): Promise<number> {
	const hours = Number(await readSetting('tickets.pay_window_hours', 24)) || 24;
	const stale = await db
		.selectDistinct({ id: order.id })
		.from(order)
		.innerJoin(orderLine, eq(orderLine.orderId, order.id))
		.where(
			and(
				eq(order.channel, 'web'),
				eq(order.status, 'pending_payment'),
				lte(order.placedAt, sql`NOW() - INTERVAL ${hours} HOUR`),
				inArray(orderLine.itemType, ['ticket', 'event_ticket'])
			)
		)
		.limit(100);

	let cancelled = 0;
	for (const { id } of stale) {
		await db.transaction(async (tx) => {
			// Re-read under the lock: it may have been paid or cancelled since.
			const [o] = await tx.select({ status: order.status }).from(order).where(eq(order.id, id)).for('update');
			if (o?.status !== 'pending_payment') return;
			const [paying] = await tx
				.select({ id: payment.id })
				.from(payment)
				.where(
					and(
						eq(payment.orderId, id),
						inArray(payment.status, ['initiated', 'pending']),
						gt(payment.createdAt, sql`NOW() - INTERVAL 30 MINUTE`)
					)
				)
				.limit(1);
			if (paying) return;
			const [issued] = await tx.select({ id: ticket.id }).from(ticket).where(and(eq(ticket.orderId, id), isNull(ticket.cancelledAt))).limit(1);
			if (issued) return;
			await releaseTicketPlaces(tx, id);
			await tx.update(order).set({ status: 'cancelled', cancelledAt: new Date() }).where(eq(order.id, id));
			await tx.insert(orderStatusHistory).values({
				orderId: id,
				fromStatus: 'pending_payment',
				toStatus: 'cancelled',
				note: `Not paid within ${hours} hours: places released`
			});
			cancelled++;
		});
	}
	return cancelled;
}
