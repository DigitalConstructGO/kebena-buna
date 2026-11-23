/**
 * Unpaid group holds give their places back when they expire (questionnaire 6.6, HIGH-11): a
 * booking still holding places past `holdExpiresAt`, whose invoice is not paid, drops to zero
 * held, and the history says so. The booking itself stays as it was, for staff to follow up.
 */
import { and, eq, gt, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { booking, invoice, workflowHistory } from '#lib/server/db/schema.ts';
import { holdPlaces } from '#lib/server/bookings.ts';

/** Returns how many bookings it released. */
export async function releaseExpiredHolds(): Promise<number> {
	const expired = await db
		.select({ id: booking.id, status: booking.status, held: booking.heldPlaces })
		.from(booking)
		.leftJoin(invoice, eq(booking.invoiceId, invoice.id))
		.where(
			and(
				gt(booking.heldPlaces, 0),
				lte(booking.holdExpiresAt, sql`NOW()`),
				isNull(booking.deletedAt),
				or(isNull(invoice.id), ne(invoice.status, 'paid'))
			)
		)
		.limit(100);

	let released = 0;
	for (const b of expired) {
		await db.transaction(async (tx) => {
			// Re-read under the lock: staff may have extended or released it since.
			const [cur] = await tx
				.select({ held: booking.heldPlaces, until: booking.holdExpiresAt })
				.from(booking)
				.where(eq(booking.id, b.id))
				.for('update');
			if (!cur?.held || !cur.until || cur.until > new Date()) return;
			await holdPlaces(tx, b.id, 0);
			await tx.insert(workflowHistory).values({
				bookingId: b.id,
				fromStatus: b.status,
				toStatus: b.status,
				note: `Hold expired: ${cur.held} place${cur.held === 1 ? '' : 's'} released`,
				changedBy: null
			});
			released++;
		});
	}
	return released;
}
