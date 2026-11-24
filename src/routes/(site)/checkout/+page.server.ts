import { fail, redirect, type Cookies } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '#lib/server/db/index.ts';
import { deliveryArea, deliveryZone, location } from '#lib/server/db/schema.ts';
import { readSetting } from '#lib/server/stockReads.ts';
import {
	priceBundles,
	priceCart,
	readBundles,
	readChoices,
	shortVariants,
	writeChoices,
	type PricedBundle
} from '#lib/server/cart.ts';
import type { WebLine } from '#lib/server/site.ts';
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
import { memberPerks } from '#lib/server/memberships.ts';
import { completeFreeOrder } from '#lib/server/freeOrders.ts';
import { DiscountRefused } from '#lib/server/discounts.ts';
import { checkoutSchema } from '#lib/schemas/checkout.ts';
import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/i18n.ts';
import { tr } from '#lib/format.ts';
import { siteHref } from '#lib/site/locale.ts';
import type { Actions, PageServerLoad } from './$types';

type Zone = {
	id: number;
	fee: number;
	freeAbove: number | null;
	isPickup: boolean;
	usesCourier: boolean;
};

/**
 * A zone's fee for an order of `subtotal` (3.5): free above its own threshold, or — for an Addis
 * rider zone without one — above the `delivery.free_above` setting. Courier zones are never free.
 */
const freeFrom = (z: Zone, fallback: number) =>
	z.freeAbove ?? (z.isPickup || z.usesCourier ? null : fallback);
const feeOf = (z: Zone, subtotal: number, fallback: number) => {
	const free = freeFrom(z, fallback);
	return z.isPickup || (free !== null && subtotal >= free) ? 0 : z.fee;
};

/** The whole cart, loose bags and bundles, priced now. */
async function priceAll(cookies: Cookies) {
	const [cart, bundled] = await Promise.all([
		priceCart(readChoices(cookies)),
		priceBundles(readBundles(cookies))
	]);
	return {
		lines: cart.lines,
		bundles: bundled.bundles,
		subtotal: Math.round((cart.subtotal + bundled.subtotal) * 100) / 100,
		changed: cart.changed || bundled.changed,
		empty: !cart.lines.length && !bundled.bundles.length,
		short: shortVariants(cart.lines, bundled.bundles)
	};
}

/**
 * A bundle's order lines: its bags once for each bundle bought, each set its own `bundleGroup`, the
 * saving in each line's discount. A member's discount comes off only a bundle that stacks; a
 * discount code skips one that does not.
 */
function bundleLines(bundles: PricedBundle[], memberPct: number): WebLine[] {
	const out: WebLine[] = [];
	let group = 0;
	for (const b of bundles) {
		for (let n = 0; n < b.quantity; n++) {
			group++;
			for (const l of b.lines) {
				const net = l.unitPrice * l.quantity - l.discountAmount;
				const member = b.stacksWithDiscounts ? Math.round(net * memberPct) / 100 : 0;
				out.push({
					itemType: 'product',
					description: l.description,
					sku: l.sku,
					variantId: l.choice.variantId,
					roastLevelId: l.choice.roastLevelId,
					grindId: l.choice.grindId,
					fulfilment: l.fulfilment,
					taxRateId: l.taxRateId,
					quantity: l.quantity,
					unitPrice: l.unitPrice,
					discountAmount: Math.round((l.discountAmount + member) * 100) / 100,
					bundleId: b.bundleId,
					bundleGroup: group,
					codeExempt: !b.stacksWithDiscounts
				});
			}
		}
	}
	return out;
}

async function deliveryOptions() {
	const [zones, areas, places, fallback] = await Promise.all([
		db
			.select({
				id: deliveryZone.id,
				name: deliveryZone.name,
				fee: deliveryZone.fee,
				freeAbove: deliveryZone.freeAbove,
				isPickup: deliveryZone.isPickup,
				usesCourier: deliveryZone.usesCourier,
				freeForMembers: deliveryZone.freeForMembers,
				transitDays: deliveryZone.transitDays
			})
			.from(deliveryZone)
			.where(and(eq(deliveryZone.status, true), isNull(deliveryZone.deletedAt)))
			.orderBy(asc(deliveryZone.sortOrder), asc(deliveryZone.id)),
		db
			.select({ id: deliveryArea.id, zoneId: deliveryArea.zoneId, name: deliveryArea.name })
			.from(deliveryArea)
			.where(and(eq(deliveryArea.status, true), isNull(deliveryArea.deletedAt)))
			.orderBy(asc(deliveryArea.sortOrder), asc(deliveryArea.id)),
		// Pickup is at the museum shop, at Site A (3.7).
		db
			.select({
				id: location.id,
				code: location.code,
				name: location.name,
				address: location.address
			})
			.from(location)
			.where(inArray(location.code, ['SHOP', 'SITE-A'])),
		readSetting('delivery.free_above', 3000)
	]);
	const pickupPlace =
		places.find((p) => p.code === 'SHOP') ?? places.find((p) => p.code === 'SITE-A') ?? null;
	return {
		zones: zones.map((z) => ({
			...z,
			fee: Number(z.fee),
			freeAbove: z.freeAbove === null ? null : Number(z.freeAbove)
		})),
		areas,
		pickupPlace,
		fallback: Number(fallback)
	};
}

export const load: PageServerLoad = async ({ cookies }) => {
	const cart = await priceAll(cookies);
	if (cart.empty || cart.changed || cart.short.size) redirect(303, siteHref('/cart', getLocale()));
	const { zones, areas, pickupPlace, fallback } = await deliveryOptions();

	const form = await superValidate(zod4(checkoutSchema));
	// One key per checkout page: a double-clicked or resent order lands on the same order.
	form.data.idempotencyKey = randomUUID();
	form.data.city = m.checkout_city_default();
	return {
		form,
		lines: [
			...cart.lines.map((l) => ({
				key: l.key,
				description: l.description,
				quantity: l.quantity,
				lineTotal: l.lineTotal,
				codeExempt: false
			})),
			...cart.bundles.map((b) => ({
				key: b.key,
				description: b.name,
				quantity: b.quantity,
				lineTotal: b.total,
				codeExempt: !b.stacksWithDiscounts
			}))
		],
		subtotal: cart.subtotal,
		pickupPlace,
		zones: zones
			.filter((z) => !z.isPickup)
			.map((z) => ({
				id: z.id,
				name: z.name,
				fee: z.fee,
				free: freeFrom(z, fallback),
				usesCourier: z.usesCourier,
				transitDays: z.transitDays
			})),
		areas,
		paymentsOn: paymentsOn(),
		transfersOn: await transfersOn()
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { cookies, url } = event;
		const form = await superValidate(event.request, zod4(checkoutSchema));
		if (!form.valid) return fail(400, { form });
		const locale = getLocale();
		// A bot that filled the hidden field is sent on its way with nothing made.
		if (isTrapped(form.data)) redirect(303, siteHref('/', locale));
		if (floodRefused(event, 'checkout', 3))
			return message(form, m.site_err_flood(), { status: 429 });

		const already = await orderByIdempotencyKey(form.data.idempotencyKey);
		if (already) redirect(303, trackHref(already));

		const cart = await priceAll(cookies);
		if (cart.empty) redirect(303, siteHref('/cart', locale));
		if (cart.changed) {
			writeChoices(
				cookies,
				cart.lines.map((l) => l.choice),
				url.protocol === 'https:',
				cart.bundles.map((b) => b.entry)
			);
			return message(form, m.checkout_cart_changed(), { status: 409 });
		}
		if (cart.short.size) {
			const names = new Set(
				[...cart.lines, ...cart.bundles.flatMap((b) => b.lines)]
					.filter((l) => cart.short.has(l.choice.variantId))
					.map((l) => tr(l.name, locale))
			);
			return message(form, m.checkout_short({ items: [...names].join(', ') }), {
				status: 409
			});
		}

		const { zones, areas, pickupPlace, fallback } = await deliveryOptions();
		const d = form.data;
		// Members ride free in zones that allow it (7.2), decided once we know who is buying.
		let memberFreeZone = false;
		let delivery: Pick<
			Parameters<typeof createWebOrder>[2],
			'deliveryMethod' | 'deliveryZoneId' | 'deliveryAddress' | 'pickupLocationId' | 'deliveryFee'
		>;
		if (d.method === 'pickup') {
			delivery = {
				deliveryMethod: 'pickup',
				deliveryZoneId: zones.find((z) => z.isPickup)?.id ?? null,
				pickupLocationId: pickupPlace?.id ?? null,
				deliveryFee: 0
			};
		} else {
			const zone = zones.find((z) => z.id === d.zoneId && !z.isPickup);
			const area = areas.find((a) => a.id === d.areaId && a.zoneId === zone?.id);
			if (!zone) return setError(form, 'zoneId', m.site_err_required());
			memberFreeZone = zone.freeForMembers;
			delivery = {
				deliveryMethod: zone.usesCourier ? 'courier' : 'rider',
				deliveryZoneId: zone.id,
				deliveryFee: feeOf(zone, cart.subtotal, fallback),
				deliveryAddress: {
					recipientName: d.name,
					phone: d.phone,
					area: area ? tr(area.name, locale) : undefined,
					city: d.city ?? '',
					woreda: d.woreda ?? undefined,
					line1: d.line1 ?? '',
					landmark: d.landmark ?? undefined
				}
			};
		}

		let placed: Awaited<ReturnType<typeof createWebOrder>> & { free: boolean };
		try {
			placed = await db.transaction(async (tx) => {
				const contact = { name: d.name, phone: d.phone, email: d.email ?? null };
				const customerId = await customerFor(tx, contact);
				if (d.marketingConsent) await recordConsent(tx, event, customerId, contact, 'checkout');
				// A member's discount and free delivery, by their phone — never stacked with a code.
				const perks = d.discountCode ? null : await memberPerks(tx, customerId);
				const memberPct = perks?.shopDiscountPct ?? 0;
				const made = await createWebOrder(tx, event, {
					customerId,
					contact,
					discountCode: d.discountCode,
					...delivery,
					...(perks?.freeDelivery && memberFreeZone ? { deliveryFee: 0 } : {}),
					membershipId: perks?.membershipId ?? null,
					customerNote: d.note ?? null,
					idempotencyKey: d.idempotencyKey ?? null,
					lines: [
						...cart.lines.map((l) => ({
							itemType: 'product' as const,
							description: l.description,
							sku: l.sku,
							variantId: l.choice.variantId,
							roastLevelId: l.choice.roastLevelId,
							grindId: l.choice.grindId,
							packagingId: l.choice.packagingId,
							fulfilment: l.fulfilment,
							taxRateId: l.taxRateId,
							quantity: l.quantity,
							unitPrice: l.unitPrice,
							discountAmount: Math.round(l.lineTotal * memberPct) / 100
						})),
						...bundleLines(cart.bundles, memberPct)
					]
				});
				// A 100% code: nothing to pay, so it is paid now.
				return { ...made, free: made.total < 0.005 && (await completeFreeOrder(tx, made.id)) };
			});
		} catch (err) {
			if (err instanceof DiscountRefused) return setError(form, 'discountCode', err.message);
			if (err instanceof UnpaidRefused) return setError(form, 'phone', err.message);
			// Two submits racing past the idempotency check: the second hits the unique key.
			const raced = await orderByIdempotencyKey(d.idempotencyKey);
			if (raced) redirect(303, trackHref(raced));
			throw err;
		}

		writeChoices(cookies, [], url.protocol === 'https:', []);
		const page = trackHref(placed);
		// A transfer is paid from the order's page, where the accounts and the receipt upload are.
		if (placed.free || !paymentsOn() || d.payWith === 'transfer') redirect(303, page);
		let checkout: string | null = null;
		try {
			checkout = await startPayment(event, placed.id);
		} catch (err) {
			console.error('[checkout] could not start Chapa checkout:', err);
		}
		// Without a checkout URL the order page offers "Pay now" again.
		if (checkout) toCheckout(checkout);
		redirect(303, `${page}&pay=failed`);
	}
};
