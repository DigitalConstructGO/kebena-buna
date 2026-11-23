/** Reads and writes the product pages share: stock sums, and a product's allowed options. */
import { and, eq, gt, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { db } from '#lib/server/db/index.ts';
import {
	bundle,
	bundleItem,
	membershipPlan,
	orderLine,
	packedStock,
	setting,
	product,
	productGrind,
	productPackaging,
	productRoastLevel,
	productVariant,
	subscription
} from '#lib/server/db/schema.ts';

/** Live variants of a product. */
export const variantCountOf = sql<number>`(select count(*) from product_variant pv where pv.product_id = \`product\`.\`id\` and pv.deleted_at is null)`.mapWith(
	Number
);

/** The cheapest live variant's price — "from ETB 450". */
export const fromPriceOf = sql<number | null>`(select min(pv.price) from product_variant pv where pv.product_id = \`product\`.\`id\` and pv.deleted_at is null and pv.is_active = 1)`.mapWith(
	(v) => (v === null ? null : Number(v))
);

/** Packed bags on hand across every variant and location. */
export const packedUnitsOfProduct = sql<number>`(select coalesce(sum(ps.units), 0) from packed_stock ps join product_variant pv on pv.id = ps.variant_id where pv.product_id = \`product\`.\`id\`)`.mapWith(
	Number
);

/** Packed bags of one variant, across locations. */
export const packedUnitsOfVariant = sql<number>`(select coalesce(sum(ps.units), 0) from packed_stock ps where ps.variant_id = \`product_variant\`.\`id\`)`.mapWith(
	Number
);

/** Replaces one of a product's allowed-option lists, marking the default. */
async function setLinks(
	tx: Writer,
	table: typeof productRoastLevel | typeof productGrind | typeof productPackaging,
	column: 'roastLevelId' | 'grindId' | 'packagingId',
	productId: number,
	ids: number[],
	defaultId: number | null | undefined
) {
	await tx.delete(table).where(eq(table.productId, productId));
	if (!ids.length) return;
	const def = defaultId && ids.includes(defaultId) ? defaultId : ids[0];
	await tx
		.insert(table)
		.values(ids.map((id) => ({ productId, [column]: id, isDefault: id === def }) as never));
}

export async function setProductOptions(
	tx: Writer,
	productId: number,
	o: {
		roastLevelIds: number[];
		defaultRoastLevelId?: number | null;
		grindIds: number[];
		defaultGrindId?: number | null;
		packagingIds: number[];
		defaultPackagingId?: number | null;
	}
) {
	await setLinks(tx, productRoastLevel, 'roastLevelId', productId, o.roastLevelIds, o.defaultRoastLevelId);
	await setLinks(tx, productGrind, 'grindId', productId, o.grindIds, o.defaultGrindId);
	await setLinks(tx, productPackaging, 'packagingId', productId, o.packagingIds, o.defaultPackagingId);
}

/** The product the variant belongs to, or undefined when either is deleted. */
export async function variantOfProduct(tx: Writer, variantId: number, productId: number) {
	const [row] = await tx
		.select({ id: productVariant.id })
		.from(productVariant)
		.where(and(eq(productVariant.id, variantId), eq(productVariant.productId, productId)));
	return row;
}

/** The packed-bag low-stock level for variants without their own (`stock.packed_low_units`). */
export async function packedLowDefault(): Promise<number> {
	const [row] = await db
		.select({ value: setting.value })
		.from(setting)
		.where(eq(setting.key, 'stock.packed_low_units'));
	const n = Number(row?.value);
	return Number.isFinite(n) && n > 0 ? n : 10;
}

/** A subscription still to be sent: anything not completed or cancelled. */
const LIVE_SUBSCRIPTIONS = ['pending_payment', 'active', 'paused'] as const;

/**
 * Why these sizes may not be deleted, or null when they may: a deleted size must not be what an
 * order was for, what a live subscription, a membership plan or a bundle sends, or what bags on a
 * shelf are.
 * `sold` is told apart, since a sold size or product is switched off or archived instead.
 */
export async function variantsInUse(
	tx: Writer,
	variantIds: number[]
): Promise<{ sold: boolean; text: string } | null> {
	if (!variantIds.length) return null;
	const [line] = await tx
		.select({ id: orderLine.id })
		.from(orderLine)
		.where(inArray(orderLine.variantId, variantIds))
		.limit(1);
	if (line) return { sold: true, text: 'It has been sold: switch it off instead.' };
	const [sub] = await tx
		.select({ number: subscription.number })
		.from(subscription)
		.where(
			and(
				inArray(subscription.variantId, variantIds),
				inArray(subscription.status, LIVE_SUBSCRIPTIONS),
				isNull(subscription.deletedAt)
			)
		)
		.limit(1);
	if (sub) return { sold: false, text: `Subscription ${sub.number} still sends it: change or end that first.` };
	const [plan] = await tx
		.select({ id: membershipPlan.id })
		.from(membershipPlan)
		.where(and(inArray(membershipPlan.monthlyCoffeeVariantId, variantIds), isNull(membershipPlan.deletedAt)))
		.limit(1);
	if (plan) return { sold: false, text: "A membership plan's monthly coffee is this size: choose another there first." };
	const [inBundle] = await tx
		.select({ slug: bundle.slug })
		.from(bundleItem)
		.innerJoin(bundle, eq(bundleItem.bundleId, bundle.id))
		.where(and(inArray(bundleItem.variantId, variantIds), isNull(bundleItem.deletedAt), isNull(bundle.deletedAt)))
		.limit(1);
	if (inBundle) return { sold: false, text: `The ${inBundle.slug} bundle holds it: take it out of the bundle first.` };
	const [held] = await tx
		.select({ id: packedStock.id })
		.from(packedStock)
		.where(and(inArray(packedStock.variantId, variantIds), gt(packedStock.units, 0)))
		.limit(1);
	if (held) return { sold: false, text: 'There are bags of it on hand: sell, use or count them out first.' };
	return null;
}

/**
 * Soft-deletes the sizes `where` matches and frees what they held for a new size: the SKU gets
 * `~id` on the end and the bag size is let go, since both are unique across deleted rows too.
 */
export async function deleteVariants(tx: Writer, where: SQL | undefined, userId?: string) {
	await tx
		.update(productVariant)
		.set({
			...deletionStamp(userId),
			sku: sql`concat(left(${productVariant.sku}, 39 - length(${productVariant.id})), '~', ${productVariant.id})`,
			bagSizeId: null
		})
		.where(and(where, isNull(productVariant.deletedAt)));
}
