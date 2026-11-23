/**
 * Chapa payments nobody came back for. A payment is settled when the buyer returns to
 * `/pay/{txRef}` or Chapa's webhook arrives; a buyer who paid and closed the tab, with the
 * webhook lost, would otherwise have paid for an order that never moves. Every few minutes this
 * asks Chapa about attempts started more than ten minutes ago and settles them the same way
 * (`settleByTxRef`: Chapa's own verify answer, never a guess; settling twice is a no-op).
 *
 * An attempt still unanswered after a day is marked `expired`: Chapa's checkout does not live
 * that long, and the order's page offers a fresh one.
 */
import { and, asc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { payment } from '#lib/server/db/schema.ts';
import { paymentsOn, settleByTxRef } from '#lib/server/site.ts';
import { systemEvent } from '#lib/server/systemEvent.ts';

/** At most this many asked per run, so a backlog never floods Chapa. */
const BATCH = 20;

/** Returns how many payments it settled as paid. */
export async function reconcileChapaPayments(): Promise<number> {
	if (!paymentsOn()) return 0;
	const stale = await db
		.select({ id: payment.id, txRef: payment.txRef, createdAt: payment.createdAt })
		.from(payment)
		.where(
			and(
				eq(payment.provider, 'chapa'),
				inArray(payment.status, ['initiated', 'pending']),
				lt(payment.createdAt, sql`NOW() - INTERVAL 10 MINUTE`),
				gt(payment.createdAt, sql`NOW() - INTERVAL 3 DAY`)
			)
		)
		.orderBy(asc(payment.id))
		.limit(BATCH);

	let paid = 0;
	const event = systemEvent();
	const dayAgo = Date.now() - 24 * 60 * 60_000;
	for (const p of stale) {
		try {
			const result = await settleByTxRef(event, p.txRef);
			if (result?.outcome === 'paid') paid++;
			else if (result?.outcome === 'pending' && p.createdAt.getTime() < dayAgo) {
				await db
					.update(payment)
					.set({ status: 'expired', failureReason: 'Not completed at Chapa within a day' })
					.where(and(eq(payment.id, p.id), inArray(payment.status, ['initiated', 'pending'])));
			}
		} catch (err) {
			// Chapa unreachable, or an order that can no longer take it: try again next run.
			console.warn(
				`[payments] could not re-check ${p.txRef}:`,
				err instanceof Error ? err.message : err
			);
		}
	}
	return paid;
}
