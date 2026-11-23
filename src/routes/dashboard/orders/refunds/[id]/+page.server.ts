import { error, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { bad, ok } from '@nahu/admin-kit/server/actionResults';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import { customer, order, orderLine, payment, refund, refundLine } from '#lib/server/db/schema.ts';
import { namesOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { decideRefund } from '#lib/server/orders.ts';
import { tr } from '#lib/format.ts';

async function loadRefund(raw: string) {
	const id = idParam(raw, 'Refund');
	const [rf] = await db.select().from(refund).where(eq(refund.id, id));
	if (!rf) error(404, 'Refund not found');
	return rf;
}

export const load = async ({ params, locals }) => {
	const rf = await loadRefund(params.id);
	const [[o], lines, [pay], names] = await Promise.all([
		db
			.select({ number: order.number, customerId: order.customerId, customer: customer.name, total: order.total, amountPaid: order.amountPaid, amountRefunded: order.amountRefunded, paymentState: order.paymentState })
			.from(order)
			.innerJoin(customer, eq(order.customerId, customer.id))
			.where(eq(order.id, rf.orderId)),
		db
			.select({ id: refundLine.id, orderLineId: refundLine.orderLineId, description: orderLine.description, variantId: orderLine.variantId, sku: orderLine.sku, quantity: refundLine.quantity, amount: refundLine.amount, restock: refundLine.restock })
			.from(refundLine)
			.innerJoin(orderLine, eq(refundLine.orderLineId, orderLine.id))
			.where(eq(refundLine.refundId, rf.id)),
		rf.paymentId
			? db.select({ txRef: payment.txRef, provider: payment.provider }).from(payment).where(eq(payment.id, rf.paymentId))
			: Promise.resolve([]),
		namesOf([rf.requestedBy, rf.approvedBy])
	]);
	const me = locals.user?.id;
	const canDecide = hasPermission(locals, 'refunds.manage');
	return {
		refund: rf,
		order: o,
		payment: pay ?? null,
		lines: lines.map((l) => ({ ...l, description: tr(l.description) })),
		requestedBy: rf.requestedBy ? (names[rf.requestedBy] ?? null) : null,
		approvedBy: rf.approvedBy ? (names[rf.approvedBy] ?? null) : null,
		canDecide,
		// The one who asked may not approve, unless they hold every permission.
		canApprove: canDecide && rf.status === 'requested' && (rf.requestedBy !== me || locals.isSuperAdmin)
	};
};

/** One step of the refund's path, refused with its reason. */
const step = (to: 'approved' | 'processing' | 'succeeded' | 'failed', done: string) =>
	async (event: RequestEvent<{ id: string }>) => {
		requirePermission(event.locals, 'refunds.manage');
		const rf = await loadRefund(event.params.id);
		try {
			await db.transaction((tx) => decideRefund(tx, event, rf.id, to));
		} catch (err) {
			if (err instanceof WriteRefused) return bad(err.message);
			throw err;
		}
		return ok(done);
	};

export const actions = {
	approve: step('approved', 'Refund approved'),
	processing: step('processing', 'Marked as sent to the gateway'),
	succeed: step('succeeded', 'Refund paid back'),
	fail: step('failed', 'Refund marked failed')
};
