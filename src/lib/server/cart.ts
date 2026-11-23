/**
 * The shop's cart: a short list in an httpOnly cookie (`kb-cart`), priced from the database every
 * time it is read. The cookie only says what was chosen — variant, roast, grind, packaging and how
 * many — so a hand-edited cookie can change the choice, never the price.
 *
 * A line whose product was unpublished, or whose option is no longer allowed, falls back to the
 * product's default option or drops out, so the cart never holds something checkout would refuse.
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { z } from 'zod/v4';
import { publicFileUrl } from '@nahu/admin-kit/files';
import { db } from '#lib/server/db/index.ts';
import {
	bagSize,
	grind,
	packaging,
	product,
	productGrind,
	productPackaging,
	productRoastLevel,
	productVariant,
	roastLevel
} from '#lib/server/db/schema.ts';
import type { Localized } from '#lib/server/db/fields.ts';
import { LANGS } from '#lib/languages.ts';
import { tr } from '#lib/format.ts';

const COOKIE = 'kb-cart';
const MAX_LINES = 30;
export const MAX_QTY = 50;

const id = z.number().int().positive();
const cartLine = z.object({
	variantId: id,
	roastLevelId: id.nullable(),
	grindId: id.nullable(),
	packagingId: id.nullable(),
	quantity: z.number().int().min(1).max(MAX_QTY)
});
export type CartChoice = z.infer<typeof cartLine>;

/** What the cookie says, or nothing when it is missing or malformed. */
export function readChoices(cookies: Cookies): CartChoice[] {
	const raw = cookies.get(COOKIE);
	if (!raw) return [];
	try {
		const parsed = z.array(cartLine).max(MAX_LINES).safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}

/**
 * The number of bags, readable by the page (`kb-cart-n`): the museum pages are built ahead as
 * static HTML, so their header reads the cart badge from this rather than from the server.
 */
const COUNT_COOKIE = 'kb-cart-n';

export function writeChoices(cookies: Cookies, lines: CartChoice[], secure: boolean) {
	if (!lines.length) {
		cookies.delete(COOKIE, { path: '/' });
		cookies.delete(COUNT_COOKIE, { path: '/' });
		return;
	}
	const kept = lines.slice(0, MAX_LINES);
	const options = { path: '/', sameSite: 'lax' as const, secure, maxAge: 60 * 60 * 24 * 30 };
	cookies.set(COOKIE, JSON.stringify(kept), { ...options, httpOnly: true });
	cookies.set(COUNT_COOKIE, String(kept.reduce((sum, l) => sum + l.quantity, 0)), { ...options, httpOnly: false });
}

/** The same choice: one cart line per variant and option set. */
const sameChoice = (a: CartChoice, b: CartChoice) =>
	a.variantId === b.variantId && a.roastLevelId === b.roastLevelId && a.grindId === b.grindId && a.packagingId === b.packagingId;

export const lineKey = (c: CartChoice) => `${c.variantId}-${c.roastLevelId ?? 0}-${c.grindId ?? 0}-${c.packagingId ?? 0}`;

/** Adds `choice` to the cart, merging into a line with the same options. */
export function addChoice(lines: CartChoice[], choice: CartChoice) {
	const existing = lines.find((l) => sameChoice(l, choice));
	if (existing) existing.quantity = Math.min(existing.quantity + choice.quantity, MAX_QTY);
	else lines.push(choice);
	return lines.slice(-MAX_LINES);
}

/** Bags on hand for sale: packed units less those already set aside. */
const availableOf = sql<number>`(select coalesce(sum(ps.units - ps.reserved_units), 0) from packed_stock ps where ps.variant_id = ${productVariant.id})`.mapWith(
	Number
);

/** Where a coffee's stock is counted: packed bags. Merchandise and sets are not tracked as bags. */
export const tracksStock = (p: { kind: string; fulfilment: string }) => p.kind === 'coffee' && p.fulfilment === 'from_stock';

/**
 * A product's picture: its own, else one of the museum's photos of the same coffee, else the bag.
 * Seeded products have no uploads yet, so the design's pictures stand in.
 */
export function productImageUrl(p: { image: string | null; slug: string; kind: string }) {
	if (p.image) return publicFileUrl(p.image);
	if (p.slug.includes('limu')) return '/collection/washed-limmu.webp';
	if (p.slug.includes('gera')) return '/collection/washed-gera.webp';
	if (p.slug.includes('djimmah')) return '/collection/unwashed-djimmah.webp';
	if (p.slug.includes('cup') || p.slug.includes('jebena')) return '/journey/jebena.webp';
	if (p.kind === 'bundle') return '/collection/unwashed-nekemte.webp';
	return '/hero/bag-front.jpg';
}

/** Products a visitor may buy: published, switched on, not deleted, and not for members only. */
export const onSale = and(
	eq(product.publishStatus, 'published'),
	eq(product.isActive, true),
	isNull(product.deletedAt),
	eq(product.isMemberOnly, false)
);

/** `{ en: 'Washed Limu — 250 g · Light · Gift box', am: … }`: what the order line will say. */
function describe(parts: (Localized | string | null | undefined)[]): Localized {
	const out: Localized = {};
	for (const lang of LANGS) {
		const [head, ...rest] = parts.filter(Boolean).map((p) => tr(p as Localized, lang));
		out[lang] = rest.length ? `${head} — ${rest.join(' · ')}` : head;
	}
	return out;
}

export type PricedLine = Awaited<ReturnType<typeof priceCart>>['lines'][number];

/** The cart as it stands now: each line re-priced and its options checked against the product. */
export async function priceCart(choices: CartChoice[]) {
	const variantIds = [...new Set(choices.map((c) => c.variantId))];
	if (!variantIds.length) return { lines: [], subtotal: 0, count: 0, changed: false };

	const variants = await db
		.select({
			variantId: productVariant.id,
			sku: productVariant.sku,
			price: productVariant.price,
			variantName: productVariant.name,
			sizeName: bagSize.name,
			productId: product.id,
			slug: product.slug,
			kind: product.kind,
			name: product.name,
			image: product.image,
			fulfilment: product.fulfilment,
			taxRateId: product.taxRateId,
			available: availableOf
		})
		.from(productVariant)
		.innerJoin(product, eq(productVariant.productId, product.id))
		.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
		.where(and(inArray(productVariant.id, variantIds), eq(productVariant.isActive, true), isNull(productVariant.deletedAt), onSale));
	const productIds = [...new Set(variants.map((v) => v.productId))];
	const [roasts, grinds, packs] = productIds.length
		? await Promise.all([
				db
					.select({ productId: productRoastLevel.productId, id: roastLevel.id, name: roastLevel.name, isDefault: productRoastLevel.isDefault })
					.from(productRoastLevel)
					.innerJoin(roastLevel, eq(productRoastLevel.roastLevelId, roastLevel.id))
					.where(and(inArray(productRoastLevel.productId, productIds), isNull(roastLevel.deletedAt))),
				db
					.select({ productId: productGrind.productId, id: grind.id, name: grind.name, isDefault: productGrind.isDefault })
					.from(productGrind)
					.innerJoin(grind, eq(productGrind.grindId, grind.id))
					.where(and(inArray(productGrind.productId, productIds), isNull(grind.deletedAt))),
				db
					.select({
						productId: productPackaging.productId,
						id: packaging.id,
						name: packaging.name,
						surcharge: packaging.surcharge,
						isDefault: productPackaging.isDefault
					})
					.from(productPackaging)
					.innerJoin(packaging, eq(productPackaging.packagingId, packaging.id))
					.where(and(inArray(productPackaging.productId, productIds), isNull(packaging.deletedAt)))
			])
		: [[], [], []];

	/** The chosen option if the product allows it, else its default, else none. */
	const pick = <T extends { productId: number; id: number; isDefault: boolean }>(list: T[], productId: number, chosen: number | null) => {
		const allowed = list.filter((o) => o.productId === productId);
		return allowed.find((o) => o.id === chosen) ?? allowed.find((o) => o.isDefault) ?? allowed[0] ?? null;
	};

	let changed = false;
	const lines = [];
	for (const c of choices) {
		const v = variants.find((x) => x.variantId === c.variantId);
		if (!v) {
			changed = true;
			continue;
		}
		const roast = pick(roasts, v.productId, c.roastLevelId);
		const grnd = pick(grinds, v.productId, c.grindId);
		const pack = pick(packs, v.productId, c.packagingId);
		const choice: CartChoice = {
			variantId: v.variantId,
			roastLevelId: roast?.id ?? null,
			grindId: grnd?.id ?? null,
			packagingId: pack?.id ?? null,
			quantity: c.quantity
		};
		if (!sameChoice(choice, c)) changed = true;
		const unitPrice = Math.round((Number(v.price) + Number(pack?.surcharge ?? 0)) * 100) / 100;
		const size = v.variantName ?? v.sizeName;
		lines.push({
			key: lineKey(choice),
			choice,
			productId: v.productId,
			slug: v.slug,
			kind: v.kind,
			name: v.name,
			size,
			roast: roast?.name ?? null,
			grind: grnd?.name ?? null,
			packaging: pack && Number(pack.surcharge) > 0 ? pack.name : null,
			description: describe([v.name, size, roast?.name, grnd?.name, pack && Number(pack.surcharge) > 0 ? pack.name : null]),
			sku: v.sku,
			fulfilment: v.fulfilment,
			taxRateId: v.taxRateId,
			image: productImageUrl(v),
			unitPrice,
			quantity: c.quantity,
			lineTotal: Math.round(unitPrice * c.quantity * 100) / 100,
			/** Bags on hand, for coffee sold from stock; null when not counted. */
			available: tracksStock(v) ? v.available : null
		});
	}
	const subtotal = Math.round(lines.reduce((sum, l) => sum + l.lineTotal, 0) * 100) / 100;
	const count = lines.reduce((sum, l) => sum + l.quantity, 0);
	return { lines, subtotal, count, changed };
}

/** Lines asking for more bags than are on hand (summed per variant across lines). */
export function shortLines(lines: PricedLine[]) {
	const wanted = new Map<number, number>();
	for (const l of lines) if (l.available !== null) wanted.set(l.choice.variantId, (wanted.get(l.choice.variantId) ?? 0) + l.quantity);
	return lines.filter((l) => l.available !== null && (wanted.get(l.choice.variantId) ?? 0) > l.available);
}
