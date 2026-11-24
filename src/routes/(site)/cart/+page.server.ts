import { fail } from '@sveltejs/kit';
import { z } from 'zod/v4';
import {
	bundleKey,
	lineKey,
	MAX_BUNDLE_QTY,
	MAX_QTY,
	priceBundles,
	priceCart,
	readBundles,
	readChoices,
	shortVariants,
	writeBundles,
	writeChoices
} from '#lib/server/cart.ts';
import { m } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const [cart, bundled] = await Promise.all([
		priceCart(readChoices(cookies)),
		priceBundles(readBundles(cookies))
	]);
	// Something left the shop or changed its options: the cookies follow what is shown.
	if (cart.changed || bundled.changed)
		writeChoices(
			cookies,
			cart.lines.map((l) => l.choice),
			url.protocol === 'https:',
			bundled.bundles.map((b) => b.entry)
		);
	const short = shortVariants(cart.lines, bundled.bundles);
	return {
		lines: cart.lines.map((l) => ({
			key: l.key,
			slug: l.slug,
			name: l.name,
			size: l.size,
			roast: l.roast,
			grind: l.grind,
			packaging: l.packaging,
			image: l.image,
			unitPrice: l.unitPrice,
			quantity: l.quantity,
			lineTotal: l.lineTotal,
			available: l.available,
			short: short.has(l.choice.variantId)
		})),
		bundles: bundled.bundles.map((b) => ({
			key: b.key,
			slug: b.slug,
			name: b.name,
			image: b.image,
			quantity: b.quantity,
			max: b.max,
			price: b.price,
			saving: b.saving,
			total: b.total,
			bags: b.lines.map((l) => ({
				name: l.name,
				size: l.size,
				roast: l.roast,
				grind: l.grind,
				quantity: l.quantity
			})),
			short: b.lines.some((l) => short.has(l.choice.variantId))
		})),
		subtotal: Math.round((cart.subtotal + bundled.subtotal) * 100) / 100,
		changed: cart.changed || bundled.changed
	};
};

const bundleSchema = z.object({
	key: z.string().max(400),
	quantity: z.coerce.number().int().min(0).max(MAX_BUNDLE_QTY)
});

const updateSchema = z.object({
	key: z.string().max(60),
	quantity: z.coerce.number().int().min(0).max(MAX_QTY)
});

export const actions: Actions = {
	/** A new count for one line; 0 takes it out. */
	update: async ({ request, cookies, url }) => {
		const parsed = updateSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { error: m.cart_invalid() });
		const lines = readChoices(cookies)
			.map((l) => (lineKey(l) === parsed.data.key ? { ...l, quantity: parsed.data.quantity } : l))
			.filter((l) => l.quantity > 0);
		writeChoices(cookies, lines, url.protocol === 'https:');
	},
	/** A new count for one bundle, within its limit; 0 takes it out. */
	updateBundle: async ({ request, cookies, url }) => {
		const parsed = bundleSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { error: m.cart_invalid() });
		const { key, quantity } = parsed.data;
		const entries = readBundles(cookies)
			.map((b) => (bundleKey(b) === key ? { ...b, quantity } : b))
			.filter((b) => b.quantity > 0);
		// Priced again, so a count above the bundle's limit comes down to it.
		const priced = await priceBundles(entries);
		writeBundles(
			cookies,
			priced.bundles.map((b) => b.entry),
			url.protocol === 'https:'
		);
	},
	removeBundle: async ({ request, cookies, url }) => {
		const raw = (await request.formData()).get('key');
		const key = typeof raw === 'string' ? raw : '';
		writeBundles(
			cookies,
			readBundles(cookies).filter((b) => bundleKey(b) !== key),
			url.protocol === 'https:'
		);
	},
	remove: async ({ request, cookies, url }) => {
		const raw = (await request.formData()).get('key');
		const key = typeof raw === 'string' ? raw : '';
		writeChoices(
			cookies,
			readChoices(cookies).filter((l) => lineKey(l) !== key),
			url.protocol === 'https:'
		);
	}
};
