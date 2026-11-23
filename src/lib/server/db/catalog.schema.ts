/**
 * What the shop sells (questionnaire 2). A product is the origin and grade ("Washed Limu Gr 1");
 * its variants are the bag sizes, the only thing that changes the price (2.2). Roast, grind and
 * packaging are free choices drawn from per-product allowed lists (2.1).
 *
 * Option lists are tables, not enums: a gift box, a 2 kg bag or a "Medium-Dark" roast is a row.
 */
import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	check,
	datetime,
	decimal,
	index,
	int,
	mysqlTable,
	primaryKey,
	smallint,
	tinyint,
	uniqueIndex,
	varchar
} from 'drizzle-orm/mysql-core';
import {
	currency,
	extra,
	file,
	id,
	kgOrNull,
	lesserFields,
	localized,
	money,
	secureFields,
	status
} from './fields';
import { taxRate } from './system.schema';
import { lot, station } from './origins.schema';
import {
	BUNDLE_PRICINGS,
	FULFILMENT_MODES,
	PRODUCT_KINDS,
	PUBLISH_STATUSES
} from '../../constants';

/** Specialty, Certified, Commercial — and Merchandise, Bundles. */
export const productCategory = mysqlTable('product_category', {
	id: id(),
	slug: varchar('slug', { length: 64 }).notNull().unique(),
	name: localized('name').notNull(),
	description: localized('description'),
	sortOrder: smallint('sort_order').default(0).notNull(),
	...lesserFields
});

/** 250 g, 500 g, 1 kg. `grams` drives roasted-stock use and wholesale kg pricing. */
export const bagSize = mysqlTable('bag_size', {
	id: id(),
	code: varchar('code', { length: 16 }).notNull().unique(),
	name: localized('name').notNull(),
	grams: int('grams').notNull(),
	sortOrder: smallint('sort_order').default(0).notNull(),
	...lesserFields
});

/** Light, Medium, Dark (jebena). */
export const roastLevel = mysqlTable('roast_level', {
	id: id(),
	code: varchar('code', { length: 16 }).notNull().unique(),
	name: localized('name').notNull(),
	description: localized('description'),
	sortOrder: smallint('sort_order').default(0).notNull(),
	...lesserFields
});

/** Whole bean, Jebena, Espresso, Filter, French press. */
export const grind = mysqlTable('grind', {
	id: id(),
	code: varchar('code', { length: 16 }).notNull().unique(),
	name: localized('name').notNull(),
	sortOrder: smallint('sort_order').default(0).notNull(),
	...lesserFields
});

/** Standard bag at launch; gift box later, with its surcharge (2.1). */
export const packaging = mysqlTable('packaging', {
	id: id(),
	code: varchar('code', { length: 16 }).notNull().unique(),
	name: localized('name').notNull(),
	surcharge: money('surcharge'),
	sortOrder: smallint('sort_order').default(0).notNull(),
	...lesserFields
});

export const product = mysqlTable(
	'product',
	{
		id: id(),
		slug: varchar('slug', { length: 100 }).notNull().unique(),
		kind: status('kind', PRODUCT_KINDS).notNull().default('coffee'),
		categoryId: int('category_id').references(() => productCategory.id, {
			onDelete: 'restrict'
		}),
		name: localized('name').notNull(),
		summary: localized('summary'),
		description: localized('description'),
		/** "Where this comes from" when not derived from lots (2.4, 4.9). */
		originStory: localized('origin_story'),
		tastingNotes: localized('tasting_notes'),
		image: file('image'),
		/** From stock or roasted on the next roast day (2.3). */
		fulfilment: status('fulfilment', FULFILMENT_MODES).notNull().default('from_stock'),
		/** Working days from order to dispatch (2.4); the roast calendar adds the wait for a roast day. */
		dispatchDays: tinyint('dispatch_days').notNull().default(1),
		taxRateId: int('tax_rate_id').references(() => taxRate.id, { onDelete: 'restrict' }),
		/** Roasted-stock alert for this product (4.3); null → the `stock.roasted_low_kg` setting. */
		lowStockRoastedKg: kgOrNull('low_stock_roasted_kg'),
		/** Shown only to signed-in members. */
		isMemberOnly: boolean('is_member_only').default(false).notNull(),
		/** Offered through the subscription engine (7.5). */
		isSubscribable: boolean('is_subscribable').default(true).notNull(),
		/** Offered in the wholesale portal (11). */
		isWholesale: boolean('is_wholesale').default(false).notNull(),
		publishStatus: status('publish_status', PUBLISH_STATUSES).notNull().default('draft'),
		sortOrder: smallint('sort_order').default(0).notNull(),
		seoTitle: localized('seo_title'),
		seoDescription: localized('seo_description'),
		extra: extra(),
		...secureFields
	},
	(table) => [
		index('product_category_idx').on(table.categoryId),
		index('product_publish_idx').on(table.publishStatus, table.sortOrder)
	]
);

/**
 * A sellable size of a product and its price. Merchandise has no bag size; a T-shirt's sizes are
 * variants with a `name`. A pre-packed set ("Origins Discovery Set") is an ordinary product (2.7);
 * a multi-bag deal priced off the bags in it is a `bundle`.
 *
 * The price is the current one; past prices live on order lines and in the audit log.
 */
export const productVariant = mysqlTable(
	'product_variant',
	{
		id: id(),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'restrict' }),
		sku: varchar('sku', { length: 40 }).notNull().unique(),
		bagSizeId: int('bag_size_id').references(() => bagSize.id, { onDelete: 'restrict' }),
		name: localized('name'),
		price: money('price'),
		/** Struck-through "was" price. */
		compareAtPrice: money('compare_at_price'),
		currency: currency(),
		/** Packed-bag alert (4.3); null → the `stock.packed_low_units` setting. */
		lowStockUnits: int('low_stock_units'),
		barcode: varchar('barcode', { length: 40 }),
		sortOrder: smallint('sort_order').default(0).notNull(),
		...secureFields
	},
	(table) => [
		uniqueIndex('product_variant_size_uq').on(table.productId, table.bagSizeId),
		index('product_variant_product_idx').on(table.productId)
	]
);

/** Which roasts a product may be ordered in (a Gera lot only Light/Medium). */
export const productRoastLevel = mysqlTable(
	'product_roast_level',
	{
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		roastLevelId: int('roast_level_id')
			.notNull()
			.references(() => roastLevel.id, { onDelete: 'restrict' }),
		isDefault: boolean('is_default').default(false).notNull()
	},
	(table) => [primaryKey({ columns: [table.productId, table.roastLevelId] })]
);

export const productGrind = mysqlTable(
	'product_grind',
	{
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		grindId: int('grind_id')
			.notNull()
			.references(() => grind.id, { onDelete: 'restrict' }),
		isDefault: boolean('is_default').default(false).notNull()
	},
	(table) => [primaryKey({ columns: [table.productId, table.grindId] })]
);

export const productPackaging = mysqlTable(
	'product_packaging',
	{
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		packagingId: int('packaging_id')
			.notNull()
			.references(() => packaging.id, { onDelete: 'restrict' }),
		isDefault: boolean('is_default').default(false).notNull()
	},
	(table) => [primaryKey({ columns: [table.productId, table.packagingId] })]
);

/**
 * The lots and stations a product is made from, for the product page's "Where this comes from"
 * (4.9). The bag's own QR page uses the actual roast batch instead, which is exact.
 */
export const productOrigin = mysqlTable(
	'product_origin',
	{
		id: id(),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		stationId: int('station_id').references(() => station.id, { onDelete: 'restrict' }),
		lotId: int('lot_id').references(() => lot.id, { onDelete: 'restrict' }),
		/** A blend's typical share. */
		sharePercent: tinyint('share_percent'),
		sortOrder: smallint('sort_order').default(0).notNull()
	},
	(table) => [index('product_origin_product_idx').on(table.productId)]
);

export const productImage = mysqlTable(
	'product_image',
	{
		id: id(),
		productId: int('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		fileName: file('file_name').notNull(),
		alt: localized('alt'),
		sortOrder: smallint('sort_order').default(0).notNull()
	},
	(table) => [index('product_image_product_idx').on(table.productId, table.sortOrder)]
);

/**
 * A deal on several bags bought together — "2 kg: any two 1 kg bags, 5% off", "Limu + Gera 1 kg
 * pair". Not a product: each bag in it is still an ordinary order line for its own variant, so the
 * roast queue, packed stock and refunds work on bags as they always do, and the bundle's saving is
 * spread across those lines' `discountAmount`.
 *
 * `value` is read by `pricing`: a percentage, birr off, or the bundle's price. The bags' prices are
 * today's, so a price change moves the bundle with it (except a `fixed_price` one).
 */
export const bundle = mysqlTable(
	'bundle',
	{
		id: id(),
		slug: varchar('slug', { length: 100 }).notNull().unique(),
		name: localized('name').notNull(),
		summary: localized('summary'),
		image: file('image'),
		pricing: status('pricing', BUNDLE_PRICINGS).notNull().default('percent_off'),
		value: decimal('value', { precision: 14, scale: 2, mode: 'number' }).notNull().default(0),
		currency: currency(),
		/** Discount codes and the member discount also apply to it; off, they skip its lines. */
		stacksWithDiscounts: boolean('stacks_with_discounts').default(false).notNull(),
		/** A limited-time offer; both empty is always on. */
		startsAt: datetime('starts_at'),
		endsAt: datetime('ends_at'),
		/** Most of this bundle one order may hold; null is no limit. */
		maxPerOrder: smallint('max_per_order'),
		isMemberOnly: boolean('is_member_only').default(false).notNull(),
		publishStatus: status('publish_status', PUBLISH_STATUSES).notNull().default('draft'),
		sortOrder: smallint('sort_order').default(0).notNull(),
		extra: extra(),
		...secureFields
	},
	(table) => [index('bundle_publish_idx').on(table.publishStatus, table.sortOrder)]
);

/**
 * What a bundle holds. A row is either one exact size of one product (`variantId`) or a slot the
 * customer fills (`bagSizeId`): any published coffee in that size, from `categoryId` when given.
 * A slot of quantity 2 is two picks, which may be different coffees.
 */
export const bundleItem = mysqlTable(
	'bundle_item',
	{
		id: id(),
		bundleId: int('bundle_id')
			.notNull()
			.references(() => bundle.id, { onDelete: 'cascade' }),
		variantId: int('variant_id').references(() => productVariant.id, { onDelete: 'restrict' }),
		bagSizeId: int('bag_size_id').references(() => bagSize.id, { onDelete: 'restrict' }),
		categoryId: int('category_id').references(() => productCategory.id, { onDelete: 'restrict' }),
		quantity: smallint('quantity').notNull().default(1),
		sortOrder: smallint('sort_order').default(0).notNull(),
		...lesserFields
	},
	(table) => [
		index('bundle_item_bundle_idx').on(table.bundleId),
		index('bundle_item_variant_idx').on(table.variantId),
		check('bundle_item_qty_chk', sql`${table.quantity} > 0`),
		check('bundle_item_kind_chk', sql`(${table.variantId} is null) <> (${table.bagSizeId} is null)`)
	]
);

export const productRelations = relations(product, ({ one, many }) => ({
	category: one(productCategory, {
		fields: [product.categoryId],
		references: [productCategory.id]
	}),
	taxRate: one(taxRate, { fields: [product.taxRateId], references: [taxRate.id] }),
	variants: many(productVariant),
	roastLevels: many(productRoastLevel),
	grinds: many(productGrind),
	packagings: many(productPackaging),
	origins: many(productOrigin),
	images: many(productImage)
}));

export const productVariantRelations = relations(productVariant, ({ one }) => ({
	product: one(product, { fields: [productVariant.productId], references: [product.id] }),
	bagSize: one(bagSize, { fields: [productVariant.bagSizeId], references: [bagSize.id] })
}));

export const productRoastLevelRelations = relations(productRoastLevel, ({ one }) => ({
	product: one(product, { fields: [productRoastLevel.productId], references: [product.id] }),
	roastLevel: one(roastLevel, {
		fields: [productRoastLevel.roastLevelId],
		references: [roastLevel.id]
	})
}));

export const productGrindRelations = relations(productGrind, ({ one }) => ({
	product: one(product, { fields: [productGrind.productId], references: [product.id] }),
	grind: one(grind, { fields: [productGrind.grindId], references: [grind.id] })
}));

export const productPackagingRelations = relations(productPackaging, ({ one }) => ({
	product: one(product, { fields: [productPackaging.productId], references: [product.id] }),
	packaging: one(packaging, { fields: [productPackaging.packagingId], references: [packaging.id] })
}));

export const productOriginRelations = relations(productOrigin, ({ one }) => ({
	product: one(product, { fields: [productOrigin.productId], references: [product.id] }),
	station: one(station, { fields: [productOrigin.stationId], references: [station.id] }),
	lot: one(lot, { fields: [productOrigin.lotId], references: [lot.id] })
}));

export const productImageRelations = relations(productImage, ({ one }) => ({
	product: one(product, { fields: [productImage.productId], references: [product.id] })
}));

export const bundleRelations = relations(bundle, ({ many }) => ({
	items: many(bundleItem)
}));

export const bundleItemRelations = relations(bundleItem, ({ one }) => ({
	bundle: one(bundle, { fields: [bundleItem.bundleId], references: [bundle.id] }),
	variant: one(productVariant, { fields: [bundleItem.variantId], references: [productVariant.id] }),
	bagSize: one(bagSize, { fields: [bundleItem.bagSizeId], references: [bagSize.id] }),
	category: one(productCategory, {
		fields: [bundleItem.categoryId],
		references: [productCategory.id]
	})
}));
