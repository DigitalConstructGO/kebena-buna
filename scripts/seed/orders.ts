/**
 * Orders, payments, refunds, invoices and discount codes (questionnaire 2.6, 2.7, 3).
 *
 * Shop orders are made from the catalogue's variants; when the visits, memberships, bookings,
 * wholesale and inventory seeds have run first, their tickets, memberships, bookings, business
 * accounts and roast batches are sold through orders too and linked back. Without them those
 * parts are skipped.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
	db,
	schema as s,
	insertId,
	L,
	between,
	pick,
	rand,
	daysFrom,
	isoFrom,
	shortCode
} from './db.ts';
import { userIdByEmail } from './base.ts';

type Status = (typeof s.order.$inferInsert)['status'] & string;
type Line = typeof s.orderLine.$inferInsert;

const VAT = 15;
const r2 = (n: number) => Math.round(n * 100) / 100;
const taxIn = (gross: number, rate = VAT) => r2((gross * rate) / (100 + rate));
const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

let orderSeq = 0;
let receiptSeq = 0;
let txSeq = 0;
let invoiceSeq = 0;
const orderNumber = () => `KC-26-${String(++orderSeq).padStart(6, '0')}`;
const receiptNumber = () => `R-26-${String(++receiptSeq).padStart(6, '0')}`;
const txRef = () =>
	`KC-TX-${Date.now().toString(36).toUpperCase()}-${String(++txSeq).padStart(5, '0')}`;
const invoiceNumber = () => `INV-26-${String(++invoiceSeq).padStart(5, '0')}`;

/** The fulfilment path an order's status walks, for its delivery method (questionnaire 3.2). */
function pathFor(method: string, roast: boolean): Status[] {
	const head: Status[] = [
		'pending_payment',
		'paid',
		...(roast ? (['roasting'] as Status[]) : []),
		'packed'
	];
	if (method === 'pickup') return [...head, 'ready_for_pickup', 'collected', 'completed'];
	if (method === 'none') return ['pending_payment', 'paid', 'completed'];
	return [...head, 'out_for_delivery', 'delivered', 'completed'];
}

export async function seed() {
	const owner = await userIdByEmail('owner@kebena.coffee');
	const manager = await userIdByEmail('manager@kebena.coffee');
	const shop = await userIdByEmail('shop@kebena.coffee');
	const rider = await userIdByEmail('rider@kebena.coffee');
	const accounts = await userIdByEmail('accounts@kebena.coffee');

	// ── Discount codes ────────────────────────────────────────────────────────────────────────
	const codes = {
		welcome: await insertId(s.discountCode, {
			code: 'WELCOME10',
			description: 'First order 10% off',
			kind: 'percent',
			value: 10,
			minOrderAmount: 500,
			maxDiscountAmount: 400,
			appliesTo: ['product'],
			startsAt: daysFrom(-150),
			expiresAt: daysFrom(200),
			usageLimit: 500,
			perCustomerLimit: 1,
			createdBy: manager
		}),
		meskel: await insertId(s.discountCode, {
			code: 'MESKEL200',
			description: 'Meskel season ETB 200 off',
			kind: 'fixed',
			value: 200,
			minOrderAmount: 1500,
			startsAt: daysFrom(-90),
			expiresAt: daysFrom(-50),
			usageLimit: 200,
			createdBy: manager
		}),
		tickets: await insertId(s.discountCode, {
			code: 'MUSEUM15',
			description: '15% off tickets and events',
			kind: 'percent',
			value: 15,
			appliesTo: ['ticket', 'event_ticket'],
			startsAt: daysFrom(-60),
			expiresAt: daysFrom(60),
			createdBy: manager
		}),
		launch: await insertId(s.discountCode, {
			code: 'LAUNCH50',
			description: 'Launch week, first 20 orders',
			kind: 'percent',
			value: 50,
			maxDiscountAmount: 600,
			startsAt: daysFrom(-125),
			expiresAt: daysFrom(-118),
			usageLimit: 20,
			usedCount: 0,
			createdBy: owner
		}),
		staff: await insertId(s.discountCode, {
			code: 'STAFF25',
			description: 'Staff purchases (switched off)',
			kind: 'percent',
			value: 25,
			isActive: false,
			createdBy: owner
		})
	};
	const codeRows = await db.select().from(s.discountCode);
	const codeById = new Map(codeRows.map((c) => [c.id, c]));

	// ── What there is to sell ─────────────────────────────────────────────────────────────────
	const variants = await db
		.select({
			id: s.productVariant.id,
			sku: s.productVariant.sku,
			price: s.productVariant.price,
			productId: s.product.id,
			product: s.product.name,
			variantName: s.productVariant.name,
			size: s.bagSize.name,
			kind: s.product.kind,
			fulfilment: s.product.fulfilment,
			taxRateId: s.product.taxRateId
		})
		.from(s.productVariant)
		.innerJoin(s.product, eq(s.productVariant.productId, s.product.id))
		.leftJoin(s.bagSize, eq(s.productVariant.bagSizeId, s.bagSize.id))
		.where(isNull(s.productVariant.deletedAt));
	const roastLevels = await db.select().from(s.roastLevel);
	const grinds = await db.select().from(s.grind);
	const allowedRoasts = await db.select().from(s.productRoastLevel);
	const [standardBag] = await db.select().from(s.packaging).where(eq(s.packaging.code, 'STANDARD'));
	const [vat] = await db.select().from(s.taxRate).where(eq(s.taxRate.code, 'VAT15'));
	const zones = await db.select().from(s.deliveryZone);
	const areas = await db.select().from(s.deliveryArea);
	const couriers = await db.select().from(s.courier);
	const locs = await db.select().from(s.location);
	const locId = (code: string) => locs.find((l) => l.code === code)!.id;
	const customers = await db.select().from(s.customer);
	const addresses = await db.select().from(s.customerAddress);
	const batches = await db
		.select()
		.from(s.roastBatch)
		.catch(() => []);
	const businesses = await db
		.select()
		.from(s.businessAccount)
		.where(eq(s.businessAccount.approvalStatus, 'approved'))
		.catch(() => []);
	const members = await db
		.select()
		.from(s.businessMember)
		.catch(() => []);

	const coffee = variants.filter((v) => v.kind === 'coffee');
	const describe = (v: (typeof variants)[number]) => {
		const size = v.size ?? v.variantName ?? {};
		return {
			en: `${v.product.en} — ${size.en ?? ''}`.trim(),
			...(v.product.am ? { am: `${v.product.am} — ${size.am ?? size.en ?? ''}` } : {})
		};
	};

	/** Writes one order with its lines, history, payments; returns its id and lines. */
	async function writeOrder(opts: {
		customer: (typeof customers)[number];
		channel: 'web' | 'desk' | 'telegram' | 'wholesale' | 'admin';
		placedAt: Date;
		lines: Omit<Line, 'orderId'>[];
		method: 'rider' | 'courier' | 'pickup' | 'none';
		target: Status;
		failed?: boolean;
		codeId?: number | null;
		businessAccountId?: number | null;
		locationId?: number | null;
		roast?: boolean;
	}) {
		const { customer, channel, placedAt, method, target } = opts;
		// Discount: the code's rule over the lines it applies to.
		let discountTotal = 0;
		const code = opts.codeId ? codeById.get(opts.codeId) : undefined;
		const gross = opts.lines.reduce(
			(sum, l) => sum + Number(l.unitPrice) * Number(l.quantity ?? 1),
			0
		);
		if (code) {
			discountTotal =
				code.kind === 'percent' ? r2((gross * Number(code.value)) / 100) : Number(code.value);
			if (code.maxDiscountAmount)
				discountTotal = Math.min(discountTotal, Number(code.maxDiscountAmount));
			discountTotal = Math.min(discountTotal, gross);
		}
		const lines = opts.lines.map((l) => {
			const lineGross = Number(l.unitPrice) * Number(l.quantity ?? 1);
			const share = gross ? r2((discountTotal * lineGross) / gross) : 0;
			const lineTotal = r2(lineGross - share);
			return {
				...l,
				discountAmount: share,
				lineTotal,
				taxRate: VAT,
				taxRateId: vat.id,
				taxAmount: taxIn(lineTotal)
			};
		});
		const zone =
			method === 'pickup'
				? zones.find((z) => z.code === 'PICKUP')
				: method === 'courier'
					? zones.find((z) => z.code === 'REGIONS')
					: method === 'rider'
						? pick(zones.filter((z) => z.code.startsWith('ZONE')))
						: undefined;
		const subtotal = r2(gross);
		const freeDelivery = zone?.freeAbove != null && subtotal >= Number(zone.freeAbove);
		const deliveryFee = zone && !freeDelivery ? Number(zone.fee) : 0;
		const total = r2(subtotal - discountTotal + deliveryFee);
		const taxTotal = r2(lines.reduce((sum, l) => sum + l.taxAmount, 0) + taxIn(deliveryFee));

		const path = pathFor(method, Boolean(opts.roast));
		const cancelled = target === 'cancelled';
		const reach = cancelled ? (rand() < 0.5 ? 1 : 2) : path.indexOf(target) + 1;
		const walked = path.slice(0, Math.max(1, reach));
		const at: Date[] = [];
		let t = placedAt;
		for (let i = 0; i < walked.length; i++) {
			at.push(t);
			t = addMinutes(t, i === 0 ? between(2, 30) : between(60, 60 * 30));
		}
		const reached = (st: Status) => walked.indexOf(st);
		const paid = reached('paid') >= 0;
		const cancelledAt = cancelled ? addMinutes(at[at.length - 1], between(30, 600)) : null;

		const area =
			method === 'rider' || method === 'courier'
				? addresses.find((a) => a.customerId === customer.id)
				: undefined;
		const areaName = area ? areas.find((a) => a.id === area.areaId)?.name?.en : undefined;
		const status: Status = cancelled ? 'cancelled' : walked[walked.length - 1];
		const orderId = await insertId(s.order, {
			number: orderNumber(),
			channel,
			customerId: customer.id,
			businessAccountId: opts.businessAccountId ?? null,
			locationId: opts.locationId ?? (method === 'none' ? locId('SHOP') : locId('WAREHOUSE')),
			status,
			paymentState: paid ? 'paid' : opts.failed ? 'failed' : 'unpaid',
			locale: customer.locale,
			contactName: customer.name,
			contactPhone: customer.phone,
			contactEmail: customer.email,
			customerTin: customer.tin,
			customerBusinessName: customer.businessName,
			deliveryMethod: method,
			deliveryZoneId: zone?.id ?? null,
			addressId: area?.id ?? null,
			deliveryAddress: area
				? {
						recipientName: area.recipientName ?? undefined,
						phone: area.phone ?? undefined,
						area: areaName,
						city: method === 'courier' ? pick(['Adama', 'Hawassa', 'Jimma']) : area.city,
						line1: area.line1,
						landmark: area.landmark ?? undefined
					}
				: null,
			pickupLocationId: method === 'pickup' ? locId('SITE-A') : null,
			pickupCode: method === 'pickup' ? shortCode(8) : null,
			riderId: method === 'rider' && reached('out_for_delivery') >= 0 ? rider : null,
			courierId:
				method === 'courier' && reached('out_for_delivery') >= 0 ? pick(couriers).id : null,
			trackingNumber:
				method === 'courier' && reached('out_for_delivery') >= 0
					? `EE${between(100000000, 999999999)}ET`
					: null,
			expectedDispatchOn:
				method === 'none' ? null : isoOf(addMinutes(placedAt, 60 * 24 * (opts.roast ? 3 : 1))),
			subtotal,
			discountTotal,
			deliveryFee,
			taxTotal,
			total,
			amountPaid: paid ? total : 0,
			discountCodeId: code?.id ?? null,
			receiptNumber: paid ? receiptNumber() : null,
			payToken: !paid && !cancelled ? shortCode(24) : null,
			payTokenExpiresAt: !paid && !cancelled ? addMinutes(placedAt, 60 * 24) : null,
			idempotencyKey: channel === 'web' ? `idem-${orderSeq}-${shortCode(10)}` : null,
			customerNote:
				rand() < 0.15
					? pick([
							'Please call before delivery.',
							'Gift — no receipt in the box please.',
							'Leave with the guard.'
						])
					: null,
			staffNote: rand() < 0.08 ? 'Customer asked to swap grind — done.' : null,
			placedAt,
			paidAt: paid ? at[reached('paid')] : null,
			dispatchedAt:
				reached('out_for_delivery') >= 0
					? at[reached('out_for_delivery')]
					: reached('ready_for_pickup') >= 0
						? at[reached('ready_for_pickup')]
						: null,
			completedAt: reached('completed') >= 0 ? at[reached('completed')] : null,
			cancelledAt,
			cancelReason: cancelled
				? paid
					? 'Out of stock — refunded in full'
					: opts.failed
						? 'Payment failed'
						: 'Payment link expired'
				: null,
			ipAddress: channel === 'web' ? `196.188.${between(1, 254)}.${between(1, 254)}` : null,
			createdBy: channel === 'desk' || channel === 'admin' ? shop : null,
			createdAt: placedAt
		});
		const lineIds: number[] = [];
		for (const l of lines) lineIds.push(await insertId(s.orderLine, { ...l, orderId }));

		// History: every step walked, then the cancellation.
		const history = walked.map((st, i) => ({
			orderId,
			fromStatus: i === 0 ? null : walked[i - 1],
			toStatus: st,
			changedBy: i <= 1 && channel !== 'desk' ? null : pick([shop, manager, rider]),
			notified: i > 0 && channel !== 'desk',
			note:
				st === 'roasting'
					? 'Roast day batch'
					: st === 'out_for_delivery' && method === 'courier'
						? 'Handed to courier'
						: null,
			createdAt: at[i]
		}));
		if (cancelled)
			history.push({
				orderId,
				fromStatus: walked[walked.length - 1],
				toStatus: 'cancelled',
				changedBy: paid ? manager : null,
				notified: true,
				note: null,
				createdAt: cancelledAt!
			});
		await db.insert(s.orderStatusHistory).values(history);

		// Payments: what was tried and what succeeded.
		const provider =
			channel === 'desk'
				? pick(['desk_cash', 'desk_card'] as const)
				: channel === 'wholesale'
					? 'bank_transfer'
					: pick(['chapa', 'chapa', 'telebirr', 'cbe_birr'] as const);
		const manual =
			provider === 'desk_cash' || provider === 'desk_card' || provider === 'bank_transfer';
		if (opts.failed) {
			await db.insert(s.payment).values({
				orderId,
				provider: 'chapa',
				method: 'telebirr',
				status: 'failed',
				amount: total,
				txRef: txRef(),
				failureReason: 'Customer cancelled on the wallet',
				response: { status: 'failed', message: 'Transaction cancelled by user' },
				createdAt: addMinutes(placedAt, 3),
				updatedAt: addMinutes(placedAt, 6)
			});
		}
		let paymentId: number | null = null;
		if (paid) {
			paymentId = await insertId(s.payment, {
				orderId,
				provider,
				method: provider === 'chapa' ? pick(['telebirr', 'visa', 'cbebirr', 'mpesa']) : null,
				status: 'succeeded',
				amount: total,
				fee: provider === 'chapa' ? r2(total * 0.025) : 0,
				txRef: txRef(),
				providerRef: manual ? null : `CHP-${shortCode(12)}`,
				checkoutUrl: manual ? null : `https://checkout.chapa.co/checkout/payment/${shortCode(20)}`,
				response: manual
					? null
					: {
							status: 'success',
							data: { amount: total, currency: 'ETB', charge: r2(total * 0.025) }
						},
				reference:
					provider === 'bank_transfer'
						? `CBE-${between(10000000, 99999999)}`
						: provider === 'desk_cash'
							? `DESK-${between(1000, 9999)}`
							: null,
				recordedBy: manual ? (channel === 'desk' ? shop : accounts) : null,
				paidAt: at[reached('paid')],
				createdAt: at[0],
				updatedAt: at[reached('paid')]
			});
		} else if (!cancelled && channel === 'web') {
			await db.insert(s.payment).values({
				orderId,
				provider: 'chapa',
				status: 'initiated',
				amount: total,
				txRef: txRef(),
				checkoutUrl: `https://checkout.chapa.co/checkout/payment/${shortCode(20)}`,
				createdAt: addMinutes(placedAt, 1),
				updatedAt: addMinutes(placedAt, 1)
			});
		}

		if (code) {
			await db.insert(s.discountRedemption).values({
				discountCodeId: code.id,
				orderId,
				customerId: customer.id,
				amount: discountTotal,
				createdAt: placedAt
			});
			await db
				.update(s.discountCode)
				.set({ usedCount: sql`${s.discountCode.usedCount} + 1` })
				.where(eq(s.discountCode.id, code.id));
		}
		return {
			orderId,
			lineIds,
			lines,
			paymentId,
			total,
			paid,
			cancelled,
			at: cancelledAt ?? at[at.length - 1],
			status
		};
	}

	function isoOf(d: Date) {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function productLines(count: number): { lines: Omit<Line, 'orderId'>[]; roast: boolean } {
		const lines: Omit<Line, 'orderId'>[] = [];
		let roast = false;
		const chosen = new Set<number>();
		for (let i = 0; i < count; i++) {
			const v = rand() < 0.85 ? pick(coffee) : pick(variants);
			if (chosen.has(v.id)) continue;
			chosen.add(v.id);
			const allowed = allowedRoasts.filter((a) => a.productId === v.productId);
			const roastLevelId =
				v.kind === 'coffee'
					? allowed.length
						? pick(allowed).roastLevelId
						: pick(roastLevels).id
					: null;
			if (v.fulfilment === 'roast_to_order') roast = true;
			lines.push({
				itemType: 'product',
				description: describe(v),
				sku: v.sku,
				variantId: v.id,
				roastLevelId,
				grindId: v.kind === 'coffee' ? pick(grinds).id : null,
				packagingId: v.kind === 'coffee' ? standardBag.id : null,
				fulfilment: v.fulfilment,
				quantity: rand() < 0.75 ? 1 : between(2, 4),
				unitPrice: Number(v.price)
			});
		}
		return { lines, roast };
	}

	// ── ~150 shop orders over 120 days ────────────────────────────────────────────────────────
	const written: Awaited<ReturnType<typeof writeOrder>>[] = [];
	const launchUses = { n: 0 };
	for (let i = 0; i < 150; i++) {
		const daysAgo = Math.floor(Math.pow(rand(), 1.8) * 120);
		const placedAt = daysFrom(-daysAgo, between(8, 20), between(0, 59));
		const channel = pick([
			'web',
			'web',
			'web',
			'web',
			'desk',
			'desk',
			'telegram',
			'wholesale'
		] as const);
		const customer = pick(customers);
		const method =
			channel === 'desk'
				? 'none'
				: channel === 'wholesale'
					? 'rider'
					: pick(['rider', 'rider', 'rider', 'pickup', 'courier'] as const);
		const { lines, roast } = productLines(channel === 'wholesale' ? 2 : between(1, 3));
		if (channel === 'wholesale') for (const l of lines) l.quantity = between(5, 20);

		// Older orders are finished; recent ones are anywhere along the path.
		const path = pathFor(method, roast);
		let target: Status;
		let failed = false;
		const roll = rand();
		if (roll < 0.07) {
			target = 'cancelled';
			failed = rand() < 0.5;
		} else if (daysAgo > 10) target = 'completed';
		else target = path[between(daysAgo < 2 ? 0 : 1, path.length - 1)];
		if (daysAgo > 10 && rand() < 0.2) target = path[path.length - 2]; // delivered/collected, not yet closed

		let codeId: number | null = null;
		if (daysAgo >= 118 && daysAgo <= 125 && launchUses.n < 20) {
			codeId = codes.launch;
			launchUses.n++;
		} else if (daysAgo >= 50 && daysAgo <= 90 && rand() < 0.25) codeId = codes.meskel;
		else if (rand() < 0.12 && channel === 'web') codeId = codes.welcome;
		const gross = lines.reduce((sum, l) => sum + Number(l.unitPrice) * Number(l.quantity ?? 1), 0);
		const c = codeId ? codeById.get(codeId) : undefined;
		if (c && gross < Number(c.minOrderAmount)) codeId = null;

		let businessAccountId: number | null = null;
		let buyer = customer;
		if (channel === 'wholesale' && businesses.length) {
			const b = pick(businesses);
			businessAccountId = b.id;
			const m = members.find((mm) => mm.businessAccountId === b.id);
			if (m) buyer = customers.find((cc) => cc.id === m.customerId) ?? customer;
		}
		written.push(
			await writeOrder({
				customer: buyer,
				channel,
				placedAt,
				lines,
				method,
				target,
				failed,
				codeId,
				businessAccountId,
				roast
			})
		);
	}

	// Roast-to-order lines past roasting carry the batch they were roasted in.
	if (batches.length) {
		const rtoLines = await db
			.select({
				id: s.orderLine.id,
				variantId: s.orderLine.variantId,
				roastLevelId: s.orderLine.roastLevelId,
				status: s.order.status
			})
			.from(s.orderLine)
			.innerJoin(s.order, eq(s.orderLine.orderId, s.order.id))
			.where(eq(s.orderLine.fulfilment, 'roast_to_order'));
		for (const l of rtoLines) {
			if (['pending_payment', 'paid', 'cancelled'].includes(l.status)) continue;
			const v = variants.find((vv) => vv.id === l.variantId);
			const batch =
				batches.find((b) => b.productId === v?.productId && b.roastLevelId === l.roastLevelId) ??
				batches.find((b) => b.productId === v?.productId) ??
				pick(batches);
			await db.update(s.orderLine).set({ roastBatchId: batch.id }).where(eq(s.orderLine.id, l.id));
		}
	}
	// Roast-to-order lines still waiting are queued for the next roast day.
	await db.execute(
		sql`update order_line ol join orders o on o.id = ol.order_id set ol.roast_on = date_add(date(o.placed_at), interval 2 day) where ol.fulfilment = 'roast_to_order'`
	);

	// ── Refunds ───────────────────────────────────────────────────────────────────────────────
	const paidOrders = written.filter((o) => o.paid && !o.cancelled && o.paymentId);
	// Full refunds on the paid cancellations.
	for (const o of written.filter((w) => w.paid && w.cancelled && w.paymentId)) {
		const refundId = await insertId(s.refund, {
			orderId: o.orderId,
			paymentId: o.paymentId,
			status: 'succeeded',
			amount: o.total,
			reason: 'Out of stock — cancelled by the shop',
			isAutomatic: false,
			requestedBy: shop,
			approvedBy: manager,
			processedAt: addMinutes(o.at, 60),
			providerRef: `RF-${shortCode(10)}`,
			createdAt: o.at
		});
		for (const [k, lineId] of o.lineIds.entries()) {
			const l = o.lines[k];
			await db.insert(s.refundLine).values({
				refundId,
				orderLineId: lineId,
				quantity: Number(l.quantity ?? 1),
				amount: l.lineTotal,
				restock: true
			});
			await db
				.update(s.orderLine)
				.set({ refundedQuantity: Number(l.quantity ?? 1), refundedAmount: l.lineTotal })
				.where(eq(s.orderLine.id, lineId));
		}
		await db
			.update(s.order)
			.set({ paymentState: 'refunded', amountRefunded: o.total })
			.where(eq(s.order.id, o.orderId));
	}
	// Partial refunds (a damaged bag) and refunds still waiting for approval.
	const reasons = [
		'Bag arrived torn',
		'Wrong grind sent',
		'One bag missing from the delivery',
		'Customer changed their mind'
	];
	for (const [k, o] of paidOrders
		.filter((p) => ['completed', 'delivered', 'collected'].includes(p.status))
		.slice(0, 14)
		.entries()) {
		const idx = 0;
		const l = o.lines[idx];
		const qty = 1;
		const amount = r2(Number(l.lineTotal) / Number(l.quantity ?? 1));
		const state = k < 8 ? 'succeeded' : k < 11 ? 'requested' : k < 13 ? 'approved' : 'failed';
		const refundId = await insertId(s.refund, {
			orderId: o.orderId,
			paymentId: o.paymentId,
			status: state,
			amount,
			feeRetained: k % 3 === 0 ? r2(amount * 0.025) : 0,
			toStoreCredit: k % 5 === 0,
			reason: reasons[k % reasons.length],
			requestedBy: k % 2 ? shop : manager,
			approvedBy: state === 'requested' ? null : k % 2 ? manager : owner,
			processedAt: state === 'succeeded' || state === 'failed' ? addMinutes(o.at, 60 * 24) : null,
			providerRef: state === 'succeeded' ? `RF-${shortCode(10)}` : null,
			createdAt: addMinutes(o.at, 60 * 20)
		});
		await db.insert(s.refundLine).values({
			refundId,
			orderLineId: o.lineIds[idx],
			quantity: qty,
			amount,
			restock: k % 2 === 0
		});
		if (state === 'succeeded') {
			await db
				.update(s.orderLine)
				.set({ refundedQuantity: qty, refundedAmount: amount })
				.where(eq(s.orderLine.id, o.lineIds[idx]));
			await db
				.update(s.order)
				.set({
					paymentState: amount >= o.total ? 'refunded' : 'partially_refunded',
					amountRefunded: amount
				})
				.where(eq(s.order.id, o.orderId));
			const cust = (
				await db.select({ id: s.order.customerId }).from(s.order).where(eq(s.order.id, o.orderId))
			)[0];
			if (k % 5 === 0)
				await db.insert(s.storeCredit).values({
					customerId: cust.id,
					amount,
					reason: 'refund',
					refType: 'order',
					refId: String(o.orderId),
					note: 'Refund as store credit',
					createdBy: manager,
					createdAt: addMinutes(o.at, 60 * 24)
				});
		}
	}

	// ── Tickets, memberships and bookings sold through orders (when their seeds ran first) ────
	const tickets = await db
		.select()
		.from(s.ticket)
		.where(isNull(s.ticket.orderId))
		.catch(() => []);
	const prices = await db
		.select()
		.from(s.ticketPrice)
		.catch(() => []);
	const types = await db
		.select()
		.from(s.ticketType)
		.catch(() => []);
	const byOrder = new Map<string, typeof tickets>();
	for (const t of tickets.slice(0, 120)) {
		const key = `${t.customerId ?? 'walkin'}:${t.visitDate}:${t.eventId ?? 0}`;
		byOrder.set(key, [...(byOrder.get(key) ?? []), t]);
	}
	for (const group of byOrder.values()) {
		const customer = customers.find((c) => c.id === group[0].customerId) ?? pick(customers);
		const lines: Omit<Line, 'orderId'>[] = group.map((t) => {
			const type = types.find((tt) => tt.id === t.ticketTypeId);
			const price = prices.find(
				(p) => p.ticketTypeId === t.ticketTypeId && p.audienceId === t.audienceId
			);
			return {
				itemType: t.eventId ? 'event_ticket' : 'ticket',
				description: type?.name ?? L('Entry ticket'),
				ticketTypeId: t.ticketTypeId,
				audienceId: t.audienceId,
				visitSlotId: t.visitSlotId,
				eventId: t.eventId,
				quantity: 1,
				unitPrice: Number(price?.price ?? 0)
			};
		});
		const placedAt = t0(group[0].issuedAt);
		const status: Status = group.some((t) => t.status === 'refunded') ? 'cancelled' : 'completed';
		const o = await writeOrder({
			customer,
			channel: rand() < 0.6 ? 'web' : 'desk',
			placedAt,
			lines,
			method: 'none',
			target: status,
			codeId: rand() < 0.1 ? codes.tickets : null,
			locationId: locId('SITE-A')
		});
		for (const [k, t] of group.entries()) {
			await db
				.update(s.ticket)
				.set({ orderId: o.orderId, orderLineId: o.lineIds[k] })
				.where(eq(s.ticket.id, t.id));
		}
	}

	const memberships = await db
		.select({ m: s.membership, price: s.membershipPlan.price, name: s.membershipPlan.name })
		.from(s.membership)
		.innerJoin(s.membershipPlan, eq(s.membership.planId, s.membershipPlan.id))
		.where(isNull(s.membership.orderLineId))
		.catch(() => []);
	for (const { m, price, name } of memberships) {
		const customer = customers.find((c) => c.id === m.customerId);
		if (!customer) continue;
		const pending = m.status === 'pending_payment';
		const o = await writeOrder({
			customer,
			channel: 'web',
			placedAt: t0(m.createdAt),
			lines: [
				{
					itemType: 'membership',
					description: name,
					membershipPlanId: m.planId,
					quantity: 1,
					unitPrice: Number(price)
				}
			],
			method: 'none',
			target: pending ? 'pending_payment' : 'completed',
			locationId: locId('SITE-A')
		});
		await db
			.update(s.membership)
			.set({ orderLineId: o.lineIds[0] })
			.where(eq(s.membership.id, m.id));
	}

	const bookings = await db
		.select({
			b: s.booking,
			name: s.bookable.name,
			requiresPrepayment: s.bookable.requiresPrepayment
		})
		.from(s.booking)
		.innerJoin(s.bookable, eq(s.booking.bookableId, s.bookable.id))
		.where(and(isNull(s.booking.orderId)))
		.catch(() => []);
	for (const { b, name, requiresPrepayment } of bookings) {
		if (!['confirmed', 'done'].includes(b.status) || !Number(b.quotedAmount)) continue;
		const customer = customers.find((c) => c.id === b.customerId) ?? pick(customers);
		const o = await writeOrder({
			customer,
			channel: 'web',
			placedAt: t0(b.createdAt),
			lines: [
				{
					itemType: 'booking',
					description: name,
					bookableId: b.bookableId,
					bookingSessionId: b.sessionId,
					visitSlotId: b.visitSlotId,
					quantity: 1,
					unitPrice: Number(b.quotedAmount)
				}
			],
			method: 'none',
			target: 'completed',
			locationId: locId('SITE-B')
		});
		await db.update(s.booking).set({ orderId: o.orderId }).where(eq(s.booking.id, b.id));
		if (!requiresPrepayment) {
			const inv = await insertId(s.invoice, {
				number: invoiceNumber(),
				customerId: customer.id,
				orderId: o.orderId,
				status: 'paid',
				billingName: b.organisationName ?? customer.name ?? 'Guest',
				billingTin: b.tin,
				currency: 'ETB',
				subtotal: o.total,
				taxTotal: taxIn(o.total),
				total: o.total,
				amountPaid: o.total,
				issuedAt: t0(b.createdAt),
				dueOn: isoOf(addMinutes(t0(b.createdAt), 60 * 24 * 14)),
				paidAt: o.at,
				createdBy: manager
			});
			await db.update(s.booking).set({ invoiceId: inv }).where(eq(s.booking.id, b.id));
		}
	}

	// ── Invoices: business customers and wholesale ────────────────────────────────────────────
	const invoiceable = written.filter((o) => o.paid || o.status === 'pending_payment').slice(0);
	const businessCustomers = new Set(customers.filter((c) => c.businessName).map((c) => c.id));
	const orderRows = await db
		.select({
			id: s.order.id,
			customerId: s.order.customerId,
			businessAccountId: s.order.businessAccountId,
			channel: s.order.channel,
			placedAt: s.order.placedAt,
			total: s.order.total,
			paid: s.order.amountPaid,
			name: s.order.customerBusinessName,
			contact: s.order.contactName,
			tin: s.order.customerTin
		})
		.from(s.order);
	let invoices = 0;
	for (const o of orderRows) {
		if (!(o.channel === 'wholesale' || businessCustomers.has(o.customerId))) continue;
		if (!invoiceable.some((w) => w.orderId === o.id)) continue;
		const issued = addMinutes(o.placedAt, 30);
		const due = addMinutes(issued, 60 * 24 * 30);
		const paidFull = Number(o.paid) >= Number(o.total);
		const status = paidFull ? 'paid' : due < new Date() ? 'overdue' : 'open';
		const id = await insertId(s.invoice, {
			number: invoiceNumber(),
			customerId: o.customerId,
			businessAccountId: o.businessAccountId,
			orderId: o.id,
			status,
			billingName: o.name ?? o.contact ?? 'Customer',
			billingTin: o.tin,
			billingAddress: 'Addis Ababa',
			subtotal: o.total,
			taxTotal: taxIn(Number(o.total)),
			total: o.total,
			amountPaid: o.paid,
			issuedAt: issued,
			dueOn: isoOf(due),
			paidAt: paidFull ? addMinutes(issued, 60 * 24 * between(1, 20)) : null,
			notes: 'Payment by bank transfer to CBE 1000123456789.',
			createdBy: accounts,
			createdAt: issued
		});
		if (paidFull)
			await db
				.update(s.payment)
				.set({ invoiceId: id })
				.where(and(eq(s.payment.orderId, o.id), eq(s.payment.status, 'succeeded')));
		invoices++;
	}
	// A draft, a void and a part-paid invoice with no order (group visit, private hire).
	const someone = customers.find((c) => c.businessName) ?? customers[0];
	await db.insert(s.invoice).values([
		{
			number: invoiceNumber(),
			customerId: someone.id,
			status: 'draft',
			billingName: 'Addis International School',
			billingTin: '0098765432',
			subtotal: 2000,
			taxTotal: taxIn(2000),
			total: 2000,
			notes: 'School visit, 40 pupils',
			createdBy: manager
		},
		{
			number: invoiceNumber(),
			customerId: someone.id,
			status: 'void',
			billingName: 'Ethio Events PLC',
			subtotal: 15000,
			taxTotal: taxIn(15000),
			total: 15000,
			issuedAt: daysFrom(-40),
			dueOn: isoFrom(-10),
			notes: 'Private hire — cancelled by the client',
			createdBy: manager
		},
		{
			number: invoiceNumber(),
			customerId: someone.id,
			status: 'overdue',
			billingName: 'Bole Community School',
			billingTin: '0055667788',
			subtotal: 1600,
			taxTotal: taxIn(1600),
			total: 1600,
			issuedAt: daysFrom(-45),
			dueOn: isoFrom(-15),
			notes: 'School visit, 32 pupils — reminder sent',
			createdBy: manager
		},
		{
			number: invoiceNumber(),
			customerId: someone.id,
			status: 'open',
			billingName: 'Hilton Addis — Events',
			billingTin: '0011223344',
			subtotal: 24000,
			taxTotal: taxIn(24000),
			total: 24000,
			amountPaid: 10000,
			issuedAt: daysFrom(-12),
			dueOn: isoFrom(18),
			notes: 'Coffee ceremony for 60 guests; deposit received',
			createdBy: manager
		}
	]);
	const [partInv] = await db
		.select()
		.from(s.invoice)
		.where(eq(s.invoice.billingName, 'Hilton Addis — Events'));
	await db.insert(s.payment).values({
		invoiceId: partInv.id,
		provider: 'bank_transfer',
		status: 'succeeded',
		amount: 10000,
		txRef: txRef(),
		reference: 'CBE-77881234',
		recordedBy: accounts,
		paidAt: daysFrom(-10),
		createdAt: daysFrom(-10),
		updatedAt: daysFrom(-10)
	});

	await db
		.insert(s.documentSequence)
		.values({ key: 'order:2026', nextValue: orderSeq + 1 })
		.onDuplicateKeyUpdate({ set: { nextValue: orderSeq + 1 } });
	await db
		.insert(s.documentSequence)
		.values([
			{ key: 'receipt:2026', nextValue: receiptSeq + 1 },
			{ key: 'invoice:2026', nextValue: invoiceSeq + 1 }
		])
		.onDuplicateKeyUpdate({ set: { key: sql`values(\`key\`)` } });
	await db
		.update(s.documentSequence)
		.set({ nextValue: receiptSeq + 1 })
		.where(eq(s.documentSequence.key, 'receipt:2026'));
	await db
		.update(s.documentSequence)
		.set({ nextValue: invoiceSeq + 1 })
		.where(eq(s.documentSequence.key, 'invoice:2026'));

	console.log(
		`  ${orderSeq} orders, ${invoices + 4} invoices, ${tickets.length ? byOrder.size : 0} ticket orders, ${memberships.length} membership orders`
	);
}

/** A Date from a timestamp column, or now. */
function t0(value: Date | string | null | undefined) {
	return value ? new Date(value) : new Date();
}
