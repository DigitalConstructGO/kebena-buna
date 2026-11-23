import { fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '#lib/server/db/index.ts';
import { deliveryArea, deliveryZone, location } from '#lib/server/db/schema.ts';
import { readSetting } from '#lib/server/stockReads.ts';
import { priceCart, readChoices, shortLines, writeChoices } from '#lib/server/cart.ts';
import {
	createWebOrder,
	customerFor,
	floodRefused,
	isTrapped,
	orderByIdempotencyKey,
	paymentsOn,
	recordConsent,
	startPayment,
	trackHref
} from '#lib/server/site.ts';
import { checkoutSchema } from '#lib/schemas/checkout.ts';
import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import { tr } from '#lib/format.ts';
import { siteHref } from '#lib/site/locale.ts';
import type { Actions, PageServerLoad } from './$types';

type Zone = { id: number; fee: number; freeAbove: number | null; isPickup: boolean; usesCourier: boolean };

/**
 * A zone's fee for an order of `subtotal` (3.5): free above its own threshold, or — for an Addis
 * rider zone without one — above the `delivery.free_above` setting. Courier zones are never free.
 */
const freeFrom = (z: Zone, fallback: number) => z.freeAbove ?? (z.isPickup || z.usesCourier ? null : fallback);
const feeOf = (z: Zone, subtotal: number, fallback: number) => {
	const free = freeFrom(z, fallback);
	return z.isPickup || (free !== null && subtotal >= free) ? 0 : z.fee;
};

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
			.select({ id: location.id, code: location.code, name: location.name, address: location.address })
			.from(location)
			.where(inArray(location.code, ['SHOP', 'SITE-A'])),
		readSetting('delivery.free_above', 3000)
	]);
	const pickupPlace = places.find((p) => p.code === 'SHOP') ?? places.find((p) => p.code === 'SITE-A') ?? null;
	return {
		zones: zones.map((z) => ({ ...z, fee: Number(z.fee), freeAbove: z.freeAbove === null ? null : Number(z.freeAbove) })),
		areas,
		pickupPlace,
		fallback: Number(fallback)
	};
}

export const load: PageServerLoad = async ({ cookies }) => {
	const cart = await priceCart(readChoices(cookies));
	if (!cart.lines.length || cart.changed || shortLines(cart.lines).length) redirect(303, siteHref('/cart', getLocale()));
	const { zones, areas, pickupPlace, fallback } = await deliveryOptions();

	const form = await superValidate(zod4(checkoutSchema));
	// One key per checkout page: a double-clicked or resent order lands on the same order.
	form.data.idempotencyKey = randomUUID();
	form.data.city = 'Addis Ababa';
	return {
		form,
		lines: cart.lines.map((l) => ({ key: l.key, description: l.description, quantity: l.quantity, lineTotal: l.lineTotal })),
		subtotal: cart.subtotal,
		pickupPlace,
		zones: zones
			.filter((z) => !z.isPickup)
			.map((z) => ({ id: z.id, name: z.name, fee: z.fee, free: freeFrom(z, fallback), usesCourier: z.usesCourier, transitDays: z.transitDays })),
		areas,
		paymentsOn: paymentsOn()
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
		if (floodRefused(event, 'checkout', 3)) return message(form, m.site_err_flood(), { status: 429 });

		const already = await orderByIdempotencyKey(form.data.idempotencyKey);
		if (already) redirect(303, trackHref(already));

		const cart = await priceCart(readChoices(cookies));
		if (!cart.lines.length) redirect(303, siteHref('/cart', locale));
		if (cart.changed) {
			writeChoices(cookies, cart.lines.map((l) => l.choice), url.protocol === 'https:');
			return message(form, m.checkout_cart_changed(), { status: 409 });
		}
		const short = shortLines(cart.lines);
		if (short.length) {
			return message(form, m.checkout_short({ items: short.map((l) => tr(l.name, locale)).join(', ') }), { status: 409 });
		}

		const { zones, areas, pickupPlace, fallback } = await deliveryOptions();
		const d = form.data;
		let delivery: Pick<Parameters<typeof createWebOrder>[2], 'deliveryMethod' | 'deliveryZoneId' | 'deliveryAddress' | 'pickupLocationId' | 'deliveryFee'>;
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

		let placed: Awaited<ReturnType<typeof createWebOrder>>;
		try {
			placed = await db.transaction(async (tx) => {
				const contact = { name: d.name, phone: d.phone, email: d.email ?? null };
				const customerId = await customerFor(tx, contact);
				if (d.marketingConsent) await recordConsent(tx, event, customerId, contact, 'checkout');
				return createWebOrder(tx, event, {
					customerId,
					contact,
					...delivery,
					customerNote: d.note ?? null,
					idempotencyKey: d.idempotencyKey ?? null,
					lines: cart.lines.map((l) => ({
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
						unitPrice: l.unitPrice
					}))
				});
			});
		} catch (err) {
			// Two submits racing past the idempotency check: the second hits the unique key.
			const raced = await orderByIdempotencyKey(d.idempotencyKey);
			if (raced) redirect(303, trackHref(raced));
			throw err;
		}

		writeChoices(cookies, [], url.protocol === 'https:');
		const page = trackHref(placed);
		if (!paymentsOn()) redirect(303, page);
		let checkout: string | null = null;
		try {
			checkout = await startPayment(event, placed.id);
		} catch (err) {
			console.error('[checkout] could not start Chapa checkout:', err);
		}
		// Without a checkout URL the order page offers "Pay now" again.
		redirect(303, checkout ?? `${page}&pay=failed`);
	}
};
