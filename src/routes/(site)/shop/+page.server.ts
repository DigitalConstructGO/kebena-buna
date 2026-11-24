import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	bagSize,
	grind,
	lot,
	packaging,
	product,
	productCategory,
	productGrind,
	productOrigin,
	productPackaging,
	productRoastLevel,
	productVariant,
	roastLevel,
	station
} from '#lib/server/db/schema.ts';
import { fromPriceOf } from '#lib/server/catalog.ts';
import { bundlesOnSale } from '#lib/server/bundles.ts';
import { publicFileUrl } from '@nahu/admin-kit/files';
import { onSale, productImageUrl, tracksStock } from '#lib/server/cart.ts';
import type { PageServerLoad } from './$types';

/** Bags on hand across a product's variants, less those set aside. */
const availableOfProduct =
	sql<number>`(select coalesce(sum(ps.units - ps.reserved_units), 0) from packed_stock ps join product_variant pv on pv.id = ps.variant_id where pv.product_id = \`product\`.\`id\` and pv.deleted_at is null and pv.is_active = 1)`.mapWith(
		Number
	);
const availableOfVariant =
	sql<number>`(select coalesce(sum(ps.units - ps.reserved_units), 0) from packed_stock ps where ps.variant_id = ${productVariant.id})`.mapWith(
		Number
	);

/** A product's default of an option: the one marked so, else the first. */
const defaultOf = <T extends { productId: number; id: number; isDefault: boolean }>(
	rows: T[],
	productId: number
) => {
	const own = rows.filter((r) => r.productId === productId);
	return own.find((r) => r.isDefault) ?? own[0] ?? null;
};

export const load: PageServerLoad = async () => {
	const [rows, categories, bundles] = await Promise.all([
		db
			.select({
				id: product.id,
				slug: product.slug,
				kind: product.kind,
				name: product.name,
				summary: product.summary,
				tastingNotes: product.tastingNotes,
				image: product.image,
				fulfilment: product.fulfilment,
				categoryId: product.categoryId,
				from: fromPriceOf,
				available: availableOfProduct
			})
			.from(product)
			.where(onSale)
			.orderBy(asc(product.sortOrder), asc(product.id)),
		db
			.select({
				id: productCategory.id,
				slug: productCategory.slug,
				name: productCategory.name,
				description: productCategory.description
			})
			.from(productCategory)
			.where(and(eq(productCategory.status, true), isNull(productCategory.deletedAt)))
			.orderBy(asc(productCategory.sortOrder), asc(productCategory.id)),
		bundlesOnSale()
	]);

	const listed = rows.filter((p) => p.from !== null);
	const ids = listed.map((p) => p.id);

	/*
	 * What the pop-up needs to add a bag without the product page: every size with its price, and
	 * the default roast, grind and packaging, which is what the product page starts on too.
	 */
	const [variants, roasts, grinds, packs, origins] = ids.length
		? await Promise.all([
				db
					.select({
						id: productVariant.id,
						productId: productVariant.productId,
						name: productVariant.name,
						size: bagSize.name,
						price: productVariant.price,
						available: availableOfVariant
					})
					.from(productVariant)
					.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
					.where(
						and(
							inArray(productVariant.productId, ids),
							eq(productVariant.isActive, true),
							isNull(productVariant.deletedAt)
						)
					)
					.orderBy(asc(productVariant.sortOrder), asc(bagSize.grams), asc(productVariant.id)),
				db
					.select({
						productId: productRoastLevel.productId,
						id: roastLevel.id,
						name: roastLevel.name,
						isDefault: productRoastLevel.isDefault
					})
					.from(productRoastLevel)
					.innerJoin(roastLevel, eq(productRoastLevel.roastLevelId, roastLevel.id))
					.where(and(inArray(productRoastLevel.productId, ids), isNull(roastLevel.deletedAt)))
					.orderBy(asc(roastLevel.sortOrder)),
				db
					.select({
						productId: productGrind.productId,
						id: grind.id,
						isDefault: productGrind.isDefault
					})
					.from(productGrind)
					.innerJoin(grind, eq(productGrind.grindId, grind.id))
					.where(and(inArray(productGrind.productId, ids), isNull(grind.deletedAt)))
					.orderBy(asc(grind.sortOrder)),
				db
					.select({
						productId: productPackaging.productId,
						id: packaging.id,
						isDefault: productPackaging.isDefault
					})
					.from(productPackaging)
					.innerJoin(packaging, eq(productPackaging.packagingId, packaging.id))
					.where(and(inArray(productPackaging.productId, ids), isNull(packaging.deletedAt)))
					.orderBy(asc(packaging.sortOrder)),
				db
					.select({ productId: productOrigin.productId, station: station.name })
					.from(productOrigin)
					.leftJoin(lot, eq(productOrigin.lotId, lot.id))
					.leftJoin(
						station,
						eq(sql`coalesce(${productOrigin.stationId}, ${lot.stationId})`, station.id)
					)
					.where(inArray(productOrigin.productId, ids))
					.orderBy(asc(productOrigin.sortOrder))
			])
		: [[], [], [], [], []];

	const products = listed.map((p) => {
		const counted = tracksStock(p);
		const roast = defaultOf(roasts, p.id);
		return {
			slug: p.slug,
			kind: p.kind,
			name: p.name,
			summary: p.summary,
			tastingNotes: p.tastingNotes,
			image: productImageUrl(p),
			categoryId: p.categoryId,
			from: p.from as number,
			roastToOrder: p.fulfilment === 'roast_to_order',
			soldOut: counted && p.available <= 0,
			variants: variants
				.filter((v) => v.productId === p.id)
				.map((v) => ({
					id: v.id,
					name: v.name,
					size: v.size,
					price: Number(v.price),
					available: counted ? v.available : null
				})),
			roast: roast ? { id: roast.id, name: roast.name } : null,
			grindId: defaultOf(grinds, p.id)?.id ?? null,
			packagingId: defaultOf(packs, p.id)?.id ?? null,
			origins: origins.filter((o) => o.productId === p.id && o.station).map((o) => o.station!)
		};
	});
	return {
		products,
		bundles: bundles.map(({ bundle: b, totals: t }) => ({
			slug: b.slug,
			name: b.name,
			summary: b.summary,
			image: b.image ? publicFileUrl(b.image) : '/hero/bag-front.jpg',
			from: t.priceMin,
			saving: t.savingMin,
			bags: t.bags
		})),
		// Only categories with something in them, in their own order.
		categories: categories.filter((c) => products.some((p) => p.categoryId === c.id))
	};
};
