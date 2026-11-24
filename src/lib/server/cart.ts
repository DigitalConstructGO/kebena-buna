/**
 * The shop's cart: a short list in an httpOnly cookie (`kb-cart`), priced from the database every
 * time it is read. The cookie only says what was chosen — variant, roast, grind, packaging and how
 * many — so a hand-edited cookie can change the choice, never the price.
 *
 * A line whose product was unpublished, or whose option is no longer allowed, falls back to the
 * product's default option or drops out, so the cart never holds something checkout would refuse.
 *
 * Bundles sit in a second cookie (`kb-bundles`): the bundle, the coffee picked for each choice in
 * it, one roast and grind for all its bags, and how many. `priceBundles` prices them with
 * `priceBundle`, so the saving is always today's.
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
import { BundleRefused, priceBundle } from '#lib/server/bundles.ts';

const COOKIE = 'kb-cart';
const BUNDLE_COOKIE = 'kb-bundles';
const MAX_BUNDLES = 10;
/** The most of one bundle a cart holds, when the bundle sets no lower limit. */
export const MAX_BUNDLE_QTY = 10;
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

const bundleEntry = z.object({
	bundleId: id,
	picks: z.array(z.object({ itemId: id, variantId: id })).max(24),
	roastLevelId: id.nullable(),
	grindId: id.nullable(),
	quantity: z.number().int().min(1).max(MAX_BUNDLE_QTY),
	/** Bags in one bundle, for the header's count. */
	bags: z.number().int().min(0).max(99)
});
export type BundleEntry = z.infer<typeof bundleEntry>;

/** The bundles the cookie holds, or none when it is missing or malformed. */
export function readBundles(cookies: Cookies): BundleEntry[] {
	const raw = cookies.get(BUNDLE_COOKIE);
	if (!raw) return [];
	try {
		const parsed = z.array(bundleEntry).max(MAX_BUNDLES).safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}

/** The same bundle with the same picks and options: one cart entry. */
export const bundleKey = (b: BundleEntry) =>
	`b${b.bundleId}-${b.roastLevelId ?? 0}-${b.grindId ?? 0}-${b.picks
		.map((p) => `${p.itemId}.${p.variantId}`)
		.toSorted()
		.join('_')}`;

/** Adds a bundle to the cart, merging into the same one already there. */
export function addBundle(entries: BundleEntry[], entry: BundleEntry, max = MAX_BUNDLE_QTY) {
	const existing = entries.find((e) => bundleKey(e) === bundleKey(entry));
	if (existing) existing.quantity = Math.min(existing.quantity + entry.quantity, max);
	else entries.push({ ...entry, quantity: Math.min(entry.quantity, max) });
	return entries.slice(-MAX_BUNDLES);
}

/**
 * The number of bags, readable by the page (`kb-cart-n`): the museum pages are built ahead as
 * static HTML, so their header reads the cart badge from this rather than from the server.
 */
const COUNT_COOKIE = 'kb-cart-n';

/**
 * Writes the cart: its bags, and its bundles (those already there unless given). The header's count
 * covers both.
 */
export function writeChoices(
	cookies: Cookies,
	lines: CartChoice[],
	secure: boolean,
	bundles: BundleEntry[] = readBundles(cookies)
) {
	const kept = lines.slice(0, MAX_LINES);
	const keptBundles = bundles.slice(0, MAX_BUNDLES);
	const options = { path: '/', sameSite: 'lax' as const, secure, maxAge: 60 * 60 * 24 * 30 };
	if (kept.length) cookies.set(COOKIE, JSON.stringify(kept), { ...options, httpOnly: true });
	else cookies.delete(COOKIE, { path: '/' });
	if (keptBundles.length)
		cookies.set(BUNDLE_COOKIE, JSON.stringify(keptBundles), { ...options, httpOnly: true });
	else cookies.delete(BUNDLE_COOKIE, { path: '/' });
	const count =
		kept.reduce((sum, l) => sum + l.quantity, 0) +
		keptBundles.reduce((sum, b) => sum + b.bags * b.quantity, 0);
	if (count) cookies.set(COUNT_COOKIE, String(count), { ...options, httpOnly: false });
	else cookies.delete(COUNT_COOKIE, { path: '/' });
}

/** Writes the bundles, keeping the bags as they are. */
export const writeBundles = (cookies: Cookies, bundles: BundleEntry[], secure: boolean) =>
	writeChoices(cookies, readChoices(cookies), secure, bundles);

/** The same choice: one cart line per variant and option set. */
const sameChoice = (a: CartChoice, b: CartChoice) =>
	a.variantId === b.variantId &&
	a.roastLevelId === b.roastLevelId &&
	a.grindId === b.grindId &&
	a.packagingId === b.packagingId;

export const lineKey = (c: CartChoice) =>
	`${c.variantId}-${c.roastLevelId ?? 0}-${c.grindId ?? 0}-${c.packagingId ?? 0}`;

/** Adds `choice` to the cart, merging into a line with the same options. */
export function addChoice(lines: CartChoice[], choice: CartChoice) {
	const existing = lines.find((l) => sameChoice(l, choice));
	if (existing) existing.quantity = Math.min(existing.quantity + choice.quantity, MAX_QTY);
	else lines.push(choice);
	return lines.slice(-MAX_LINES);
}

/** Bags on hand for sale: packed units less those already set aside. */
const availableOf =
	sql<number>`(select coalesce(sum(ps.units - ps.reserved_units), 0) from packed_stock ps where ps.variant_id = ${productVariant.id})`.mapWith(
		Number
	);

/** Where a coffee's stock is counted: packed bags. Merchandise and sets are not tracked as bags. */
export const tracksStock = (p: { kind: string; fulfilment: string }) =>
	p.kind === 'coffee' && p.fulfilment === 'from_stock';

/**
 * A product's picture: its own upload (served at `/media`), else the Kebena bag. The seed sets the
 * design's photos as uploads (`scripts/seed/productImages.ts`).
 */
export function productImageUrl(p: { image: string | null }) {
	return p.image ? publicFileUrl(p.image) : '/hero/bag-front.jpg';
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

/**
 * The cart as it stands now: each line re-priced and its options checked against the product.
 * `staff` prices an order taken in the dashboard: any switched-on product, published or not and
 * members-only included.
 */
export async function priceCart(choices: CartChoice[], { staff = false } = {}) {
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
			grams: bagSize.grams,
			available: availableOf
		})
		.from(productVariant)
		.innerJoin(product, eq(productVariant.productId, product.id))
		.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
		.where(
			and(
				inArray(productVariant.id, variantIds),
				eq(productVariant.isActive, true),
				isNull(productVariant.deletedAt),
				staff ? and(eq(product.isActive, true), isNull(product.deletedAt)) : onSale
			)
		);
	const productIds = [...new Set(variants.map((v) => v.productId))];
	const [roasts, grinds, packs] = productIds.length
		? await Promise.all([
				db
					.select({
						productId: productRoastLevel.productId,
						id: roastLevel.id,
						name: roastLevel.name,
						isDefault: productRoastLevel.isDefault
					})
					.from(productRoastLevel)
					.innerJoin(roastLevel, eq(productRoastLevel.roastLevelId, roastLevel.id))
					.where(
						and(inArray(productRoastLevel.productId, productIds), isNull(roastLevel.deletedAt))
					),
				db
					.select({
						productId: productGrind.productId,
						id: grind.id,
						name: grind.name,
						isDefault: productGrind.isDefault
					})
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
	const pick = <T extends { productId: number; id: number; isDefault: boolean }>(
		list: T[],
		productId: number,
		chosen: number | null
	) => {
		const allowed = list.filter((o) => o.productId === productId);
		return (
			allowed.find((o) => o.id === chosen) ?? allowed.find((o) => o.isDefault) ?? allowed[0] ?? null
		);
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
			description: describe([
				v.name,
				size,
				roast?.name,
				grnd?.name,
				pack && Number(pack.surcharge) > 0 ? pack.name : null
			]),
			sku: v.sku,
			fulfilment: v.fulfilment,
			taxRateId: v.taxRateId,
			/** Grams in one bag: what wholesale tiers are counted in. */
			grams: v.grams,
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
	for (const l of lines)
		if (l.available !== null)
			wanted.set(l.choice.variantId, (wanted.get(l.choice.variantId) ?? 0) + l.quantity);
	return lines.filter(
		(l) => l.available !== null && (wanted.get(l.choice.variantId) ?? 0) > l.available
	);
}

export type PricedBundle = Awaited<ReturnType<typeof priceBundles>>['bundles'][number];

/**
 * The cart's bundles as they stand now: each priced by `priceBundle` and its bags by `priceCart`
 * (for their descriptions, tax, stock and the roast and grind each coffee allows). A bundle no longer
 * on sale, or whose coffee was switched off, drops out.
 */
export async function priceBundles(entries: BundleEntry[]) {
	let changed = false;
	const bundles = [];
	for (const e of entries) {
		let priced: Awaited<ReturnType<typeof priceBundle>>;
		try {
			priced = await priceBundle(db, e.bundleId, e.picks);
		} catch (err) {
			if (!(err instanceof BundleRefused)) throw err;
			changed = true;
			continue;
		}
		const b = priced.bundle;
		const max = Math.min(b.maxPerOrder ?? MAX_BUNDLE_QTY, MAX_BUNDLE_QTY);
		const quantity = Math.min(e.quantity, max);
		const bags = await priceCart(
			priced.lines.map((l) => ({
				variantId: l.variantId,
				roastLevelId: e.roastLevelId,
				grindId: e.grindId,
				packagingId: null,
				quantity: l.quantity
			})),
			{ staff: true }
		);
		if (bags.lines.length !== priced.lines.length) {
			changed = true;
			continue;
		}
		const bagCount = priced.lines.reduce((sum, l) => sum + l.quantity, 0);
		const entry: BundleEntry = { ...e, quantity, bags: bagCount };
		if (quantity !== e.quantity || bagCount !== e.bags) changed = true;
		bundles.push({
			key: bundleKey(entry),
			entry,
			bundleId: b.id,
			slug: b.slug,
			name: b.name,
			image: b.image ? publicFileUrl(b.image) : '/hero/bag-front.jpg',
			stacksWithDiscounts: b.stacksWithDiscounts,
			quantity,
			max,
			bags: bagCount,
			list: priced.list,
			price: priced.price,
			saving: priced.saving,
			total: Math.round(priced.price * quantity * 100) / 100,
			/** One bundle's bags: priced as the bundle prices them, roast and grind as allowed. */
			lines: priced.lines.map((l, i) => {
				const bag = bags.lines[i];
				return {
					...bag,
					// No gift packaging in a bundle: the bundle's price is the bags' own.
					choice: { ...bag.choice, packagingId: null },
					unitPrice: l.unitPrice,
					quantity: l.quantity,
					discountAmount: l.discountAmount
				};
			})
		});
	}
	const subtotal = Math.round(bundles.reduce((sum, b) => sum + b.total, 0) * 100) / 100;
	return { bundles, subtotal, changed };
}

/**
 * Bags the whole cart asks for beyond what is on hand, loose and in bundles together: the variants
 * short, with what is left of each.
 */
export function shortVariants(lines: PricedLine[], bundles: PricedBundle[]) {
	const wanted = new Map<number, { available: number; want: number }>();
	const want = (variantId: number, available: number | null, quantity: number) => {
		if (available === null) return;
		const w = wanted.get(variantId) ?? { available, want: 0 };
		w.want += quantity;
		wanted.set(variantId, w);
	};
	for (const l of lines) want(l.choice.variantId, l.available, l.quantity);
	for (const b of bundles)
		for (const l of b.lines) want(l.choice.variantId, l.available, l.quantity * b.quantity);
	return new Map(
		[...wanted].filter(([, w]) => w.want > w.available).map(([v, w]) => [v, w.available])
	);
}
