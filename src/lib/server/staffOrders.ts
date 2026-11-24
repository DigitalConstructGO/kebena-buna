/**
 * Orders staff take in the dashboard: a sale at the desk, an order by phone or Telegram, and
 * wholesale orders for an approved business account (questionnaire 11).
 *
 * Lines are priced on the server from the catalogue, as the website prices them. A wholesale order
 * then takes its quantity tier — counted in kilograms across the order's coffee — and the account's
 * own discount off each coffee line, and must reach the account's minimum (11.3, 11.4). An account
 * with approved credit can be sent the order now and billed on an invoice due after its terms, as
 * long as what it owes stays within its limit (11.5).
 */
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import type { Writer } from '@nahu/admin-kit/server/db';
import { addLocalDays, localToday } from '@nahu/admin-kit/time';
import type { z } from 'zod/v4';
import {
	businessAccount,
	businessAddress,
	businessMember,
	customer,
	deliveryZone,
	invoice,
	order,
	orderStatusHistory,
	wholesaleTier
} from '#lib/server/db/schema.ts';
import { priceCart, type PricedLine } from '#lib/server/cart.ts';
import { createWebOrder } from '#lib/server/site.ts';
import { recordOrderPayment } from '#lib/server/orders.ts';
import { takeOrderStock } from '#lib/server/stock.ts';
import { readSetting } from '#lib/server/stockReads.ts';
import { memberPerks } from '#lib/server/memberships.ts';
import { nextNumber } from '#lib/server/records.ts';
import { tr } from '#lib/format.ts';
import type { staffOrderSchema } from '#lib/schemas/orders.ts';

type StaffOrder = z.infer<typeof staffOrderSchema>;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Invoices still owed on: issued and not paid off or voided. */
const OWING = ['open', 'overdue'] as const;

/** An approved account with what its terms say, refused when it cannot order. */
export async function wholesaleAccount(tx: Writer, accountId: number) {
	const [a] = await tx
		.select()
		.from(businessAccount)
		.where(and(eq(businessAccount.id, accountId), isNull(businessAccount.deletedAt)));
	if (!a) throw new WriteRefused('businessAccountId', 'Business account not found');
	if (a.approvalStatus !== 'approved')
		throw new WriteRefused('businessAccountId', `${a.name} is not approved yet`);
	if (!a.isActive) throw new WriteRefused('businessAccountId', `${a.name} is switched off`);
	return a;
}

/** What an account owes on invoices it has not paid yet. */
export async function owedBy(tx: Writer, accountId: number) {
	const [row] = await tx
		.select({
			owed: sql<number>`coalesce(sum(${invoice.total} - ${invoice.amountPaid}), 0)`.mapWith(Number)
		})
		.from(invoice)
		.where(
			and(
				eq(invoice.businessAccountId, accountId),
				inArray(invoice.status, [...OWING]),
				isNull(invoice.deletedAt)
			)
		);
	return r2(row?.owed ?? 0);
}

/**
 * Wholesale prices for priced lines: the tier the order's coffee kilograms reach and the account's
 * discount, combined (20% tier and 5% account is 24% off, not 25%) and taken off each coffee line
 * as its discount. Merchandise keeps its retail price.
 */
export async function wholesalePricing(
	tx: Writer,
	lines: PricedLine[],
	accountPct: number,
	minKg: number
) {
	const kg =
		Math.round(
			lines.reduce(
				(sum, l) => sum + (l.kind === 'coffee' ? ((l.grams ?? 0) * l.quantity) / 1000 : 0),
				0
			) * 1000
		) / 1000;
	if (kg < minKg)
		throw new WriteRefused('lines', `A wholesale order is at least ${minKg} kg; this is ${kg} kg`);
	const tiers = await tx
		.select({
			name: wholesaleTier.name,
			minKg: wholesaleTier.minKg,
			maxKg: wholesaleTier.maxKg,
			pct: wholesaleTier.discountPct
		})
		.from(wholesaleTier)
		.where(and(eq(wholesaleTier.status, true), isNull(wholesaleTier.deletedAt)))
		.orderBy(asc(wholesaleTier.minKg));
	const tier =
		tiers.findLast((t) => kg >= Number(t.minKg) && (t.maxKg === null || kg <= Number(t.maxKg))) ??
		null;
	const off = 1 - (1 - Number(tier?.pct ?? 0) / 100) * (1 - accountPct / 100);
	return {
		kg,
		tier: tier ? tr(tier.name) : null,
		pct: Math.round(off * 10000) / 100,
		discounts: lines.map((l) => (l.kind === 'coffee' ? r2(l.lineTotal * off) : 0))
	};
}

/** Who a wholesale order is for when staff did not say: the account's admin, else any member. */
async function accountBuyer(tx: Writer, accountId: number) {
	const [m] = await tx
		.select({ customerId: businessMember.customerId })
		.from(businessMember)
		.where(eq(businessMember.businessAccountId, accountId))
		.orderBy(sql`${businessMember.isAdmin} desc`, asc(businessMember.id))
		.limit(1);
	return m?.customerId ?? null;
}

/**
 * Places a staff order in the caller's transaction and returns its id and number, plus the
 * invoice when it went on credit. Refused (`WriteRefused`, under the form field) when a line is not
 * on sale, a wholesale order is under its minimum, or credit would go over the account's limit.
 */
export async function placeStaffOrder(tx: Writer, event: RequestEvent, d: StaffOrder) {
	const userId = event.locals.user?.id ?? null;
	const cart = await priceCart(
		d.lines.map((l) => ({
			variantId: l.variantId,
			roastLevelId: l.roastLevelId ?? null,
			grindId: l.grindId ?? null,
			packagingId: null,
			quantity: l.quantity
		})),
		{ staff: true }
	);
	if (cart.lines.length !== d.lines.length)
		throw new WriteRefused('lines', 'A line is no longer on sale: reload and choose again');

	const account =
		d.channel === 'wholesale' ? await wholesaleAccount(tx, d.businessAccountId!) : null;
	const customerId = d.customerId ?? (account ? await accountBuyer(tx, account.id) : null) ?? null;
	if (!customerId)
		throw new WriteRefused(
			'customerId',
			account
				? `Add a member to ${account.name} first, or choose the customer`
				: 'Choose the customer'
		);
	const [buyer] = await tx.select().from(customer).where(eq(customer.id, customerId));
	if (!buyer) throw new WriteRefused('customerId', 'Customer not found');

	const pricing = account
		? await wholesalePricing(
				tx,
				cart.lines,
				Number(account.discountPct),
				Number(account.minOrderKg ?? (await readSetting('wholesale.min_order_kg', 5)))
			)
		: null;

	// A member buying for themselves gets their plan's shop discount, as on the website (7.2).
	const perks = account ? null : await memberPerks(tx, customerId);

	// Delivery: the fee staff give, else the zone's — nothing where members ride free.
	let deliveryFee = r2(d.deliveryFee ?? 0);
	if (d.deliveryFee == null && d.deliveryZoneId) {
		const [z] = await tx
			.select({ fee: deliveryZone.fee, freeForMembers: deliveryZone.freeForMembers })
			.from(deliveryZone)
			.where(eq(deliveryZone.id, d.deliveryZoneId));
		deliveryFee = perks?.freeDelivery && z?.freeForMembers ? 0 : r2(Number(z?.fee ?? 0));
	}
	const shipped = d.deliveryMethod === 'rider' || d.deliveryMethod === 'courier';

	const credit =
		Boolean(d.onCredit) && Boolean(account?.creditApproved) && (account?.paymentTermsDays ?? 0) > 0;
	if (d.onCredit && !credit)
		throw new WriteRefused('onCredit', 'This account has no approved credit terms');

	const placed = await createWebOrder(tx, event, {
		customerId,
		contact: {
			name: account?.contactName ?? buyer.name ?? 'Customer',
			phone: account?.contactPhone ?? buyer.phone ?? '',
			email: account?.contactEmail ?? buyer.email ?? null
		},
		deliveryMethod: d.deliveryMethod,
		deliveryZoneId: d.deliveryZoneId ?? null,
		deliveryAddress: shipped
			? {
					recipientName: account?.contactName ?? buyer.name ?? undefined,
					phone: account?.contactPhone ?? buyer.phone ?? undefined,
					city: d.addressCity ?? 'Addis Ababa',
					line1: d.addressLine ?? ''
				}
			: null,
		pickupLocationId: d.deliveryMethod === 'pickup' ? (d.locationId ?? null) : null,
		deliveryFee,
		customerNote: d.customerNote ?? null,
		membershipId: perks?.membershipId ?? null,
		lines: cart.lines.map((l, i) => ({
			itemType: 'product' as const,
			description: l.description,
			sku: l.sku,
			variantId: l.choice.variantId,
			roastLevelId: l.choice.roastLevelId,
			grindId: l.choice.grindId,
			fulfilment: l.fulfilment,
			taxRateId: l.taxRateId,
			quantity: l.quantity,
			unitPrice: l.unitPrice,
			discountAmount:
				pricing?.discounts[i] ?? r2((l.lineTotal * (perks?.shopDiscountPct ?? 0)) / 100)
		})),
		staff: {
			channel: d.channel,
			userId,
			locale: buyer.locale,
			locationId: d.locationId ?? null,
			businessAccountId: account?.id ?? null,
			customerTin: account?.tin ?? null,
			customerBusinessName: account?.name ?? null,
			staffNote:
				[
					pricing ? `Wholesale ${pricing.kg} kg, ${pricing.pct}% off` : null,
					perks?.shopDiscountPct ? `Member ${perks.shopDiscountPct}% off` : null,
					d.staffNote
				]
					.filter(Boolean)
					.join(' · ')
					.slice(0, 500) || null,
			// Paid now or billed on credit: no pay link. Otherwise the buyer is sent one.
			notify: !d.payNow && !credit
		}
	});

	if (d.payNow && placed.total > 0.005) {
		const [o] = await tx.select().from(order).where(eq(order.id, placed.id));
		await recordOrderPayment(tx, event, o, {
			provider: d.payNow,
			amount: placed.total,
			reference: d.payReference ?? null,
			paidAt: new Date()
		});
	}

	let invoiceNumber: string | null = null;
	if (credit && account) {
		invoiceNumber = await sendOnCredit(tx, event, account, placed);
	}
	await recordAudit(tx, event, {
		table: 'orders',
		recordId: placed.id,
		action: 'create',
		detail: { channel: d.channel, total: placed.total, invoice: invoiceNumber }
	});
	return { id: placed.id, number: placed.number, invoiceNumber };
}

/**
 * Bills a wholesale order on the account's credit: refused when what the account already owes and
 * this order together pass its limit. Otherwise an open invoice due after its terms, and the order
 * goes on to be packed and sent now — its coffee comes off the shelf — while its payment state stays
 * unpaid until the invoice is paid (`recordInvoicePayment` pays the order with it).
 */
async function sendOnCredit(
	tx: Writer,
	event: RequestEvent,
	account: typeof businessAccount.$inferSelect,
	placed: { id: number; number: string; total: number }
) {
	// The account's row is locked, so two orders on credit at once are checked one after the other.
	await tx
		.select({ id: businessAccount.id })
		.from(businessAccount)
		.where(eq(businessAccount.id, account.id))
		.for('update');
	const owed = await owedBy(tx, account.id);
	const limit = Number(account.creditLimit);
	if (owed + placed.total > limit + 0.005)
		throw new WriteRefused(
			'onCredit',
			`${account.name} owes ${owed.toFixed(2)} of a ${limit.toFixed(2)} limit; this order (${placed.total.toFixed(2)}) would pass it`
		);
	const [o] = await tx.select().from(order).where(eq(order.id, placed.id));
	const [billing] = await tx
		.select({ line1: businessAddress.line1, city: businessAddress.city })
		.from(businessAddress)
		.where(
			and(
				eq(businessAddress.businessAccountId, account.id),
				eq(businessAddress.isBilling, true),
				isNull(businessAddress.deletedAt)
			)
		)
		.limit(1);
	const year = localToday().slice(0, 4);
	const number = `INV-${year.slice(2)}-${String(await nextNumber(tx, `invoice:${year}`)).padStart(5, '0')}`;
	const userId = event.locals.user?.id ?? null;
	const dueOn = addLocalDays(localToday(), account.paymentTermsDays);
	const [res] = await tx.insert(invoice).values({
		number,
		customerId: o.customerId,
		businessAccountId: account.id,
		orderId: o.id,
		status: 'open',
		billingName: account.name,
		billingTin: account.tin,
		billingAddress: billing ? `${billing.line1}, ${billing.city}`.slice(0, 255) : null,
		subtotal: r2(Number(o.total) - Number(o.taxTotal)),
		taxTotal: Number(o.taxTotal),
		total: Number(o.total),
		issuedAt: new Date(),
		dueOn,
		createdBy: userId
	});
	await recordAudit(tx, event, { table: 'invoice', recordId: res.insertId, action: 'create' });
	// Confirmed for packing and dispatch, though not paid: `paidAt` is stamped when the money comes.
	await tx.update(order).set({ status: 'paid', updatedBy: userId }).where(eq(order.id, o.id));
	await tx.insert(orderStatusHistory).values({
		orderId: o.id,
		fromStatus: 'pending_payment',
		toStatus: 'paid',
		note: `On credit: ${number}, due ${dueOn}`,
		notified: false,
		changedBy: userId
	});
	await takeOrderStock(tx, o.id, userId);
	return number;
}
