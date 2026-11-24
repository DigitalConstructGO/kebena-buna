import { error } from '@sveltejs/kit';
import { fail, message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { db } from '#lib/server/db/index.ts';
import {
	order,
	orderLine,
	orderStatusHistory,
	product,
	ticket,
	ticketType,
	visitSlot
} from '#lib/server/db/schema.ts';
import { fromPriceOf } from '#lib/server/catalog.ts';
import { onSale, productImageUrl } from '#lib/server/cart.ts';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { postedForm, saveUploadedFile, UploadRefused } from '@nahu/admin-kit/server/files';
import { takeToken } from '@nahu/admin-kit/server/rateLimit';
import {
	discardUpload,
	floodRefused,
	paymentsOn,
	startPayment,
	toCheckout
} from '#lib/server/site.ts';
import { latestTransfer, submitTransfer, transferAccounts } from '#lib/server/transfers.ts';
import { transferSchema } from '#lib/schemas/checkout.ts';
import { ticketQr } from '#lib/server/ticketQr.ts';
import { untouchedHoldEndsAt } from '#lib/server/jobs/expireUnpaidOrders.ts';
import { m } from '#lib/i18n.ts';
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

	const payable = o.status === 'pending_payment' && Number(o.total) - Number(o.amountPaid) > 0.005;
	const [lines, history, tickets, accounts, transfer] = await Promise.all([
		db
			.select({
				id: orderLine.id,
				itemType: orderLine.itemType,
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
			.orderBy(asc(ticket.id)),
		payable ? transferAccounts() : [],
		latestTransfer(o.id)
	]);
	// What else to offer, by what the order is: coffee to take home after a visit, a visit after
	// coffee. Not while it is cancelled, and nothing for an order that already has both.
	const visiting = lines.some((l) => ['ticket', 'event_ticket', 'booking'].includes(l.itemType));
	const shopping = lines.some(
		(l) => l.itemType === 'product' || l.itemType === 'subscription_bundle'
	);
	const more =
		o.status === 'cancelled' || (visiting && shopping) ? null : visiting ? 'coffee' : 'visit';
	const coffees =
		more === 'coffee'
			? (
					await db
						.select({
							slug: product.slug,
							name: product.name,
							image: product.image,
							from: fromPriceOf
						})
						.from(product)
						.where(and(onSale, isNotNull(fromPriceOf)))
						.orderBy(asc(product.sortOrder), asc(product.id))
						.limit(3)
				).map((p) => ({
					slug: p.slug,
					name: p.name,
					image: productImageUrl(p),
					from: Number(p.from)
				}))
			: [];

	// A receipt waiting for staff stands in for both ways to pay, so nobody pays twice.
	const waiting = transfer?.status === 'pending' ? transfer : null;

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
		more,
		coffees,
		lines: lines.map((l) => ({
			...l,
			quantity: Number(l.quantity),
			unitPrice: Number(l.unitPrice),
			lineTotal: Number(l.lineTotal)
		})),
		history,
		// Tickets exist once the order is paid (`issueOrderTickets`); live ones carry their signed QR.
		tickets: await Promise.all(
			tickets.map(async (t) => ({
				...t,
				qr: t.status === 'valid' || t.status === 'used' ? (await ticketQr(t)).svg : null
			}))
		),
		// Places or a limited code are held only so long before a payment starts (see the job).
		holdEndsAt: payable && !transfer ? await untouchedHoldEndsAt(o) : null,
		canPay: paymentsOn() && payable && !waiting,
		accounts: waiting ? [] : accounts,
		transfer: transfer && payable ? { ...transfer, amount: Number(transfer.amount) } : null,
		paymentsOn: paymentsOn(),
		transferForm: await superValidate(
			// One account needs no choosing.
			{ bankAccountId: accounts.length === 1 ? accounts[0].id : undefined },
			zod4(transferSchema),
			{ id: 'transfer', errors: false }
		),
		outcome: url.searchParams.get('pay')
	};
};

export const actions: Actions = {
	pay: async (event) => {
		if (floodRefused(event, 'pay', 6)) return fail(429, { payError: m.site_err_flood() });
		const o = await orderFor(event.params.number, event.url.searchParams.get('k'));
		if (!o) error(404, m.track_not_found());
		if (o.status !== 'pending_payment' || !paymentsOn())
			return fail(400, { payError: m.track_pay_unavailable() });
		if ((await latestTransfer(o.id))?.status === 'pending')
			return fail(409, { payError: m.track_transfer_err_waiting() });
		let url: string;
		try {
			url = await startPayment(event, o.id);
		} catch (err) {
			console.error('[pay] could not start Chapa checkout:', err);
			return fail(502, { payError: m.track_pay_failed() });
		}
		toCheckout(url);
	},

	/** Paid by bank transfer: the receipt, kept private, for staff to check against the statement. */
	transfer: async (event) => {
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(transferSchema), { id: 'transfer' });
		if (floodRefused(event, 'pay', 6)) return message(form, m.site_err_flood(), { status: 429 });
		const o = await orderFor(event.params.number, event.url.searchParams.get('k'));
		if (!o) error(404, m.track_not_found());
		if (!form.valid) return fail(400, { form });
		// Checked again under the lock in `submitTransfer`; this one spares storing a file for nothing.
		if (o.status !== 'pending_payment')
			return message(form, m.track_transfer_err_closed(), { status: 409 });
		// Up to 10 MB each: a few per order, so one order cannot be used to fill the disk.
		if (!takeToken(`site:receipt:${o.id}`, { capacity: 3, perMinute: 0.2 }))
			return message(form, m.site_err_flood(), { status: 429 });
		const d = form.data;
		let receiptFile: string | undefined;
		try {
			receiptFile = await saveUploadedFile(d.receipt);
			await submitTransfer(o.id, {
				bankAccountId: d.bankAccountId,
				reference: d.reference ?? null,
				receiptFile
			});
		} catch (err) {
			await discardUpload(receiptFile);
			if (err instanceof UploadRefused)
				return setError(form, 'receipt', m.track_transfer_err_file());
			if (err instanceof WriteRefused) {
				return err.field === 'bankAccountId'
					? setError(form, 'bankAccountId', err.message)
					: message(form, err.message, { status: 409 });
			}
			throw err;
		}
		// The page reloads into "we have your receipt".
		return message(form, 'ok');
	}
};
