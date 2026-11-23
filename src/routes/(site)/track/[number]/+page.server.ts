import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { db } from '#lib/server/db/index.ts';
import { order, orderLine, orderStatusHistory, ticket, ticketType, visitSlot } from '#lib/server/db/schema.ts';
import { floodRefused, paymentsOn, startPayment } from '#lib/server/site.ts';
import { ticketQr } from '#lib/server/ticketQr.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

/** The order, if `k` is its `payToken`: the secret in the link the buyer was given. */
async function orderFor(number: string, k: string | null) {
	const [o] = await db.select().from(order).where(eq(order.number, number)).limit(1);
	if (!o?.payToken || !k) return null;
	const a = Buffer.from(o.payToken);
	const b = Buffer.from(k);
	return a.length === b.length && timingSafeEqual(a, b) ? o : null;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const o = await orderFor(params.number, url.searchParams.get('k'));
	if (!o) error(404, m.track_not_found());

	const [lines, history, tickets] = await Promise.all([
		db
			.select({
				id: orderLine.id,
				description: orderLine.description,
				quantity: orderLine.quantity,
				unitPrice: orderLine.unitPrice,
				lineTotal: orderLine.lineTotal
			})
			.from(orderLine)
			.where(eq(orderLine.orderId, o.id))
			.orderBy(asc(orderLine.id)),
		db
			.select({ toStatus: orderStatusHistory.toStatus, at: orderStatusHistory.createdAt })
			.from(orderStatusHistory)
			.where(eq(orderStatusHistory.orderId, o.id))
			.orderBy(desc(orderStatusHistory.id)),
		db
			.select({
				code: ticket.code,
				visitDate: ticket.visitDate,
				admits: ticket.admits,
				status: ticket.status,
				type: ticketType.name,
				startsAt: visitSlot.startsAt
			})
			.from(ticket)
			.innerJoin(ticketType, eq(ticket.ticketTypeId, ticketType.id))
			.leftJoin(visitSlot, eq(ticket.visitSlotId, visitSlot.id))
			.where(and(eq(ticket.orderId, o.id)))
			.orderBy(asc(ticket.id))
	]);

	return {
		order: {
			number: o.number,
			status: o.status,
			paymentState: o.paymentState,
			placedAt: o.placedAt,
			contactName: o.contactName,
			deliveryMethod: o.deliveryMethod,
			deliveryAddress: o.deliveryAddress,
			pickupCode: o.pickupCode,
			subtotal: Number(o.subtotal),
			discountTotal: Number(o.discountTotal),
			deliveryFee: Number(o.deliveryFee),
			taxTotal: Number(o.taxTotal),
			total: Number(o.total),
			amountPaid: Number(o.amountPaid),
			receiptNumber: o.receiptNumber
		},
		lines: lines.map((l) => ({ ...l, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), lineTotal: Number(l.lineTotal) })),
		history,
		// Tickets exist once the order is paid (`issueOrderTickets`); live ones carry their signed QR.
		tickets: await Promise.all(
			tickets.map(async (t) => ({
				...t,
				qr: t.status === 'valid' || t.status === 'used' ? (await ticketQr(t)).svg : null
			}))
		),
		canPay: paymentsOn() && o.status === 'pending_payment' && Number(o.total) - Number(o.amountPaid) > 0.005,
		paymentsOn: paymentsOn(),
		outcome: url.searchParams.get('pay')
	};
};

export const actions: Actions = {
	pay: async (event) => {
		if (floodRefused(event, 'pay', 6)) return fail(429, { payError: m.site_err_flood() });
		const o = await orderFor(event.params.number, event.url.searchParams.get('k'));
		if (!o) error(404, m.track_not_found());
		if (o.status !== 'pending_payment' || !paymentsOn()) return fail(400, { payError: m.track_pay_unavailable() });
		let url: string;
		try {
			url = await startPayment(event, o.id);
		} catch (err) {
			console.error('[pay] could not start Chapa checkout:', err);
			return fail(502, { payError: m.track_pay_failed() });
		}
		redirect(303, url);
	}
};
