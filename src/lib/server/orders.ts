/**
 * The Sales writes: moving an order along its path, recording payments against orders and
 * invoices, and refunds from request to money back. Each runs in the caller's transaction and is
 * audited there.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import type { Writer } from '@nahu/admin-kit/server/db';
import {
	invoice,
	order,
	orderLine,
	orderStatusHistory,
	payment,
	refund,
	refundLine,
	stockMovement,
	storeCredit
} from '#lib/server/db/schema.ts';
import { nextNumber } from '#lib/server/records.ts';
import { fromLocal, localDate } from '@nahu/admin-kit/time';
import { creditBalance } from '#lib/server/customers.ts';
import { adjustStock } from '#lib/server/stock.ts';
import { queueOrderMessage } from '#lib/server/orderMessages.ts';
import { issueOrderTickets } from '#lib/server/tickets.ts';
import { activateOrderItems } from '#lib/server/activation.ts';
import type { OrderStatus } from '#lib/constants.ts';

type Order = typeof order.$inferSelect;

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Where an order may go next (questionnaire 3.2). Payment moves `pending_payment` on (by a
 * payment, not by hand); cancelling has its own action.
 */
export function nextStatuses(o: Pick<Order, 'status' | 'deliveryMethod'>, hasRoast: boolean): OrderStatus[] {
	switch (o.status) {
		case 'paid':
			return hasRoast ? ['roasting', 'packed'] : o.deliveryMethod === 'none' ? ['completed', 'packed'] : ['packed'];
		case 'roasting':
			return ['packed'];
		case 'packed':
			return o.deliveryMethod === 'pickup'
				? ['ready_for_pickup']
				: o.deliveryMethod === 'none'
					? ['completed']
					: ['out_for_delivery'];
		case 'out_for_delivery':
			return ['delivered'];
		case 'delivered':
			return ['completed'];
		case 'ready_for_pickup':
			return ['collected'];
		case 'collected':
			return ['completed'];
		default:
			return [];
	}
}

/** Cancelling is open until the order has left the building. */
export const canCancel = (status: string) => ['pending_payment', 'paid', 'roasting', 'packed'].includes(status);

/** The time column a status stamps. */
const STAMP: Partial<Record<OrderStatus, 'paidAt' | 'dispatchedAt' | 'completedAt' | 'cancelledAt'>> = {
	paid: 'paidAt',
	out_for_delivery: 'dispatchedAt',
	ready_for_pickup: 'dispatchedAt',
	completed: 'completedAt',
	cancelled: 'cancelledAt'
};

/** Moves an order to `to`, writes its history and audit. Refuses a step the path does not allow. */
export async function moveOrder(
	tx: Writer,
	event: RequestEvent,
	o: Order,
	to: OrderStatus,
	opts: { note?: string | null; notified?: boolean; force?: boolean; extra?: Partial<Order> } = {}
) {
	if (!opts.force) {
		const [roast] = await tx
			.select({ id: orderLine.id })
			.from(orderLine)
			.where(and(eq(orderLine.orderId, o.id), eq(orderLine.fulfilment, 'roast_to_order')))
			.limit(1);
		if (!nextStatuses(o, Boolean(roast)).includes(to)) {
			throw new WriteRefused('status', `An order that is ${o.status.replaceAll('_', ' ')} cannot go to ${to.replaceAll('_', ' ')}.`);
		}
	}
	const stamp = STAMP[to];
	const values: Partial<Order> = { status: to, updatedBy: event.locals.user?.id ?? null, ...opts.extra };
	if (stamp) values[stamp] = new Date();
	await tx.update(order).set(values).where(eq(order.id, o.id));
	const queued = await queueOrderMessage(tx, { ...o, ...values }, to);
	await tx.insert(orderStatusHistory).values({
		orderId: o.id,
		fromStatus: o.status,
		toStatus: to,
		note: opts.note ?? null,
		notified: Boolean(opts.notified) || queued > 0,
		changedBy: event.locals.user?.id ?? null
	});
	await recordAudit(tx, event, { table: 'orders', recordId: o.id, action: 'update', before: o, after: values });
}

/** A unique reference of ours for a payment recorded by hand. */
const manualRef = () => `KC-MAN-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e6)}`;

/**
 * The next VAT receipt number, in the sequence of the year the money came in (local time):
 * `R-26-000123`, and `R-27-000001` from the first payment of 2027.
 */
async function nextReceiptNumber(tx: Writer, paidAt: Date) {
	const year = localDate(paidAt).slice(0, 4);
	return `R-${year.slice(2)}-${String(await nextNumber(tx, `receipt:${year}`)).padStart(6, '0')}`;
}

type PaymentInput = { provider: string; amount: number; reference?: string | null; paidAt: Date };

/**
 * Money towards an order: its paid amount and — once the total is covered — the order paid, with
 * its VAT receipt number. The order is re-read locked, so two payments in flight add up and the
 * second cannot pay past the balance or take a second receipt number.
 */
async function applyOrderPayment(tx: Writer, event: RequestEvent, orderId: number, p: PaymentInput) {
	const [o] = await tx.select().from(order).where(eq(order.id, orderId)).for('update');
	if (!o) throw new WriteRefused(null, 'Order not found.');
	if (o.status === 'cancelled') throw new WriteRefused(null, 'A cancelled order takes no payment.');
	if (o.paymentState === 'refunded') throw new WriteRefused(null, 'This order was refunded; it takes no more payment.');
	const balance = r2(Number(o.total) - Number(o.amountPaid));
	if (balance < 0.005) throw new WriteRefused('amount', `${o.number} is already paid in full.`);
	if (p.amount > balance + 0.005) throw new WriteRefused('amount', `Only ${balance.toFixed(2)} is still owed on ${o.number}.`);
	const paid = r2(Number(o.amountPaid) + p.amount);
	const covered = paid + 0.005 >= Number(o.total);
	const values: Partial<Order> = { amountPaid: paid };
	// A refund already made stays on the record: only an unpaid (or failed) order becomes paid.
	if (covered && (o.paymentState === 'unpaid' || o.paymentState === 'failed')) values.paymentState = 'paid';
	if (covered && !o.receiptNumber) values.receiptNumber = await nextReceiptNumber(tx, p.paidAt);
	await tx.update(order).set(values).where(eq(order.id, o.id));
	if (covered && o.status === 'pending_payment') {
		await moveOrder(tx, event, { ...o, ...values }, 'paid', { force: true, note: `Paid by ${p.provider.replaceAll('_', ' ')}` });
	}
	// Paid in full: its entry and event tickets exist from now on, each with its signed QR.
	if (covered) await issueOrderTickets(tx, o.id);
	// …and the memberships and subscriptions it bought start.
	if (covered) await activateOrderItems(tx, o.id);
	return o;
}

/**
 * Store credit spent as a payment: refused beyond what the customer holds, then written to the
 * ledger as a `redeemed` debit.
 */
async function spendCredit(
	tx: Writer,
	event: RequestEvent,
	customerId: number,
	amount: number,
	ref: { refType: string; refId: number; note: string }
) {
	const balance = await creditBalance(tx, customerId);
	if (amount > balance + 0.005) {
		throw new WriteRefused('amount', `The customer has ${balance.toFixed(2)} in store credit.`);
	}
	await tx.insert(storeCredit).values({
		customerId,
		amount: -r2(amount),
		reason: 'redeemed',
		refType: ref.refType,
		refId: String(ref.refId),
		note: ref.note,
		createdBy: event.locals.user?.id ?? null
	});
}

/** Money received against an order by hand: a payment row and the order's balance moved on. */
export async function recordOrderPayment(tx: Writer, event: RequestEvent, o: Order, p: PaymentInput) {
	const locked = await applyOrderPayment(tx, event, o.id, p);
	const [res] = await tx.insert(payment).values({
		orderId: o.id,
		provider: p.provider as typeof payment.$inferInsert.provider,
		status: 'succeeded',
		amount: r2(p.amount),
		txRef: manualRef(),
		reference: p.reference ?? null,
		recordedBy: event.locals.user?.id ?? null,
		paidAt: p.paidAt
	});
	if (p.provider === 'store_credit') {
		await spendCredit(tx, event, locked.customerId, p.amount, { refType: 'payment', refId: res.insertId, note: `Paid ${locked.number}` });
	}
	await recordAudit(tx, event, { table: 'payment', recordId: res.insertId, action: 'create' });
	return res.insertId;
}

/**
 * A gateway payment the gateway has confirmed (`verifyTransaction`, never a redirect or webhook
 * body alone): the `initiated` row it started as becomes `succeeded`, and its order is paid. Locks
 * the payment row, so a return visit and a webhook arriving together settle it once.
 */
export async function settleGatewayPayment(
	tx: Writer,
	event: RequestEvent,
	paymentId: number,
	v: { amount: number; providerRef?: string | null; raw: unknown; paidAt: Date }
) {
	const [p] = await tx.select().from(payment).where(eq(payment.id, paymentId)).for('update');
	if (!p || !p.orderId) throw new WriteRefused(null, 'Payment not found.');
	if (p.status === 'succeeded') return false;
	await applyOrderPayment(tx, event, p.orderId, { provider: p.provider, amount: r2(v.amount), paidAt: v.paidAt });
	await tx
		.update(payment)
		.set({ status: 'succeeded', amount: r2(v.amount), providerRef: v.providerRef ?? null, response: v.raw, paidAt: v.paidAt })
		.where(eq(payment.id, p.id));
	return true;
}

/**
 * Money received against an invoice; paid in full closes it. An invoice for an order pays that
 * order too, so its balance, receipt and status follow and it is not paid twice.
 */
export async function recordInvoicePayment(
	tx: Writer,
	event: RequestEvent,
	inv: typeof invoice.$inferSelect,
	p: PaymentInput
) {
	const [cur] = await tx.select().from(invoice).where(eq(invoice.id, inv.id)).for('update');
	if (!cur) throw new WriteRefused(null, 'Invoice not found.');
	if (cur.status === 'void' || cur.status === 'draft') throw new WriteRefused(null, 'Issue the invoice before recording a payment.');
	const balance = r2(Number(cur.total) - Number(cur.amountPaid));
	if (cur.status === 'paid' || balance < 0.005) throw new WriteRefused('amount', `${cur.number} is already paid in full.`);
	if (p.amount > balance + 0.005) throw new WriteRefused('amount', `Only ${balance.toFixed(2)} is still owed on ${cur.number}.`);
	if (cur.orderId) await applyOrderPayment(tx, event, cur.orderId, p);
	const [res] = await tx.insert(payment).values({
		invoiceId: cur.id,
		orderId: cur.orderId,
		provider: p.provider as typeof payment.$inferInsert.provider,
		status: 'succeeded',
		amount: r2(p.amount),
		txRef: manualRef(),
		reference: p.reference ?? null,
		recordedBy: event.locals.user?.id ?? null,
		paidAt: p.paidAt
	});
	if (p.provider === 'store_credit') {
		await spendCredit(tx, event, cur.customerId, p.amount, { refType: 'payment', refId: res.insertId, note: `Paid ${cur.number}` });
	}
	const paid = r2(Number(cur.amountPaid) + p.amount);
	const full = paid + 0.005 >= Number(cur.total);
	const values = { amountPaid: paid, ...(full ? { status: 'paid' as const, paidAt: p.paidAt } : {}) };
	await tx.update(invoice).set(values).where(eq(invoice.id, cur.id));
	await recordAudit(tx, event, { table: 'invoice', recordId: cur.id, action: 'update', before: cur, after: values });
	return res.insertId;
}

/** Refunds that still count against an order: asked for, approved, sent, or paid back. */
const LIVE_REFUNDS = ['requested', 'approved', 'processing', 'succeeded'] as const;
/** Refunds asked for but not yet paid back or failed. */
const OPEN_REFUNDS = ['requested', 'approved', 'processing'] as const;

/**
 * What refunds already claim on an order: the quantity per line still in flight (not yet in the
 * line's `refundedQuantity`), and the money of every refund that has not failed.
 */
export async function refundClaims(tx: Writer, orderId: number) {
	const pending = await tx
		.select({ orderLineId: refundLine.orderLineId, quantity: sql<number>`sum(${refundLine.quantity})`.mapWith(Number) })
		.from(refundLine)
		.innerJoin(refund, eq(refundLine.refundId, refund.id))
		.where(and(eq(refund.orderId, orderId), inArray(refund.status, [...OPEN_REFUNDS])))
		.groupBy(refundLine.orderLineId);
	const [money] = await tx
		.select({ amount: sql<number>`coalesce(sum(${refund.amount}), 0)`.mapWith(Number) })
		.from(refund)
		.where(and(eq(refund.orderId, orderId), inArray(refund.status, [...LIVE_REFUNDS])));
	return { pending: new Map(pending.map((r) => [r.orderLineId, r.quantity])), amount: r2(money?.amount ?? 0) };
}

/** The lines a refund may still cover, with what is left of each once refunds in flight are counted. */
export function refundable(lines: (typeof orderLine.$inferSelect)[], pending: Map<number, number> = new Map()) {
	return lines
		.map((l) => ({ line: l, left: l.quantity - l.refundedQuantity - (pending.get(l.id) ?? 0) }))
		.filter((l) => l.left > 0);
}

/** Money was taken on the order and not all of it given back: it may be refunded, whatever its status. */
export const hasRefundableMoney = (o: Pick<Order, 'amountPaid' | 'amountRefunded'>) =>
	Number(o.amountPaid) - Number(o.amountRefunded) > 0.005;

/**
 * A refund request: one line (part of its quantity) or every line still unrefunded. The order is
 * locked and refunds already asked for are counted, so two requests cannot claim the same money.
 * `amount` is what the lines are worth; `feeRetained` of it is kept when it is paid back.
 */
export async function requestRefund(
	tx: Writer,
	event: RequestEvent,
	orderId: number,
	r: { whole: boolean; orderLineId: number | null; quantity: number | null; restock: boolean; toStoreCredit: boolean; feeRetained: number; reason: string }
) {
	const [o] = await tx.select().from(order).where(eq(order.id, orderId)).for('update');
	if (!o) throw new WriteRefused(null, 'Order not found.');
	if (!hasRefundableMoney(o)) throw new WriteRefused(null, 'Nothing paid on this order is left to refund.');
	const lines = await tx.select().from(orderLine).where(eq(orderLine.orderId, o.id));
	const claims = await refundClaims(tx, o.id);
	const open = refundable(lines, claims.pending);
	const chosen = r.whole
		? open.map((l) => ({ line: l.line, quantity: l.left }))
		: (() => {
				const hit = open.find((l) => l.line.id === r.orderLineId);
				if (!hit) throw new WriteRefused('orderLineId', 'Choose a line that still has something to refund.');
				const quantity = r.quantity ?? hit.left;
				if (quantity < 1 || quantity > hit.left) throw new WriteRefused('quantity', `Between 1 and ${hit.left}.`);
				return [{ line: hit.line, quantity }];
			})();
	if (!chosen.length) throw new WriteRefused(null, 'Nothing on this order is left to refund.');
	const amountOf = (l: typeof orderLine.$inferSelect, q: number) => Math.round((Number(l.lineTotal) / l.quantity) * q * 100) / 100;
	let amount = chosen.reduce((sum, c) => sum + amountOf(c.line, c.quantity), 0);
	// A whole refund gives back the delivery fee too.
	if (r.whole) amount += Number(o.deliveryFee);
	// Never more than was paid, less what other refunds already claim.
	const left = r2(Number(o.amountPaid) - claims.amount);
	if (left < 0.005) throw new WriteRefused(null, 'Refunds already asked for cover everything paid on this order.');
	amount = r2(Math.min(amount, left));
	if (r.feeRetained > amount) throw new WriteRefused('feeRetained', `The fee kept cannot be more than the refund (${amount.toFixed(2)}).`);
	const [gateway] = await tx
		.select({ id: payment.id })
		.from(payment)
		.where(and(eq(payment.orderId, o.id), eq(payment.status, 'succeeded')))
		.limit(1);
	const [res] = await tx.insert(refund).values({
		orderId: o.id,
		paymentId: gateway?.id ?? null,
		status: 'requested',
		amount,
		feeRetained: r2(r.feeRetained),
		toStoreCredit: r.toStoreCredit,
		reason: r.reason,
		requestedBy: event.locals.user?.id ?? null
	});
	await tx.insert(refundLine).values(
		chosen.map((c) => ({
			refundId: res.insertId,
			orderLineId: c.line.id,
			quantity: c.quantity,
			amount: r2(amountOf(c.line, c.quantity)),
			restock: r.restock
		}))
	);
	await recordAudit(tx, event, { table: 'refund', recordId: res.insertId, action: 'create', detail: { orderId: o.id, amount } });
	return res.insertId;
}

type Refund = typeof refund.$inferSelect;

/**
 * Puts a refunded line's bags back where they were sold from: the line's packed `sale` movements
 * in the ledger say which packing run and location. Bags already refunded are taken as coming off
 * the first of them. A line nothing was taken off the shelf for yet has nothing to put back.
 */
async function restockLine(
	tx: Writer,
	line: typeof orderLine.$inferSelect,
	quantity: number,
	note: string,
	userId: string | null
) {
	const sold = await tx
		.select()
		.from(stockMovement)
		.where(
			and(
				eq(stockMovement.stage, 'packed'),
				eq(stockMovement.reason, 'sale'),
				eq(stockMovement.refType, 'order_line'),
				eq(stockMovement.refId, String(line.id))
			)
		)
		.orderBy(stockMovement.id);
	let skip = line.refundedQuantity;
	let left = quantity;
	for (const m of sold) {
		if (left <= 0) break;
		let units = Math.abs(Number(m.quantity));
		const skipped = Math.min(skip, units);
		skip -= skipped;
		units -= skipped;
		const back = Math.min(units, left);
		if (back <= 0 || !m.packingRunId) continue;
		await adjustStock(tx, {
			stage: 'packed',
			itemId: m.packingRunId,
			reason: 'sale_return',
			locationId: m.locationId,
			quantity: back,
			occurredAt: new Date(),
			note,
			userId,
			// Tied to the line, as its `sale` movements are.
			refType: 'order_line',
			refId: line.id
		});
		left -= back;
	}
}

/**
 * Approve, mark sent to the gateway, succeed or fail — with the money moved on success. The refund
 * is re-read locked, so a double-submitted step happens once; on success the order is locked and
 * the money checked again against what was paid.
 */
export async function decideRefund(
	tx: Writer,
	event: RequestEvent,
	refundId: number,
	to: 'approved' | 'processing' | 'succeeded' | 'failed'
) {
	const [rf] = await tx.select().from(refund).where(eq(refund.id, refundId)).for('update');
	if (!rf) throw new WriteRefused(null, 'Refund not found.');
	const allowed: Record<string, string[]> = {
		approved: ['requested'],
		processing: ['approved'],
		succeeded: ['approved', 'processing'],
		failed: ['approved', 'processing']
	};
	if (!allowed[to].includes(rf.status)) throw new WriteRefused(null, `A ${rf.status} refund cannot become ${to}.`);
	const me = event.locals.user?.id ?? null;
	if (to === 'approved' && rf.requestedBy === me && !event.locals.isSuperAdmin) {
		throw new WriteRefused(null, 'Someone other than the person who asked must approve a refund.');
	}
	const values: Partial<Refund> = { status: to };
	if (to === 'approved') values.approvedBy = me;
	if (to === 'succeeded' || to === 'failed') values.processedAt = new Date();

	if (to === 'succeeded') {
		const [o] = await tx.select().from(order).where(eq(order.id, rf.orderId)).for('update');
		const [done] = await tx
			.select({ amount: sql<number>`coalesce(sum(${refund.amount}), 0)`.mapWith(Number) })
			.from(refund)
			.where(and(eq(refund.orderId, o.id), eq(refund.status, 'succeeded')));
		const lines = await tx.select().from(refundLine).where(eq(refundLine.refundId, rf.id));
		const orderLines = await tx.select().from(orderLine).where(eq(orderLine.orderId, o.id));
		// Checked again here: what was paid back already plus this one may not pass what was paid.
		const paidBack = r2((done?.amount ?? 0) + Number(rf.amount));
		if (paidBack > Number(o.amountPaid) + 0.005) {
			throw new WriteRefused(null, `Only ${Math.max(0, Number(o.amountPaid) - (done?.amount ?? 0)).toFixed(2)} paid on ${o.number} is left to refund.`);
		}
		const byId = new Map(orderLines.map((l) => [l.id, l]));
		for (const l of lines) {
			const line = byId.get(l.orderLineId);
			if (!line || line.refundedQuantity + l.quantity > line.quantity) {
				throw new WriteRefused(null, 'A line on this refund has already been refunded in full.');
			}
		}
		const fee = Number(rf.feeRetained);
		const back = r2(Number(rf.amount) - fee);
		const note = `Refund ${rf.id} on ${o.number}`;
		for (const l of lines) {
			const line = byId.get(l.orderLineId)!;
			if (l.restock && line.itemType === 'product') await restockLine(tx, line, l.quantity, note, me);
			await tx
				.update(orderLine)
				.set({
					refundedQuantity: sql`${orderLine.refundedQuantity} + ${l.quantity}`,
					refundedAmount: sql`${orderLine.refundedAmount} + ${l.amount}`
				})
				.where(eq(orderLine.id, l.orderLineId));
		}
		// The money given back is the refund less the fee kept; the order is fully refunded once
		// refunds cover everything paid.
		const refunded = r2(Number(o.amountRefunded) + back);
		await tx
			.update(order)
			.set({
				amountRefunded: refunded,
				paymentState: paidBack + 0.005 >= Number(o.amountPaid) ? 'refunded' : 'partially_refunded'
			})
			.where(eq(order.id, o.id));
		if (rf.toStoreCredit && back > 0) {
			await tx.insert(storeCredit).values({
				customerId: o.customerId,
				amount: back,
				reason: 'refund',
				refType: 'refund',
				refId: String(rf.id),
				note: `Refund on ${o.number}`,
				createdBy: me
			});
		}
	}
	await tx.update(refund).set(values).where(eq(refund.id, rf.id));
	await recordAudit(tx, event, { table: 'refund', recordId: rf.id, action: 'update', before: rf, after: values });
}

/** A discount form's dates and money as the columns hold them. */
export function discountRow(d: {
	startsOn?: string | null;
	expiresOn?: string | null;
	[key: string]: unknown;
}) {
	const { startsOn, expiresOn, ...rest } = d;
	return {
		...rest,
		startsAt: startsOn ? fromLocal(startsOn, '00:00') : null,
		expiresAt: expiresOn ? fromLocal(expiresOn, '23:59') : null
	};
}
