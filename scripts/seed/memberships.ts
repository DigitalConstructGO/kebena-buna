/**
 * Membership plans and terms with their named members, and coffee subscriptions with their
 * prepaid bundles and delivery schedules (questionnaire 7). Order links are left for the orders
 * seed.
 */
import { and, eq, isNull } from 'drizzle-orm';
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
import type { SubscriptionDeliveryStatus, SubscriptionStatus } from '../../src/lib/constants.ts';

const addDays = (iso: string, days: number) => {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
};
const addMonths = (iso: string, months: number) => {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCMonth(d.getUTCMonth() + months);
	return d.toISOString().slice(0, 10);
};

export async function seed() {
	const manager = await userIdByEmail('manager@kebena.coffee');
	const desk = await userIdByEmail('desk@kebena.coffee');
	const shop = await userIdByEmail('shop@kebena.coffee');
	const [vat] = await db
		.select({ id: s.taxRate.id })
		.from(s.taxRate)
		.where(eq(s.taxRate.code, 'VAT15'));
	const [patronBag] = await db
		.select({ id: s.productVariant.id })
		.from(s.productVariant)
		.where(eq(s.productVariant.sku, 'WASHED-LIMU--250'));

	// ── Plans ─────────────────────────────────────────────────────────────────────────────────
	const plan = (values: Record<string, unknown>) =>
		insertId(s.membershipPlan, {
			taxRateId: vat.id,
			publishStatus: 'published',
			createdBy: manager,
			...values
		});
	const plans = {
		IND: await plan({
			code: 'IND',
			name: L('Individual', 'ግለሰብ'),
			description: L('A year of free entry for one adult.'),
			benefits: L('Free entry, 10% off in the shop, free delivery, members-only events.'),
			price: 1500,
			shopDiscountPct: 10,
			sortOrder: 1
		}),
		FAM: await plan({
			code: 'FAM',
			name: L('Family', 'ቤተሰብ'),
			description: L('Two adults and up to three children.'),
			benefits: L('One family card admitting five, 10% off, free delivery.'),
			price: 3500,
			maxAdults: 2,
			maxChildren: 3,
			sharedCardAdmits: 5,
			shopDiscountPct: 10,
			sortOrder: 2
		}),
		STU: await plan({
			code: 'STU',
			name: L('Student', 'ተማሪ'),
			description: L('For full-time students with a valid ID.'),
			requiresProof: L('Student ID', 'የተማሪ መታወቂያ'),
			price: 750,
			shopDiscountPct: 10,
			sortOrder: 3
		}),
		PAT: await plan({
			code: 'PAT',
			name: L('Patron', 'ደጋፊ'),
			description: L('Supports the museum; a bag of Limu every month.'),
			benefits: L(
				'Everything in Family, 15% off, a 250 g bag of specialty coffee every month and a private cupping session once a year.'
			),
			price: 10000,
			maxAdults: 2,
			maxChildren: 3,
			sharedCardAdmits: 5,
			shopDiscountPct: 15,
			monthlyCoffeeVariantId: patronBag.id,
			sortOrder: 4
		}),
		CORP: await plan({
			code: 'CORP',
			name: L('Corporate', 'ድርጅት'),
			price: 25000,
			maxAdults: 10,
			publishStatus: 'draft',
			isActive: false,
			sortOrder: 5
		})
	};

	// ── Memberships ───────────────────────────────────────────────────────────────────────────
	const customers = await db
		.select({ id: s.customer.id, name: s.customer.name })
		.from(s.customer)
		.where(isNull(s.customer.deletedAt))
		.orderBy(s.customer.id);
	let number = 1;
	const nextNumber = () => `KM-26-${String(number++).padStart(4, '0')}`;
	const CHILDREN = ['Abigail', 'Nathan', 'Kidus', 'Mariam', 'Yohannes', 'Hermela', 'Eyob'];

	async function term(
		customer: { id: number; name: string | null },
		planId: number,
		startsOn: string,
		status: string,
		renews: number | null
	) {
		const endsOn = addDays(addMonths(startsOn, 12), -1);
		const id = await insertId(s.membership, {
			number: nextNumber(),
			customerId: customer.id,
			planId,
			status,
			startsOn: status === 'pending_payment' ? null : startsOn,
			endsOn: status === 'pending_payment' ? null : endsOn,
			graceEndsOn: status === 'pending_payment' ? null : addDays(endsOn, 7),
			renewsMembershipId: renews,
			cancelledAt: status === 'cancelled' ? daysFrom(-between(5, 60)) : null,
			cancelReason:
				status === 'cancelled'
					? pick(['Moved abroad', 'Asked for a refund', 'Duplicate purchase'])
					: null,
			createdBy: rand() < 0.5 ? desk : null,
			createdAt: daysFrom(
				-between(1, 30) + Math.round((Date.parse(startsOn) - Date.now()) / 86400000)
			)
		});
		await db.insert(s.membershipMember).values({
			membershipId: id,
			name: customer.name ?? 'Member',
			cardCode: shortCode(10),
			createdBy: desk
		});
		if (planId === plans.FAM || planId === plans.PAT) {
			await db.insert(s.membershipMember).values({
				membershipId: id,
				name: `${pick(['Sara', 'Dawit', 'Helen', 'Mesfin'])} ${(customer.name ?? '').split(' ')[1] ?? ''}`.trim(),
				cardCode: shortCode(10),
				createdBy: desk
			});
			for (let c = 0; c < between(1, 3); c++) {
				await db.insert(s.membershipMember).values({
					membershipId: id,
					name: `${pick(CHILDREN)} ${(customer.name ?? '').split(' ')[1] ?? ''}`.trim(),
					isChild: true,
					birthYear: between(2012, 2021),
					cardCode: shortCode(10),
					createdBy: desk
				});
			}
		}
		return id;
	}

	const planIds = [plans.IND, plans.IND, plans.IND, plans.FAM, plans.FAM, plans.STU, plans.PAT];
	const memberships: { id: number; customerId: number; planId: number; status: string }[] = [];
	for (let i = 0; i < 42; i++) {
		const customer = customers[i % customers.length];
		const planId = planIds[i % planIds.length];
		let status: string;
		let startOffset: number;
		if (i < 24) [status, startOffset] = ['active', -between(10, 340)];
		else if (i < 28) [status, startOffset] = ['grace', -between(366, 370)];
		else if (i < 33) [status, startOffset] = ['lapsed', -between(400, 600)];
		else if (i < 37) [status, startOffset] = ['pending_payment', 0];
		else [status, startOffset] = ['cancelled', -between(30, 200)];
		// Due for renewal within 30 days: a handful of the active ones started ~11 months ago.
		if (i % 6 === 0 && status === 'active') startOffset = -between(340, 360);
		const id = await term(customer, planId, isoFrom(startOffset), status, null);
		memberships.push({ id, customerId: customer.id, planId, status });
	}
	// Renewal chains: three lapsed terms renewed into active ones.
	for (const old of memberships.filter((m) => m.status === 'lapsed').slice(0, 3)) {
		const customer = customers.find((c) => c.id === old.customerId)!;
		const [prev] = await db
			.select({ endsOn: s.membership.endsOn })
			.from(s.membership)
			.where(eq(s.membership.id, old.id));
		const startsOn = addDays(prev.endsOn!, 1);
		await term(
			customer,
			old.planId,
			startsOn,
			Date.parse(startsOn) + 365 * 86400000 > Date.now() ? 'active' : 'lapsed',
			old.id
		);
	}

	// ── Subscriptions ─────────────────────────────────────────────────────────────────────────
	const subPlan = {
		3: await insertId(s.subscriptionPlan, {
			name: L('3 deliveries', '3 ማድረሻዎች'),
			deliveries: 3,
			discountPct: 5,
			sortOrder: 1,
			createdBy: manager
		}),
		6: await insertId(s.subscriptionPlan, {
			name: L('6 deliveries', '6 ማድረሻዎች'),
			deliveries: 6,
			discountPct: 10,
			sortOrder: 2,
			createdBy: manager
		}),
		12: await insertId(s.subscriptionPlan, {
			name: L('12 deliveries', '12 ማድረሻዎች'),
			deliveries: 12,
			discountPct: 15,
			sortOrder: 3,
			createdBy: manager
		})
	} as Record<number, number>;

	const variants = await db
		.select({
			id: s.productVariant.id,
			price: s.productVariant.price,
			productId: s.productVariant.productId
		})
		.from(s.productVariant)
		.innerJoin(s.product, eq(s.productVariant.productId, s.product.id))
		.where(and(eq(s.product.kind, 'coffee'), isNull(s.productVariant.deletedAt)));
	const allowed = await db.select().from(s.productRoastLevel);
	const grinds = await db.select({ id: s.grind.id }).from(s.grind);
	const zones = await db
		.select({ id: s.deliveryZone.id, code: s.deliveryZone.code })
		.from(s.deliveryZone);
	const addresses = await db
		.select({ id: s.customerAddress.id, customerId: s.customerAddress.customerId })
		.from(s.customerAddress);

	let subNumber = 1;
	const owners = customers.slice(5, 27);
	async function subscription(
		customerId: number,
		opts: {
			membershipId?: number;
			variantId?: number;
			status: SubscriptionStatus;
			frequency: 'biweekly' | 'monthly';
			bundles: number[];
			startDays: number;
		}
	) {
		const variant = opts.variantId
			? variants.find((v) => v.id === opts.variantId)!
			: pick(variants);
		const roasts = allowed.filter((a) => a.productId === variant.productId);
		const address = addresses.find((a) => a.customerId === customerId);
		const step = opts.frequency === 'biweekly' ? 14 : 30;
		const purchased = opts.membershipId ? 12 : opts.bundles.reduce((a, b) => a + b, 0);
		const id = await insertId(s.subscription, {
			number: `KS-26-${String(subNumber++).padStart(4, '0')}`,
			customerId,
			membershipId: opts.membershipId ?? null,
			status: opts.status,
			frequency: opts.frequency,
			variantId: variant.id,
			roastLevelId: (roasts.find((r) => r.isDefault) ?? roasts[0]).roastLevelId,
			grindId: pick(grinds).id,
			quantity: rand() < 0.8 ? 1 : 2,
			addressId: address?.id ?? null,
			deliveryZoneId: address
				? pick(zones.filter((z) => z.code !== 'PICKUP')).id
				: zones.find((z) => z.code === 'PICKUP')!.id,
			deliveriesPurchased: purchased,
			pausedUntil: opts.status === 'paused' ? isoFrom(between(10, 40)) : null,
			cancelledAt: opts.status === 'cancelled' ? daysFrom(-between(3, 30)) : null,
			unusedSettlement: opts.status === 'cancelled' ? pick(['refund', 'store_credit']) : null,
			createdBy: rand() < 0.3 ? shop : null,
			createdAt: daysFrom(opts.startDays - 2)
		});
		for (const deliveries of opts.bundles) {
			const discount = deliveries === 3 ? 5 : deliveries === 6 ? 10 : 15;
			await db.insert(s.subscriptionBundle).values({
				subscriptionId: id,
				planId: subPlan[deliveries],
				deliveries,
				discountPct: discount,
				pricePerDelivery: Math.round(Number(variant.price) * (1 - discount / 100)),
				purchasedAt: daysFrom(opts.startDays - 2)
			});
		}
		// The schedule: what has passed is delivered (a few skipped), what is ahead is scheduled.
		let used = 0;
		let next: string | null = null;
		for (let seq = 1; seq <= purchased; seq++) {
			const roastDate = isoFrom(opts.startDays + (seq - 1) * step);
			const past = Date.parse(roastDate) < Date.now() - 86400000;
			let status: SubscriptionDeliveryStatus = past
				? rand() < 0.15
					? 'skipped'
					: 'delivered'
				: 'scheduled';
			if (!past && opts.status === 'cancelled') status = 'cancelled';
			if (status === 'delivered' || status === 'skipped') used++;
			if (status === 'scheduled' && !next) next = roastDate;
			await db.insert(s.subscriptionDelivery).values({
				subscriptionId: id,
				sequence: seq,
				roastDate,
				status,
				skippedAt: status === 'skipped' ? daysFrom(opts.startDays + (seq - 1) * step - 3) : null,
				skippedBy: status === 'skipped' ? (rand() < 0.5 ? shop : null) : null,
				createdAt: daysFrom(opts.startDays - 2)
			});
		}
		const finalStatus = opts.status === 'active' && !next ? 'completed' : opts.status;
		await db
			.update(s.subscription)
			.set({
				deliveriesUsed: used,
				nextRoastDate: finalStatus === 'active' || finalStatus === 'paused' ? next : null,
				status: finalStatus
			})
			.where(eq(s.subscription.id, id));
	}

	const statuses: SubscriptionStatus[] = [
		'active',
		'active',
		'active',
		'active',
		'paused',
		'cancelled',
		'pending_payment',
		'active'
	];
	for (let i = 0; i < 20; i++) {
		const status = statuses[i % statuses.length];
		const frequency = rand() < 0.5 ? 'biweekly' : 'monthly';
		const bundles = status === 'pending_payment' ? [3] : i % 5 === 0 ? [3, 6] : [pick([3, 6, 12])];
		const startDays = status === 'pending_payment' ? 7 : -between(20, 150);
		await subscription(owners[i % owners.length].id, { status, frequency, bundles, startDays });
	}
	// Patron members get their monthly bag through the subscription engine (7.2), paid by the plan.
	const patrons = memberships.filter((m) => m.planId === plans.PAT && m.status === 'active');
	for (const p of patrons) {
		await subscription(p.customerId, {
			membershipId: p.id,
			variantId: patronBag.id,
			status: 'active',
			frequency: 'monthly',
			bundles: [],
			startDays: -between(20, 120)
		});
	}
}
