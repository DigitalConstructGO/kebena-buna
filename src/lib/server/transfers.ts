/**
 * Paying by bank transfer: the buyer pays into one of our accounts from their own bank or wallet,
 * then uploads the receipt on the order's page. The payment waits `pending` until staff find the
 * money on the statement and confirm it (`confirmTransfer` in `orders.ts`), which pays the order
 * exactly as Chapa would — receipt number, tickets, memberships.
 *
 *     /track/{number} ─► submitTransfer (pending + receipt) ─► staff: confirm ─► order paid
 *                                                          └► staff: reject  ─► buyer tries again
 *
 * While a receipt waits, the order's ticket places are not released (`expireUnpaidOrders`).
 */
import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '#lib/server/db/index.ts';
import { ORIGIN } from '$app/env/private';
import { bankAccount, order, payment } from '#lib/server/db/schema.ts';
import { tellStaff } from '#lib/server/jobs/staffAlerts.ts';
import { m } from '#lib/i18n.ts';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The accounts a buyer can pay into, in the order staff set. */
export function transferAccounts() {
	return db
		.select({
			id: bankAccount.id,
			bankName: bankAccount.bankName,
			accountName: bankAccount.accountName,
			accountNumber: bankAccount.accountNumber,
			note: bankAccount.note
		})
		.from(bankAccount)
		.where(and(eq(bankAccount.status, true), isNull(bankAccount.deletedAt)))
		.orderBy(asc(bankAccount.sortOrder), asc(bankAccount.id));
}

/** True when at least one account is listed, so "Bank transfer" can be offered. */
export const transfersOn = async () => (await transferAccounts()).length > 0;

/** An order's latest transfer receipt, for its page: waiting, confirmed, or turned down and why. */
export async function latestTransfer(orderId: number) {
	const [row] = await db
		.select({
			status: payment.status,
			amount: payment.amount,
			failureReason: payment.failureReason,
			createdAt: payment.createdAt,
			bankName: bankAccount.bankName
		})
		.from(payment)
		.leftJoin(bankAccount, eq(payment.bankAccountId, bankAccount.id))
		.where(and(eq(payment.orderId, orderId), eq(payment.provider, 'bank_transfer')))
		.orderBy(desc(payment.id))
		.limit(1);
	return row ?? null;
}

/**
 * The buyer says they paid `orderId`'s balance into `bankAccountId`, with `receiptFile` (already
 * saved) as proof. Refused for an account we no longer list, an order not waiting for payment,
 * or one with a receipt already waiting — a second upload would only be a second thing to check.
 */
export async function submitTransfer(
	orderId: number,
	input: { bankAccountId: number; reference: string | null; receiptFile: string }
) {
	const accounts = await transferAccounts();
	if (!accounts.some((a) => a.id === input.bankAccountId))
		throw new WriteRefused('bankAccountId', m.track_transfer_err_account());

	await db.transaction(async (tx) => {
		const [o] = await tx.select().from(order).where(eq(order.id, orderId)).for('update');
		if (!o || o.status !== 'pending_payment')
			throw new WriteRefused(null, m.track_transfer_err_closed());
		const balance = r2(Number(o.total) - Number(o.amountPaid));
		if (balance < 0.005) throw new WriteRefused(null, m.track_transfer_err_closed());
		const [waiting] = await tx
			.select({ id: payment.id })
			.from(payment)
			.where(
				and(
					eq(payment.orderId, o.id),
					eq(payment.provider, 'bank_transfer'),
					eq(payment.status, 'pending')
				)
			)
			.limit(1);
		if (waiting) throw new WriteRefused(null, m.track_transfer_err_waiting());

		const [res] = await tx.insert(payment).values({
			orderId: o.id,
			provider: 'bank_transfer',
			status: 'pending',
			amount: balance,
			txRef: `KC-BT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
			reference: input.reference,
			bankAccountId: input.bankAccountId,
			receiptFile: input.receiptFile
		});
		// Staff hear of it now, not when someone next opens the dashboard: the buyer is waiting.
		const account = accounts.find((a) => a.id === input.bankAccountId)!;
		await tellStaff(
			'receipt',
			'staff.receipt',
			{
				order_number: o.number,
				name: o.contactName,
				amount: balance.toFixed(2),
				bank: `${account.bankName} · ${account.accountNumber}`,
				reference: input.reference ?? '—',
				order_url: `${ORIGIN.replace(/\/$/, '')}/dashboard/orders/${o.id}`
			},
			String(res.insertId),
			tx
		);
	});
}
