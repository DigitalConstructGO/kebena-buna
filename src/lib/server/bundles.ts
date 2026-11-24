/**
 * Bundles: what each holds and what it costs today, and pricing a customer's picks for checkout.
 * The sums are `#lib/bundles`, shared with the page; this decides which bags may go in.
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import type { Writer } from '@nahu/admin-kit/server/db';
import { fromLocal } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import {
	bagSize,
	bundle,
	bundleItem,
	orderLine,
	product,
	productCategory,
	productVariant
} from '#lib/server/db/schema.ts';
import { enOf, packLocalized } from '#lib/server/localized.ts';
import { bundlePrice, inWindow, spreadSaving, type BundleRule } from '#lib/bundles.ts';

type Bundle = typeof bundle.$inferSelect;

const slotSize = alias(bagSize, 'slot_size');
const variantSize = alias(bagSize, 'variant_size');

/**
 * The coffees a customer may put in a slot: live, published coffee in the slot's bag size, from its
 * category when it has one. `isChoosable` below is the same rule for a variant already read.
 */
const choosable = sql`from product_variant ev join product ep on ep.id = ev.product_id
	where ev.bag_size_id = ${bundleItem.bagSizeId} and ev.deleted_at is null and ev.is_active = 1
	and ep.deleted_at is null and ep.is_active = 1 and ep.kind = 'coffee' and ep.publish_status = 'published'
	and (${bundleItem.categoryId} is null or ep.category_id = ${bundleItem.categoryId})`;

type Candidate = {
	bagSizeId: number | null;
	variantDeletedAt: Date | null;
	variantActive: boolean;
	productDeletedAt: Date | null;
	productActive: boolean;
	kind: string;
	publishStatus: string;
	categoryId: number | null;
};

function isChoosable(v: Candidate, slot: { bagSizeId: number | null; categoryId: number | null }) {
	return (
		v.bagSizeId === slot.bagSizeId &&
		!v.variantDeletedAt &&
		v.variantActive &&
		!v.productDeletedAt &&
		v.productActive &&
		v.kind === 'coffee' &&
		v.publishStatus === 'published' &&
		(slot.categoryId === null || v.categoryId === slot.categoryId)
	);
}

export type BundleContent = Awaited<ReturnType<typeof bundleContents>>[number];

/**
 * What these bundles hold, in order, each row with what one bag of it costs today — one price for
 * an exact size, the cheapest to dearest choice for a slot — and what is wrong with it, if anything.
 */
export async function bundleContents(bundleIds: number[]) {
	if (!bundleIds.length) return [];
	const rows = await db
		.select({
			id: bundleItem.id,
			bundleId: bundleItem.bundleId,
			variantId: bundleItem.variantId,
			bagSizeId: bundleItem.bagSizeId,
			categoryId: bundleItem.categoryId,
			quantity: bundleItem.quantity,
			sortOrder: bundleItem.sortOrder,
			status: bundleItem.status,
			productId: productVariant.productId,
			productName: enOf(product.name),
			variantName: enOf(productVariant.name),
			sku: productVariant.sku,
			variantPrice: productVariant.price,
			variantLive:
				sql<number>`(${productVariant.deletedAt} is null and ${productVariant.isActive} = 1 and ${product.deletedAt} is null and ${product.isActive} = 1)`.mapWith(
					Number
				),
			variantSize: enOf(variantSize.name),
			variantGrams: variantSize.grams,
			slotSize: enOf(slotSize.name),
			slotGrams: slotSize.grams,
			category: enOf(productCategory.name),
			slotMin: sql<number | null>`(select min(ev.price) ${choosable})`.mapWith((v) =>
				v === null ? null : Number(v)
			),
			slotMax: sql<number | null>`(select max(ev.price) ${choosable})`.mapWith((v) =>
				v === null ? null : Number(v)
			),
			slotChoices: sql<number>`(select count(*) ${choosable})`.mapWith(Number),
			/** The same names in every language, for the shop. */
			text: {
				product: product.name,
				variant: productVariant.name,
				variantSize: variantSize.name,
				slotSize: slotSize.name,
				category: productCategory.name
			}
		})
		.from(bundleItem)
		.leftJoin(productVariant, eq(bundleItem.variantId, productVariant.id))
		.leftJoin(product, eq(productVariant.productId, product.id))
		.leftJoin(variantSize, eq(productVariant.bagSizeId, variantSize.id))
		.leftJoin(slotSize, eq(bundleItem.bagSizeId, slotSize.id))
		.leftJoin(productCategory, eq(bundleItem.categoryId, productCategory.id))
		.where(and(inArray(bundleItem.bundleId, bundleIds), isNull(bundleItem.deletedAt)))
		.orderBy(bundleItem.bundleId, bundleItem.sortOrder, bundleItem.id);

	return rows.map((r) => {
		const exact = r.variantId !== null;
		const size = exact ? r.variantSize || r.variantName : r.slotSize;
		const label = exact
			? `${r.productName} — ${size}`
			: `Any ${r.slotSize} coffee${r.categoryId ? ` (${r.category})` : ''}`;
		const min = exact ? Number(r.variantPrice ?? 0) : r.slotMin;
		const max = exact ? Number(r.variantPrice ?? 0) : r.slotMax;
		const problem = exact
			? r.variantLive
				? null
				: 'That size is switched off or deleted'
			: r.slotChoices
				? null
				: 'No published coffee comes in this size';
		return {
			...r,
			kind: exact ? ('exact' as const) : ('choice' as const),
			label,
			grams: (exact ? r.variantGrams : r.slotGrams) ?? null,
			min,
			max,
			problem
		};
	});
}

/** One bundle's totals: bags, weight, what they would cost alone, and what the bundle charges. */
export function bundleTotals(rule: BundleRule, items: BundleContent[]) {
	const live = items.filter((i) => i.status);
	const sum = (pick: (i: BundleContent) => number) =>
		live.reduce((t, i) => t + i.quantity * pick(i), 0);
	const listMin = sum((i) => i.min ?? 0);
	const listMax = sum((i) => i.max ?? 0);
	const low = bundlePrice(rule, listMin);
	const high = bundlePrice(rule, listMax);
	const weighed = live.every((i) => i.grams !== null);
	return {
		bags: sum(() => 1),
		grams: weighed ? sum((i) => i.grams ?? 0) : null,
		listMin,
		listMax,
		priceMin: low.price,
		priceMax: high.price,
		savingMin: Math.min(low.saving, high.saving),
		savingMax: Math.max(low.saving, high.saving),
		text: live.map((i) => `${i.quantity} × ${i.label}`).join(' + '),
		problems: live.filter((i) => i.problem).map((i) => `${i.label}: ${i.problem}`)
	};
}

/** The bundle's translated text the forms carry per language. */
export const BUNDLE_TEXT = ['name', 'summary'];

/** A bundle form's values as columns: text folded per language, the window as times of day. */
export function bundleRow(d: {
	startsOn?: string | null;
	endsOn?: string | null;
	[key: string]: unknown;
}) {
	const { startsOn, endsOn, ...rest } = d;
	return {
		...packLocalized(rest, BUNDLE_TEXT),
		startsAt: startsOn ? fromLocal(startsOn, '00:00') : null,
		endsAt: endsOn ? fromLocal(endsOn, '23:59') : null
	} as Partial<typeof bundle.$inferInsert>;
}

/** How many times each bundle has been sold: one per bundle in an order, however many bags. */
export const timesSoldOf =
	sql<number>`(select count(distinct ol.order_id, ol.bundle_group) from order_line ol where ol.bundle_id = \`bundle\`.\`id\`)`.mapWith(
		Number
	);

export async function bundleSold(tx: Writer, bundleId: number) {
	const [line] = await tx
		.select({ id: orderLine.id })
		.from(orderLine)
		.where(eq(orderLine.bundleId, bundleId))
		.limit(1);
	return Boolean(line);
}

/** A customer's choice for one slot: which coffee goes in it. A slot of 2 takes two picks. */
export type BundlePick = { itemId: number; variantId: number };

/** Why a bundle cannot be priced as asked, in words for the customer. */
export class BundleRefused extends Error {}

/** Why the bundle is not on sale to this customer now, or null when it is. */
export function notOnSale(b: Bundle, opts: { isMember?: boolean; now?: Date } = {}) {
	if (b.deletedAt || !b.isActive || b.publishStatus !== 'published')
		return 'This bundle is not on sale.';
	if (!inWindow(b, opts.now)) return 'This offer is not running now.';
	if (b.isMemberOnly && !opts.isMember) return 'This bundle is for members.';
	return null;
}

/**
 * One bundle's order lines for these picks, at today's prices, with the saving spread across them.
 * Exact sizes come as they are; each slot needs exactly its quantity of picks of coffee it allows.
 * The checkout adds roast, grind and tax per line, and checks `maxPerOrder` against the cart.
 */
export async function priceBundle(
	tx: Writer,
	bundleId: number,
	picks: BundlePick[],
	opts: { isMember?: boolean; now?: Date } = {}
) {
	const [b] = await tx.select().from(bundle).where(eq(bundle.id, bundleId));
	if (!b) throw new BundleRefused('This bundle is not on sale.');
	const refusal = notOnSale(b, opts);
	if (refusal) throw new BundleRefused(refusal);

	const items = await tx
		.select()
		.from(bundleItem)
		.where(
			and(eq(bundleItem.bundleId, b.id), isNull(bundleItem.deletedAt), eq(bundleItem.status, true))
		)
		.orderBy(bundleItem.sortOrder, bundleItem.id);
	if (!items.length) throw new BundleRefused('This bundle is not on sale.');

	const wanted = [
		...new Set([...items.map((i) => i.variantId), ...picks.map((p) => p.variantId)])
	].filter((id): id is number => id !== null);
	const variants = await tx
		.select({
			id: productVariant.id,
			price: productVariant.price,
			bagSizeId: productVariant.bagSizeId,
			variantDeletedAt: productVariant.deletedAt,
			variantActive: productVariant.isActive,
			productDeletedAt: product.deletedAt,
			productActive: product.isActive,
			kind: product.kind,
			publishStatus: product.publishStatus,
			categoryId: product.categoryId
		})
		.from(productVariant)
		.innerJoin(product, eq(productVariant.productId, product.id))
		.where(inArray(productVariant.id, wanted));
	const byId = new Map(variants.map((v) => [v.id, v]));

	const lines: { itemId: number; variantId: number; quantity: number; unitPrice: number }[] = [];
	for (const item of items) {
		if (item.variantId !== null) {
			const v = byId.get(item.variantId);
			if (!v || v.variantDeletedAt || !v.variantActive || v.productDeletedAt || !v.productActive) {
				throw new BundleRefused('Part of this bundle is sold out.');
			}
			lines.push({
				itemId: item.id,
				variantId: v.id,
				quantity: item.quantity,
				unitPrice: Number(v.price)
			});
			continue;
		}
		const mine = picks.filter((p) => p.itemId === item.id);
		if (mine.length !== item.quantity) {
			throw new BundleRefused(
				`Choose ${item.quantity} coffee${item.quantity === 1 ? '' : 's'} for each choice in the bundle.`
			);
		}
		for (const pick of mine) {
			const v = byId.get(pick.variantId);
			if (!v || !isChoosable(v, item))
				throw new BundleRefused('One of the coffees chosen cannot go in this bundle.');
			lines.push({ itemId: item.id, variantId: v.id, quantity: 1, unitPrice: Number(v.price) });
		}
	}
	if (picks.some((p) => !items.some((i) => i.id === p.itemId && i.variantId === null))) {
		throw new BundleRefused('One of the coffees chosen cannot go in this bundle.');
	}

	const totals = lines.map((l) => l.unitPrice * l.quantity);
	const list = totals.reduce((t, x) => t + x, 0);
	const { price, saving } = bundlePrice({ pricing: b.pricing, value: Number(b.value) }, list);
	const shares = spreadSaving(totals, saving);
	return {
		bundle: b,
		list,
		price,
		saving,
		lines: lines.map((l, i) => ({ ...l, discountAmount: shares[i] }))
	};
}

/**
 * Bundles a visitor may buy now: published, switched on, in their window, not for members only,
 * and with nothing in them broken. Each with what it holds and what it costs today.
 */
export async function bundlesOnSale(where?: { slug?: string }) {
	const rows = await db
		.select()
		.from(bundle)
		.where(
			and(
				eq(bundle.publishStatus, 'published'),
				eq(bundle.isActive, true),
				eq(bundle.isMemberOnly, false),
				isNull(bundle.deletedAt),
				where?.slug ? eq(bundle.slug, where.slug) : undefined
			)
		)
		.orderBy(bundle.sortOrder, bundle.id);
	const live = rows.filter((b) => !notOnSale(b));
	const contents = await bundleContents(live.map((b) => b.id));
	return live
		.map((b) => {
			const items = contents.filter((c) => c.bundleId === b.id && c.status);
			return {
				bundle: b,
				items,
				totals: bundleTotals({ pricing: b.pricing, value: Number(b.value) }, items)
			};
		})
		.filter((b) => b.items.length && !b.totals.problems.length);
}

/**
 * The coffees a customer may put in each of these slots, cheapest first: the same rule as
 * `isChoosable`, with names for the page.
 */
export async function slotChoices(
	slots: { id: number; bagSizeId: number | null; categoryId: number | null }[]
) {
	const sizes = [...new Set(slots.map((s) => s.bagSizeId).filter((v): v is number => v !== null))];
	if (!sizes.length)
		return new Map<number, { variantId: number; name: Record<string, string>; price: number }[]>();
	const variants = await db
		.select({
			variantId: productVariant.id,
			bagSizeId: productVariant.bagSizeId,
			categoryId: product.categoryId,
			name: product.name,
			price: productVariant.price
		})
		.from(productVariant)
		.innerJoin(product, eq(productVariant.productId, product.id))
		.where(
			and(
				inArray(productVariant.bagSizeId, sizes),
				isNull(productVariant.deletedAt),
				eq(productVariant.isActive, true),
				isNull(product.deletedAt),
				eq(product.isActive, true),
				eq(product.kind, 'coffee'),
				eq(product.publishStatus, 'published')
			)
		)
		.orderBy(productVariant.price, product.sortOrder);
	return new Map(
		slots.map((s) => [
			s.id,
			variants
				.filter(
					(v) =>
						v.bagSizeId === s.bagSizeId && (s.categoryId === null || v.categoryId === s.categoryId)
				)
				.map((v) => ({ variantId: v.variantId, name: v.name, price: Number(v.price) }))
		])
	);
}
