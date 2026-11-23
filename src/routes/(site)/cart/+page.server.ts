import { fail } from '@sveltejs/kit';
import { z } from 'zod/v4';
import {
	lineKey,
	MAX_QTY,
	priceCart,
	readChoices,
	shortLines,
	writeChoices
} from '#lib/server/cart.ts';
import { m } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const cart = await priceCart(readChoices(cookies));
	// Something left the shop or changed its options: the cookie follows what is shown.
	if (cart.changed)
		writeChoices(
			cookies,
			cart.lines.map((l) => l.choice),
			url.protocol === 'https:'
		);
	const short = new Set(shortLines(cart.lines).map((l) => l.key));
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
			short: short.has(l.key)
		})),
		subtotal: cart.subtotal,
		changed: cart.changed
	};
};

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
