import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, isNull } from 'drizzle-orm';
import { z } from 'zod/v4';
import { publicFileUrl } from '@nahu/admin-kit/files';
import { db } from '#lib/server/db/index.ts';
import { grind, roastLevel } from '#lib/server/db/schema.ts';
import { bundlesOnSale, slotChoices } from '#lib/server/bundles.ts';
import {
	addBundle,
	priceBundles,
	readBundles,
	readChoices,
	shortVariants,
	priceCart,
	writeBundles
} from '#lib/server/cart.ts';
import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/i18n.ts';
import { siteHref } from '#lib/site/locale.ts';
import type { Actions, PageServerLoad } from './$types';

async function onSale(slug: string) {
	const [found] = await bundlesOnSale({ slug });
	return found ?? null;
}

export const load: PageServerLoad = async ({ params }) => {
	const found = await onSale(params.slug);
	if (!found) error(404, m.bundle_unavailable());
	const { bundle: b, items, totals } = found;
	const choices = await slotChoices(items.filter((i) => i.kind === 'choice'));
	const [roasts, grinds] = await Promise.all([
		db
			.select({ id: roastLevel.id, name: roastLevel.name })
			.from(roastLevel)
			.where(isNull(roastLevel.deletedAt))
			.orderBy(asc(roastLevel.sortOrder)),
		db
			.select({ id: grind.id, name: grind.name })
			.from(grind)
			.where(and(isNull(grind.deletedAt)))
			.orderBy(asc(grind.sortOrder))
	]);
	return {
		bundle: {
			slug: b.slug,
			name: b.name,
			summary: b.summary,
			image: b.image ? publicFileUrl(b.image) : '/hero/bag-front.jpg',
			max: Math.min(b.maxPerOrder ?? 10, 10),
			rule: { pricing: b.pricing, value: Number(b.value) },
			stacks: b.stacksWithDiscounts
		},
		items: items.map((i) => ({
			id: i.id,
			kind: i.kind,
			quantity: i.quantity,
			product: i.text.product,
			size: i.kind === 'exact' ? (i.text.variantSize ?? i.text.variant) : i.text.slotSize,
			category: i.categoryId ? i.text.category : null,
			price: i.min,
			choices: choices.get(i.id) ?? []
		})),
		totals: {
			bags: totals.bags,
			listMin: totals.listMin,
			listMax: totals.listMax,
			priceMin: totals.priceMin,
			priceMax: totals.priceMax,
			savingMin: totals.savingMin
		},
		roasts,
		grinds
	};
};

const id = z.coerce.number().int().positive();
const optionalId = z.preprocess((v) => (v === '' || v == null ? null : v), id.nullable());

export const actions: Actions = {
	/** Into the cart, priced as the cart will price it: a refused choice never lands. */
	add: async ({ request, params, cookies, url }) => {
		const found = await onSale(params.slug);
		if (!found) return fail(404, { error: m.bundle_unavailable() });
		const data = await request.formData();
		const options = z
			.object({ roastLevelId: optionalId, grindId: optionalId, quantity: id.max(10) })
			.safeParse(Object.fromEntries(data));
		if (!options.success) return fail(400, { error: m.shop_add_invalid() });
		// One `pick-<item>` field per bag a choice holds.
		const picks = [];
		for (const item of found.items.filter((i) => i.kind === 'choice')) {
			const chosen = data.getAll(`pick-${item.id}`).map(Number);
			if (chosen.length !== item.quantity || chosen.some((v) => !Number.isInteger(v) || v <= 0))
				return fail(400, { error: m.bundle_err_picks() });
			picks.push(...chosen.map((variantId) => ({ itemId: item.id, variantId })));
		}
		const entry = { bundleId: found.bundle.id, picks, ...options.data, bags: 0 };
		const [priced] = (await priceBundles([entry])).bundles;
		if (!priced) return fail(400, { error: m.bundle_err_picks() });

		const entries = addBundle(readBundles(cookies), priced.entry, priced.max);
		const [cart, all] = await Promise.all([priceCart(readChoices(cookies)), priceBundles(entries)]);
		const short = shortVariants(cart.lines, all.bundles);
		if (short.size) {
			const left = Math.min(...short.values());
			return fail(409, {
				error: left > 0 ? m.shop_only_left({ count: left }) : m.shop_sold_out()
			});
		}
		writeBundles(
			cookies,
			all.bundles.map((b) => b.entry),
			url.protocol === 'https:'
		);
		redirect(303, siteHref('/cart', getLocale()));
	}
};
