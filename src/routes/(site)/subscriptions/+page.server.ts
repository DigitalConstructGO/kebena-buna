import { redirect } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { fail, message, setError, superValidate, type SuperValidated } from 'sveltekit-superforms';
import type { z } from 'zod/v4';
import { zod4 } from 'sveltekit-superforms/adapters';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { db } from '#lib/server/db/index.ts';
import {
	bagSize,
	customerAddress,
	deliveryArea,
	deliveryZone,
	grind,
	product,
	productGrind,
	productRoastLevel,
	productVariant,
	roastLevel,
	subscription,
	subscriptionBundle,
	subscriptionPlan
} from '#lib/server/db/schema.ts';
import type { Localized } from '#lib/server/db/fields.ts';
import { nextSubscriptionNumber } from '#lib/server/memberships.ts';
import {
	createWebOrder,
	customerFor,
	floodRefused,
	isTrapped,
	orderByIdempotencyKey,
	paymentsOn,
	recordConsent,
	startPayment,
	trackHref,
	toCheckout,
	UnpaidRefused
} from '#lib/server/site.ts';
import { transfersOn } from '#lib/server/transfers.ts';
import { completeFreeOrder } from '#lib/server/freeOrders.ts';
import { DiscountRefused } from '#lib/server/discounts.ts';
import { subscriptionSignupSchema } from '#lib/schemas/signup.ts';
import { LANGS } from '#lib/languages.ts';
import { tr } from '#lib/format.ts';
import { m } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** What a subscription can be made of: plans, subscribable coffees with their sizes, roasts and grinds, zones. */
async function offer() {
	const [plans, variants, roasts, grinds, zones, areas] = await Promise.all([
		db
			.select({
				id: subscriptionPlan.id,
				name: subscriptionPlan.name,
				deliveries: subscriptionPlan.deliveries,
				discountPct: subscriptionPlan.discountPct
			})
			.from(subscriptionPlan)
			.where(and(eq(subscriptionPlan.isActive, true), isNull(subscriptionPlan.deletedAt)))
			.orderBy(asc(subscriptionPlan.deliveries)),
		db
			.select({
				id: productVariant.id,
				productId: product.id,
				product: product.name,
				summary: product.summary,
				tastingNotes: product.tastingNotes,
				taxRateId: product.taxRateId,
				size: bagSize.name,
				grams: bagSize.grams,
				variantName: productVariant.name,
				price: productVariant.price
			})
			.from(productVariant)
			.innerJoin(product, eq(productVariant.productId, product.id))
			.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
			.where(
				and(
					eq(product.kind, 'coffee'),
					eq(product.isSubscribable, true),
					eq(product.publishStatus, 'published'),
					eq(product.isActive, true),
					isNull(product.deletedAt),
					eq(product.isMemberOnly, false),
					eq(productVariant.isActive, true),
					isNull(productVariant.deletedAt)
				)
			)
			.orderBy(asc(product.sortOrder), asc(bagSize.grams)),
		db
			.select({
				productId: productRoastLevel.productId,
				id: roastLevel.id,
				name: roastLevel.name,
				isDefault: productRoastLevel.isDefault
			})
			.from(productRoastLevel)
			.innerJoin(roastLevel, eq(productRoastLevel.roastLevelId, roastLevel.id))
			.where(and(eq(roastLevel.status, true), isNull(roastLevel.deletedAt)))
			.orderBy(asc(roastLevel.sortOrder)),
		db
			.select({
				productId: productGrind.productId,
				id: grind.id,
				name: grind.name,
				isDefault: productGrind.isDefault
			})
			.from(productGrind)
			.innerJoin(grind, eq(productGrind.grindId, grind.id))
			.where(and(eq(grind.status, true), isNull(grind.deletedAt)))
			.orderBy(asc(grind.sortOrder)),
		db
			.select({
				id: deliveryZone.id,
				name: deliveryZone.name,
				isPickup: deliveryZone.isPickup,
				usesCourier: deliveryZone.usesCourier
			})
			.from(deliveryZone)
			.where(and(eq(deliveryZone.status, true), isNull(deliveryZone.deletedAt)))
			.orderBy(asc(deliveryZone.sortOrder)),
		db
			.select({ id: deliveryArea.id, zoneId: deliveryArea.zoneId, name: deliveryArea.name })
			.from(deliveryArea)
			.where(and(eq(deliveryArea.status, true), isNull(deliveryArea.deletedAt)))
			.orderBy(asc(deliveryArea.sortOrder))
	]);
	return {
		plans: plans.map((p) => ({ ...p, discountPct: Number(p.discountPct) })),
		variants: variants.map((v) => ({ ...v, price: Number(v.price) })),
		roasts,
		grinds,
		zones,
		areas
	};
}

/** The subscription a top-up link names, while it can still take deliveries. */
async function toppable(number: string | null | undefined) {
	if (!number) return null;
	const [row] = await db
		.select({ s: subscription, address: customerAddress })
		.from(subscription)
		.leftJoin(customerAddress, eq(subscription.addressId, customerAddress.id))
		.where(
			and(
				eq(subscription.number, number),
				inArray(subscription.status, ['active', 'paused', 'completed']),
				isNull(subscription.deletedAt)
			)
		);
	return row ?? null;
}

export const load: PageServerLoad = async ({ url }) => {
	const o = await offer();
	// From a reminder's top-up link: the form shows the subscription's own coffee and address.
	const topUp = await toppable(url.searchParams.get('s'));
	const sub = topUp?.s;
	const first = o.variants.find((v) => v.id === sub?.variantId) ?? o.variants[0];
	const defaultRoast =
		o.roasts.find((r) => r.productId === first?.productId && r.isDefault) ??
		o.roasts.find((r) => r.productId === first?.productId);
	return {
		...o,
		paymentsOn: paymentsOn(),
		transfersOn: await transfersOn(),
		toppingUp: sub?.number ?? null,
		form: await superValidate(
			{
				planId: o.plans.find((p) => p.deliveries === 6)?.id ?? o.plans[0]?.id,
				variantId: first?.id,
				roastLevelId: sub?.roastLevelId ?? defaultRoast?.id,
				grindId: sub?.grindId ?? undefined,
				deliveryZoneId: sub?.deliveryZoneId ?? o.zones.find((z) => !z.isPickup)?.id,
				quantity: sub?.quantity ?? 1,
				frequency: sub?.frequency ?? ('monthly' as const),
				areaId: topUp?.address?.areaId ?? undefined,
				line1: topUp?.address?.line1 ?? undefined,
				landmark: topUp?.address?.landmark ?? undefined,
				city: topUp?.address?.city ?? m.checkout_city_default(),
				topUp: sub?.number,
				idempotencyKey: crypto.randomUUID()
			},
			zod4(subscriptionSignupSchema),
			{ errors: false }
		)
	};
};

type Offer = Awaited<ReturnType<typeof offer>>;

/** The phone given is not the one on the subscription being topped up. */
class NotTheirs extends Error {}

/**
 * A top-up: the bundle is bought for the subscription the link named, at its own coffee and
 * quantity, and its deliveries are added to it once paid (`activateOrderItems`). Only the
 * subscriber's own phone may do it; anyone else is told to use theirs.
 */
async function topUpSubscription(
	event: Parameters<Actions['default']>[0],
	form: SuperValidated<z.infer<typeof subscriptionSignupSchema>>,
	sub: typeof subscription.$inferSelect,
	plan: Offer['plans'][number],
	o: Offer
) {
	const d = form.data;
	const variant = o.variants.find((v) => v.id === sub.variantId);
	if (!variant) return setError(form, 'variantId', m.subs_err_coffee());
	const pricePerDelivery = r2(variant.price * sub.quantity * (1 - plan.discountPct / 100));
	const description = Object.fromEntries(
		LANGS.map((l) => [
			l,
			`${sub.number} + ${tr(plan.name, l)} · ${tr(variant.product, l)}${variant.size ? ` ${tr(variant.size, l)}` : ''} × ${sub.quantity}`
		])
	) as Localized;
	let placed: Awaited<ReturnType<typeof createWebOrder>> & { free: boolean };
	try {
		placed = await db.transaction(async (tx) => {
			const customerId = await customerFor(tx, { name: d.name, phone: d.phone, email: d.email });
			if (customerId !== sub.customerId) throw new NotTheirs();
			const order = await createWebOrder(tx, event, {
				customerId,
				contact: { name: d.name, phone: d.phone, email: d.email },
				idempotencyKey: d.idempotencyKey,
				discountCode: d.discountCode,
				lines: [
					{
						itemType: 'subscription_bundle',
						description,
						subscriptionPlanId: plan.id,
						subscriptionId: sub.id,
						variantId: sub.variantId,
						roastLevelId: sub.roastLevelId,
						grindId: sub.grindId,
						taxRateId: variant.taxRateId,
						quantity: 1,
						unitPrice: r2(pricePerDelivery * plan.deliveries)
					}
				]
			});
			await tx.insert(subscriptionBundle).values({
				subscriptionId: sub.id,
				planId: plan.id,
				orderLineId: order.lineIds[0],
				deliveries: plan.deliveries,
				discountPct: plan.discountPct,
				pricePerDelivery
			});
			return { ...order, free: order.total < 0.005 && (await completeFreeOrder(tx, order.id)) };
		});
	} catch (err) {
		if (err instanceof NotTheirs)
			return setError(form, 'phone', m.renew_err_phone({ number: sub.number }));
		if (err instanceof DiscountRefused) return setError(form, 'discountCode', err.message);
		if (err instanceof UnpaidRefused) return setError(form, 'phone', err.message);
		if (isDuplicateKey(err)) {
			const again = await orderByIdempotencyKey(d.idempotencyKey);
			if (again) redirect(303, trackHref(again));
		}
		throw err;
	}
	return toPayment(event, placed, d.payWith);
}

/** On to Chapa, or the order's page for a transfer (or when Chapa is off or fails). */
async function toPayment(
	event: Parameters<Actions['default']>[0],
	placed: { id: number; number: string; payToken: string | null; free: boolean },
	payWith: string | null | undefined
): Promise<never> {
	if (paymentsOn() && payWith !== 'transfer' && !placed.free) {
		let checkout: string | null = null;
		try {
			checkout = await startPayment(event, placed.id);
		} catch (err) {
			console.error('[subscriptions] could not start Chapa checkout:', err);
		}
		if (checkout) toCheckout(checkout);
	}
	redirect(303, trackHref(placed));
}

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(subscriptionSignupSchema));
		if (!form.valid) return fail(400, { form });
		if (isTrapped(form.data)) return message(form, m.subs_thanks());
		if (floodRefused(event, 'subscription'))
			return message(form, m.site_err_flood(), { status: 429 });

		const done = await orderByIdempotencyKey(form.data.idempotencyKey);
		if (done) redirect(303, trackHref(done));

		const d = form.data;
		const o = await offer();
		const plan = o.plans.find((p) => p.id === d.planId);
		if (!plan) return setError(form, 'planId', m.subs_err_plan());
		const variant = o.variants.find((v) => v.id === d.variantId);
		if (!variant) return setError(form, 'variantId', m.subs_err_coffee());
		if (!o.roasts.some((r) => r.id === d.roastLevelId && r.productId === variant.productId)) {
			return setError(form, 'roastLevelId', m.subs_err_roast());
		}
		if (
			d.grindId &&
			!o.grinds.some((g) => g.id === d.grindId && g.productId === variant.productId)
		) {
			return setError(form, 'grindId', m.subs_err_grind());
		}
		const zone = o.zones.find((z) => z.id === d.deliveryZoneId);
		if (!zone) return setError(form, 'deliveryZoneId', m.subs_err_zone());
		const areas = o.areas.filter((a) => a.zoneId === zone.id);
		if (!zone.isPickup) {
			if (areas.length && !areas.some((a) => a.id === d.areaId))
				return setError(form, 'areaId', m.subs_err_area());
			if (!d.line1) return setError(form, 'line1', m.site_err_required());
		}

		const topUp = await toppable(d.topUp);
		if (topUp) return topUpSubscription(event, form, topUp.s, plan, o);

		// A delivery's price: the bag × how many, less the bundle's discount; the bundle pays for all.
		const pricePerDelivery = r2(variant.price * d.quantity * (1 - plan.discountPct / 100));
		const bundlePrice = r2(pricePerDelivery * plan.deliveries);
		const description = Object.fromEntries(
			LANGS.map((l) => [
				l,
				`${tr(variant.product, l)}${variant.size ? ` ${tr(variant.size, l)}` : ''} × ${d.quantity} · ${tr(plan.name, l)}`
			])
		) as Localized;

		let placed: Awaited<ReturnType<typeof createWebOrder>> & { free: boolean };
		try {
			placed = await db.transaction(async (tx) => {
				const customerId = await customerFor(tx, { name: d.name, phone: d.phone, email: d.email });
				if (d.marketingConsent) await recordConsent(tx, event, customerId, d, 'subscription_form');
				let addressId: number | null = null;
				if (!zone.isPickup && d.line1) {
					const [res] = await tx.insert(customerAddress).values({
						customerId,
						label: 'Subscription',
						recipientName: d.name,
						phone: d.phone,
						areaId: d.areaId,
						city: d.city,
						line1: d.line1,
						landmark: d.landmark ?? null
					});
					addressId = res.insertId;
				}
				const [sub] = await tx.insert(subscription).values({
					number: await nextSubscriptionNumber(tx),
					customerId,
					status: 'pending_payment',
					frequency: d.frequency,
					variantId: variant.id,
					roastLevelId: d.roastLevelId,
					grindId: d.grindId,
					quantity: d.quantity,
					addressId,
					deliveryZoneId: zone.id,
					deliveriesPurchased: plan.deliveries
				});
				const order = await createWebOrder(tx, event, {
					customerId,
					contact: { name: d.name, phone: d.phone, email: d.email },
					idempotencyKey: d.idempotencyKey,
					discountCode: d.discountCode,
					lines: [
						{
							itemType: 'subscription_bundle',
							description,
							subscriptionPlanId: plan.id,
							subscriptionId: sub.insertId,
							variantId: variant.id,
							roastLevelId: d.roastLevelId,
							grindId: d.grindId,
							taxRateId: variant.taxRateId,
							quantity: 1,
							unitPrice: bundlePrice
						}
					]
				});
				await tx.insert(subscriptionBundle).values({
					subscriptionId: sub.insertId,
					planId: plan.id,
					orderLineId: order.lineIds[0],
					deliveries: plan.deliveries,
					discountPct: plan.discountPct,
					pricePerDelivery
				});
				// A 100% code: nothing to pay, so the subscription starts now.
				return { ...order, free: order.total < 0.005 && (await completeFreeOrder(tx, order.id)) };
			});
		} catch (err) {
			if (err instanceof DiscountRefused) return setError(form, 'discountCode', err.message);
			if (err instanceof UnpaidRefused) return setError(form, 'phone', err.message);
			if (isDuplicateKey(err)) {
				const again = await orderByIdempotencyKey(d.idempotencyKey);
				if (again) redirect(303, trackHref(again));
			}
			throw err;
		}

		return toPayment(event, placed, d.payWith);
	}
};
