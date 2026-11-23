import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { product, productCategory } from '#lib/server/db/schema.ts';
import { fromPriceOf } from '#lib/server/catalog.ts';
import { onSale, productImageUrl, tracksStock } from '#lib/server/cart.ts';
import type { PageServerLoad } from './$types';

/** Bags on hand across a product's variants, less those set aside. */
const availableOfProduct = sql<number>`(select coalesce(sum(ps.units - ps.reserved_units), 0) from packed_stock ps join product_variant pv on pv.id = ps.variant_id where pv.product_id = \`product\`.\`id\` and pv.deleted_at is null and pv.is_active = 1)`.mapWith(
	Number
);

export const load: PageServerLoad = async () => {
	const [rows, categories] = await Promise.all([
		db
			.select({
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
			.select({ id: productCategory.id, slug: productCategory.slug, name: productCategory.name, description: productCategory.description })
			.from(productCategory)
			.where(and(eq(productCategory.status, true), isNull(productCategory.deletedAt)))
			.orderBy(asc(productCategory.sortOrder), asc(productCategory.id))
	]);

	const products = rows
		.filter((p) => p.from !== null)
		.map((p) => ({
			slug: p.slug,
			kind: p.kind,
			name: p.name,
			summary: p.summary,
			tastingNotes: p.tastingNotes,
			image: productImageUrl(p),
			categoryId: p.categoryId,
			from: p.from as number,
			roastToOrder: p.fulfilment === 'roast_to_order',
			soldOut: tracksStock(p) && p.available <= 0
		}));
	return {
		products,
		// Only categories with something in them, in their own order.
		categories: categories.filter((c) => products.some((p) => p.categoryId === c.id))
	};
};
