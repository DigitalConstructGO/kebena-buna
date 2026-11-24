/**
 * What the public site's forms share: the spam and flood checks, the customer behind a guest
 * order, a form posted to the staff inbox, a web order, and starting its Chapa payment.
 *
 * Nobody is signed in here, so every `createdBy`/`changedBy` is left empty; the order's channel is
 * `web` and its customer is found (or made) by phone, the customer's main identity (9.1).
 */
import { randomBytes } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { and, count, eq, isNull } from 'drizzle-orm';
import { redirect, type RequestEvent } from '@sveltejs/kit';
import { takeToken } from '@nahu/admin-kit/server/rateLimit';
import { resolveStoredFile } from '@nahu/admin-kit/server/files';
import type { Writer } from '@nahu/admin-kit/server/db';
import { CHAPA_SECRET_KEY } from '$app/env/private';
import { initializeTransaction, verifyTransaction } from '@nahu/admin-kit/server/chapa';
import { settleGatewayPayment } from '#lib/server/orders.ts';
import { queueOrderMessage } from '#lib/server/orderMessages.ts';
import { claimDiscount } from '#lib/server/discounts.ts';
import { db } from '#lib/server/db/index.ts';
import {
	customer,
	discountRedemption,
	formSubmission,
	marketingConsent,
	order,
	orderLine,
	orderStatusHistory,
	payment,
	taxRate,
	workflowHistory
} from '#lib/server/db/schema.ts';
import * as s from '#lib/server/db/schema.ts';
import type { AddressSnapshot } from '#lib/server/db/orders.schema.ts';
import { nextNumber } from '#lib/server/records.ts';
import type { FormType } from '#lib/constants.ts';
import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/i18n.ts';
import { siteHref } from '#lib/site/locale.ts';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * True when a post should be refused: the hidden `website` field (the invisible spam check, 8.4)
 * was filled, or this address has posted `bucket` too often. A trapped bot gets the same success
 * page as a person, so it learns nothing; a flood gets a 429.
 */
export function floodRefused(event: RequestEvent, bucket: string, perMinute = 3) {
	return !takeToken(`site:${bucket}:${event.getClientAddress()}`, {
		capacity: perMinute * 2,
		perMinute
	});
}
export const isTrapped = (data: { website?: string | null }) => Boolean(data.website?.trim());

/**
 * Deletes an upload a public form saved before its write was refused, so repeating a refused
 * post (a second receipt, a duplicate TIN) cannot fill the disk.
 */
export async function discardUpload(name: unknown) {
	if (typeof name !== 'string' || !name) return;
	const file = resolveStoredFile(name);
	if (file) await unlink(file).catch(() => {});
}

/** Who posted: kept on submissions and orders for abuse checks. */
function origin(event: RequestEvent) {
	return {
		ipAddress: event.getClientAddress().slice(0, 45),
		userAgent: (event.request.headers.get('user-agent') ?? '').slice(0, 255) || null
	};
}

type Contact = { name: string; phone: string; email?: string | null };

/**
 * The customer behind a phone number, made on first contact (`source: web`). An existing record
 * keeps its name and email: anyone can type someone else's phone, so a form must not be able to
 * give their record an address that order links are then sent to. The page's language becomes
 * theirs only when new.
 */
export async function customerFor(tx: Writer, c: Contact) {
	const [found] = await tx
		.select({ id: customer.id, email: customer.email, name: customer.name })
		.from(customer)
		.where(and(eq(customer.phone, c.phone), isNull(customer.anonymizedAt)))
		.limit(1);
	if (found) {
		const patch: Partial<typeof customer.$inferInsert> = { lastActivityAt: new Date() };
		if (!found.name) patch.name = c.name;
		await tx.update(customer).set(patch).where(eq(customer.id, found.id));
		return found.id;
	}
	const [res] = await tx.insert(customer).values({
		name: c.name,
		phone: c.phone,
		email: c.email ?? null,
		locale: getLocale(),
		source: 'web',
		lastActivityAt: new Date()
	});
	return res.insertId;
}

/** Marketing consent, when ticked (never pre-ticked, 8.4): an append-only row per channel given. */
export async function recordConsent(
	tx: Writer,
	event: RequestEvent,
	customerId: number,
	c: { phone?: string | null; email?: string | null },
	source: string
) {
	const channels = [c.email ? 'email' : null, c.phone ? 'sms' : null].filter(Boolean) as (
		'email' | 'sms'
	)[];
	if (!channels.length) return;
	await tx.insert(marketingConsent).values(
		channels.map((channel) => ({
			customerId,
			channel,
			granted: true,
			source,
			ipAddress: origin(event).ipAddress
		}))
	);
}

export type Submission = {
	formType: FormType;
	name?: string | null;
	phone?: string | null;
	email?: string | null;
	subject?: string | null;
	message?: string | null;
	rating?: number | null;
	visitDate?: string | null;
	data?: Record<string, unknown>;
	marketingConsent?: boolean;
};

/**
 * A form for the staff inbox (8.5): it lands as `new`, with a first history row. With a phone, the
 * sender is matched to (or made) a customer, so the inbox links them and consent can be kept.
 */
export async function submitForm(event: RequestEvent, s: Submission) {
	return db.transaction(async (tx) => {
		const customerId = s.phone
			? await customerFor(tx, { name: s.name ?? '', phone: s.phone, email: s.email })
			: null;
		const [res] = await tx.insert(formSubmission).values({
			formType: s.formType,
			customerId,
			name: s.name ?? null,
			phone: s.phone ?? null,
			email: s.email ?? null,
			subject: s.subject ?? null,
			message: s.message ?? null,
			rating: s.rating ?? null,
			visitDate: s.visitDate ?? null,
			data: s.data ?? null,
			locale: getLocale(),
			marketingConsent: Boolean(s.marketingConsent),
			...origin(event)
		});
		await tx
			.insert(workflowHistory)
			.values({ submissionId: res.insertId, toStatus: 'new', note: 'Sent from the website' });
		if (customerId && s.marketingConsent) {
			await recordConsent(tx, event, customerId, s, `${s.formType}_form`);
		}
		return res.insertId;
	});
}

/** One line of a web order. Prices include tax (2.6); the line's tax is worked out of its total. */
export type WebLine = Omit<
	typeof orderLine.$inferInsert,
	| 'id'
	| 'orderId'
	| 'taxRate'
	| 'taxAmount'
	| 'lineTotal'
	| 'discountAmount'
	| 'quantity'
	| 'unitPrice'
> & { quantity: number; unitPrice: number; discountAmount?: number };

export type WebOrder = {
	customerId: number;
	contact: Contact;
	lines: WebLine[];
	deliveryMethod?: 'rider' | 'courier' | 'pickup' | 'none';
	deliveryZoneId?: number | null;
	deliveryAddress?: AddressSnapshot | null;
	pickupLocationId?: number | null;
	deliveryFee?: number;
	membershipId?: number | null;
	residencyDeclared?: boolean;
	customerNote?: string | null;
	/** From the form, so a double-submitted checkout makes one order. */
	idempotencyKey?: string | null;
	/** A discount code the buyer typed; refused with `DiscountRefused`. */
	discountCode?: string | null;
};

/** How many web orders one phone may leave waiting for payment at once. */
export const MAX_UNPAID_PER_PHONE = 2;

/**
 * Refused because this phone already has `MAX_UNPAID_PER_PHONE` orders waiting for payment, each
 * holding ticket places or a discount code. Shown under the form's phone field.
 */
export class UnpaidRefused extends Error {
	readonly field = 'phone';
	constructor() {
		super(m.site_err_unpaid({ max: MAX_UNPAID_PER_PHONE }));
		this.name = 'UnpaidRefused';
	}
}

/** The tax on a tax-inclusive amount. */
const taxIn = (gross: number, rate: number) => r2((gross * rate) / (100 + rate));

/**
 * A `pending_payment` web order with its lines, numbered `KC-26-000123` from the year's sequence.
 * Each line's tax comes from its `taxRateId`, or the default rate. Returns the order's id, number,
 * total, line ids (in input order) and its `payToken`, the secret that opens its status page.
 *
 * A discount code is claimed here, in the order's transaction, and spread over the lines it
 * applies to. An order left with nothing to pay (a free event, a 100% code) is completed by the
 * caller with `completeFreeOrder`, once what it sells (a membership, a subscription) is written.
 */
export async function createWebOrder(tx: Writer, event: RequestEvent, o: WebOrder) {
	if (!o.lines.length) throw new Error('An order needs at least one line.');
	// Each unpaid order holds what it sells (places, a code's uses) until it is paid or expires, so
	// one phone may only keep a couple waiting: pay one, or let it lapse, before placing another.
	const [waiting] = await tx
		.select({ n: count() })
		.from(order)
		.where(
			and(
				eq(order.channel, 'web'),
				eq(order.status, 'pending_payment'),
				eq(order.contactPhone, o.contact.phone),
				isNull(order.deletedAt)
			)
		);
	if ((waiting?.n ?? 0) >= MAX_UNPAID_PER_PHONE) throw new UnpaidRefused();
	const rates = await tx
		.select({ id: taxRate.id, rate: taxRate.rate, isDefault: taxRate.isDefault })
		.from(taxRate)
		.where(isNull(taxRate.deletedAt));
	const fallback = rates.find((r) => r.isDefault) ?? null;
	const rateOf = (id: number | null | undefined) => rates.find((r) => r.id === id) ?? fallback;

	const code = o.discountCode
		? await claimDiscount(
				tx,
				o.discountCode,
				o.customerId,
				o.lines.map((l) => ({
					itemType: l.itemType,
					gross: r2(l.unitPrice * l.quantity - (l.discountAmount ?? 0))
				}))
			)
		: null;
	const lines = o.lines.map((l, i) => {
		const rate = rateOf(l.taxRateId);
		const discount = r2((l.discountAmount ?? 0) + (code?.perLine[i] ?? 0));
		const lineTotal = r2(l.unitPrice * l.quantity - discount);
		return {
			...l,
			discountAmount: discount,
			lineTotal,
			taxRateId: rate?.id ?? null,
			taxRate: Number(rate?.rate ?? 0),
			taxAmount: taxIn(lineTotal, Number(rate?.rate ?? 0))
		};
	});
	const deliveryFee = r2(o.deliveryFee ?? 0);
	const subtotal = r2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
	const discountTotal = r2(lines.reduce((sum, l) => sum + l.discountAmount, 0));
	const taxTotal = r2(
		lines.reduce((sum, l) => sum + l.taxAmount, 0) + taxIn(deliveryFee, Number(fallback?.rate ?? 0))
	);
	const total = r2(subtotal - discountTotal + deliveryFee);

	const now = new Date();
	const year = String(now.getFullYear());
	const number = `KC-${year.slice(2)}-${String(await nextNumber(tx, `order:${year}`)).padStart(6, '0')}`;
	const payToken = randomBytes(24).toString('base64url');
	const [res] = await tx.insert(order).values({
		number,
		customerId: o.customerId,
		channel: 'web',
		locale: getLocale(),
		contactName: o.contact.name,
		contactPhone: o.contact.phone,
		contactEmail: o.contact.email ?? null,
		residencyDeclared: Boolean(o.residencyDeclared),
		deliveryMethod: o.deliveryMethod ?? 'none',
		deliveryZoneId: o.deliveryZoneId ?? null,
		deliveryAddress: o.deliveryAddress ?? null,
		pickupLocationId: o.pickupLocationId ?? null,
		membershipId: o.membershipId ?? null,
		discountCodeId: code?.id ?? null,
		subtotal,
		discountTotal,
		deliveryFee,
		taxTotal,
		total,
		payToken,
		payTokenExpiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90),
		idempotencyKey: o.idempotencyKey ?? null,
		customerNote: o.customerNote ?? null,
		placedAt: now,
		ipAddress: origin(event).ipAddress
	} as typeof order.$inferInsert);
	const orderId = res.insertId;
	const lineIds: number[] = [];
	for (const l of lines) {
		const [lr] = await tx
			.insert(orderLine)
			.values({ ...l, orderId } as typeof orderLine.$inferInsert);
		lineIds.push(lr.insertId);
	}
	if (code) {
		await tx
			.insert(discountRedemption)
			.values({ discountCodeId: code.id, orderId, customerId: o.customerId, amount: code.amount });
	}
	// The buyer is sent the order's link at once: it is where they pay, upload a transfer receipt
	// and find their tickets, even if they close this page. A free order is paid straight away and
	// told so then.
	let notified = false;
	if (total > 0) {
		const [placed] = await tx.select().from(order).where(eq(order.id, orderId));
		notified = (await queueOrderMessage(tx, placed, 'pending_payment')) > 0;
	}
	await tx
		.insert(orderStatusHistory)
		.values({ orderId, toStatus: 'pending_payment', note: 'Placed on the website', notified });
	return { id: orderId, number, total, lineIds, payToken };
}

/** The order an idempotency key already made, so a resubmitted form lands on it again. */
export async function orderByIdempotencyKey(key: string | null | undefined) {
	if (!key) return null;
	const [o] = await db
		.select({ number: order.number, payToken: order.payToken })
		.from(order)
		.where(eq(order.idempotencyKey, key))
		.limit(1);
	return o ?? null;
}

/** The page an order's buyer follows: its status, tickets and pay button. */
export const trackHref = (o: { number: string; payToken: string | null }) =>
	`${siteHref(`/track/${encodeURIComponent(o.number)}`, getLocale())}?k=${encodeURIComponent(o.payToken ?? '')}`;

/** Where Chapa's hosted checkout lives: the one outside site a buyer is ever redirected to. */
const CHAPA_CHECKOUT = ['https://checkout.chapa.co'];

/**
 * Sends the buyer on to Chapa's checkout. SvelteKit 3 refuses a redirect to another site unless
 * it is allowed by name, so a bare `redirect(303, url)` here failed every payment with a 500.
 */
export function toCheckout(url: string): never {
	redirect(303, url, { external: CHAPA_CHECKOUT });
}

/** True when Chapa is set up; without it, orders wait for staff to take payment. */
export const paymentsOn = () => Boolean(CHAPA_SECRET_KEY);

/**
 * Starts Chapa's hosted checkout for an order's balance: an `initiated` payment row with our
 * `txRef`, then the checkout URL to send the buyer to. Chapa brings them back to `/pay/{txRef}`,
 * which asks Chapa what happened before anything is marked paid.
 */
export async function startPayment(event: RequestEvent, orderId: number) {
	const [o] = await db.select().from(order).where(eq(order.id, orderId)).limit(1);
	if (!o) throw new Error('Order not found.');
	const amount = r2(Number(o.total) - Number(o.amountPaid));
	const txRef = `KC-TX-${Date.now().toString(36).toUpperCase()}-${randomBytes(8).toString('hex').toUpperCase()}`;
	const [res] = await db
		.insert(payment)
		.values({ orderId: o.id, provider: 'chapa', status: 'initiated', amount, txRef });
	const back = `${event.url.origin}${siteHref(`/pay/${txRef}`, getLocale())}`;
	const checkoutUrl = await initializeTransaction({
		amount,
		name: o.contactName ?? 'Kebena customer',
		email: o.contactEmail,
		phone: o.contactPhone,
		txRef,
		callbackUrl: back,
		returnUrl: back,
		description: `Kebena order ${o.number}`,
		title: 'Kebena Coffee'
	});
	await db
		.update(payment)
		.set({ checkoutUrl, status: 'pending' })
		.where(eq(payment.id, res.insertId));
	return checkoutUrl;
}

/**
 * The stored files the public site may show: the names in public image columns. Private files share
 * the same store (`businessAccount.tradeLicenceFile`, `membershipMember.photo`), so `/media` serves
 * only these. Cached for a minute; a new upload is a new name, so it appears within that.
 */
let imageNames: { at: number; names: Promise<Set<string>> } | null = null;
export function publicImageNames() {
	if (imageNames && Date.now() - imageNames.at < 60_000) return imageNames.names;
	const columns = [
		[s.product, s.product.image],
		[s.productImage, s.productImage.fileName],
		[s.bundle, s.bundle.image],
		[s.event, s.event.image],
		[s.bookable, s.bookable.image],
		[s.membershipPlan, s.membershipPlan.image],
		[s.lot, s.lot.photo],
		[s.station, s.station.photo],
		[s.certification, s.certification.logo],
		[s.page, s.page.heroImage],
		[s.post, s.post.coverImage],
		[s.tourScene, s.tourScene.panorama]
	] as const;
	const names = Promise.all(
		columns.map(([table, column]) =>
			db.selectDistinct({ name: column as typeof s.product.image }).from(table as typeof s.product)
		)
	)
		.then(
			(rows) =>
				new Set(
					rows
						.flat()
						.map((r) => r.name)
						.filter((n): n is string => Boolean(n))
				)
		)
		.catch((err: unknown) => {
			imageNames = null;
			throw err;
		});
	imageNames = { at: Date.now(), names };
	return names;
}

/**
 * Asks Chapa what happened to `txRef` and records the answer: paid settles the order
 * (`settleGatewayPayment`), a definite failure marks the payment failed, anything else waits.
 * Used by the buyer's return (`/pay/{txRef}`) and Chapa's webhook alike; settling twice is a no-op.
 */
export async function settleByTxRef(event: RequestEvent, txRef: string) {
	const [p] = await db.select().from(payment).where(eq(payment.txRef, txRef)).limit(1);
	if (!p?.orderId) return null;
	const [o] = await db
		.select({ number: order.number, payToken: order.payToken })
		.from(order)
		.where(eq(order.id, p.orderId))
		.limit(1);
	if (p.status === 'succeeded') return { order: o, outcome: 'paid' as const };
	const v = await verifyTransaction(txRef);
	// Chapa's answer must be about this payment, in birr, for at least what was asked.
	const matches = v.txRef === txRef && v.currency === 'ETB' && v.amount >= Number(p.amount) - 0.01;
	if (v.paid && !matches) {
		console.error(`[pay] ${txRef}: Chapa says paid but the details differ; left for staff`, v.raw);
		return { order: o, outcome: 'pending' as const };
	}
	if (v.paid) {
		await db.transaction((tx) =>
			settleGatewayPayment(tx, event, p.id, {
				amount: v.amount,
				providerRef: v.reference ?? null,
				raw: v.raw,
				paidAt: new Date()
			})
		);
		return { order: o, outcome: 'paid' as const };
	}
	if (v.failed) {
		await db
			.update(payment)
			.set({ status: 'failed', response: v.raw, failureReason: 'Declined at Chapa' })
			.where(eq(payment.id, p.id));
		return { order: o, outcome: 'failed' as const };
	}
	return { order: o, outcome: 'pending' as const };
}
