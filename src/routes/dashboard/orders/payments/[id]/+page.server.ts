import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { customer, invoice, order, payment, refund } from '#lib/server/db/schema.ts';
import { namesOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';

export const load = async ({ params }) => {
	const id = idParam(params.id, 'Payment');
	const [row] = await db
		.select({
			payment,
			orderNumber: order.number,
			invoiceNumber: invoice.number,
			customerId: customer.id,
			customer: customer.name
		})
		.from(payment)
		.leftJoin(order, eq(payment.orderId, order.id))
		.leftJoin(invoice, eq(payment.invoiceId, invoice.id))
		.leftJoin(customer, eq(customer.id, order.customerId))
		.where(eq(payment.id, id));
	if (!row) error(404, 'Payment not found');
	const [refunds, names] = await Promise.all([
		db
			.select({ id: refund.id, status: refund.status, amount: refund.amount, reason: refund.reason, createdAt: refund.createdAt })
			.from(refund)
			.where(eq(refund.paymentId, id)),
		namesOf([row.payment.recordedBy])
	]);
	return {
		...row,
		recordedBy: row.payment.recordedBy ? (names[row.payment.recordedBy] ?? null) : null,
		refunds,
		response: row.payment.response ? JSON.stringify(row.payment.response, null, 2) : null
	};
};
