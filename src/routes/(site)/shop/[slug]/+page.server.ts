import { error, fail } from '@sveltejs/kit';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import { publicFileUrl } from '@nahu/admin-kit/files';
import { db } from '#lib/server/db/index.ts';
import {
	bagSize,
	grind,
	lot,
	packaging,
	product,
	productCategory,
	productGrind,
	productImage,
	productOrigin,
	productPackaging,
	productRoastLevel,
	productVariant,
	roastLevel,
	station
} from '#lib/server/db/schema.ts';
import { addChoice, MAX_QTY, onSale, priceCart, productImageUrl, readChoices, tracksStock, writeChoices } from '#lib/server/cart.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

const availableOf = sql<number>`(select coalesce(sum(ps.units - ps.reserved_units), 0) from packed_stock ps where ps.variant_id = ${productVariant.id})`.mapWith(
	Number
);

async function productBySlug(slug: string) {
	const [p] = await db
		.select({
			id: product.id,
			slug: product.slug,
			kind: product.kind,
			name: product.name,
			summary: product.summary,
			description: product.description,
			originStory: product.originStory,
			tastingNotes: product.tastingNotes,
			image: product.image,
			fulfilment: product.fulfilment,
			dispatchDays: product.dispatchDays,
			seoTitle: product.seoTitle,
			seoDescription: product.seoDescription,
			category: productCategory.name,
			categorySlug: productCategory.slug
		})
		.from(product)
		.leftJoin(productCategory, eq(product.categoryId, productCategory.id))
		.where(and(eq(product.slug, slug), onSale))
		.limit(1);
	return p ?? null;
}

export const load: PageServerLoad = async ({ params }) => {
	const p = await productBySlug(params.slug);
	if (!p) error(404, m.shop_not_found());

	const [variants, images, roasts, grinds, packs, origins] = await Promise.all([
		db
			.select({
				id: productVariant.id,
				name: productVariant.name,
				size: bagSize.name,
				grams: bagSize.grams,
				price: productVariant.price,
				compareAtPrice: productVariant.compareAtPrice,
				available: availableOf
			})
			.from(productVariant)
			.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
			.where(and(eq(productVariant.productId, p.id), eq(productVariant.isActive, true), isNull(productVariant.deletedAt)))
			.orderBy(asc(productVariant.sortOrder), asc(bagSize.grams), asc(productVariant.id)),
		db
			.select({ fileName: productImage.fileName, alt: productImage.alt })
			.from(productImage)
			.where(eq(productImage.productId, p.id))
			.orderBy(asc(productImage.sortOrder), asc(productImage.id)),
		db
			.select({ id: roastLevel.id, name: roastLevel.name, description: roastLevel.description, isDefault: productRoastLevel.isDefault })
			.from(productRoastLevel)
			.innerJoin(roastLevel, eq(productRoastLevel.roastLevelId, roastLevel.id))
			.where(and(eq(productRoastLevel.productId, p.id), isNull(roastLevel.deletedAt)))
			.orderBy(asc(roastLevel.sortOrder)),
		db
			.select({ id: grind.id, name: grind.name, isDefault: productGrind.isDefault })
			.from(productGrind)
			.innerJoin(grind, eq(productGrind.grindId, grind.id))
			.where(and(eq(productGrind.productId, p.id), isNull(grind.deletedAt)))
			.orderBy(asc(grind.sortOrder)),
		db
			.select({ id: packaging.id, name: packaging.name, surcharge: packaging.surcharge, isDefault: productPackaging.isDefault })
			.from(productPackaging)
			.innerJoin(packaging, eq(productPackaging.packagingId, packaging.id))
			.where(and(eq(productPackaging.productId, p.id), isNull(packaging.deletedAt)))
			.orderBy(asc(packaging.sortOrder)),
		db
			.select({ station: station.name, lot: lot.code, share: productOrigin.sharePercent })
			.from(productOrigin)
			.leftJoin(lot, eq(productOrigin.lotId, lot.id))
			.leftJoin(station, eq(sql`coalesce(${productOrigin.stationId}, ${lot.stationId})`, station.id))
			.where(eq(productOrigin.productId, p.id))
			.orderBy(asc(productOrigin.sortOrder))
	]);
	if (!variants.length) error(404, m.shop_not_found());

	const counted = tracksStock(p);
	return {
		product: { ...p, picture: productImageUrl(p), roastToOrder: p.fulfilment === 'roast_to_order' },
		images: images.map((i) => ({ src: publicFileUrl(i.fileName), alt: i.alt })),
		variants: variants.map((v) => ({
			...v,
			price: Number(v.price),
			compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
			available: counted ? v.available : null
		})),
		roasts,
		grinds,
		packs: packs.map((k) => ({ ...k, surcharge: Number(k.surcharge) })),
		origins: origins.filter((o) => o.station)
	};
};

const optionalId = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.coerce.number().int().positive().nullable());
const addSchema = z.object({
	variantId: z.coerce.number().int().positive(),
	roastLevelId: optionalId,
	grindId: optionalId,
	packagingId: optionalId,
	quantity: z.coerce.number().int().min(1).max(MAX_QTY)
});

export const actions: Actions = {
	/** Into the cart, priced and checked like the cart page will: a refused choice never lands. */
	add: async ({ request, params, cookies, url }) => {
		const parsed = addSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { error: m.shop_add_invalid() });
		const p = await productBySlug(params.slug);
		if (!p) error(404, m.shop_not_found());

		const choice = parsed.data;
		const [priced] = (await priceCart([choice])).lines;
		if (!priced || priced.productId !== p.id) return fail(400, { error: m.shop_add_invalid() });

		const lines = addChoice(readChoices(cookies), priced.choice);
		if (priced.available !== null) {
			const inCart = lines.filter((l) => l.variantId === choice.variantId).reduce((sum, l) => sum + l.quantity, 0);
			if (inCart > priced.available) {
				return fail(409, { error: priced.available > 0 ? m.shop_only_left({ count: priced.available }) : m.shop_sold_out() });
			}
		}
		writeChoices(cookies, lines, url.protocol === 'https:');
		return { added: priced.quantity };
	}
};
