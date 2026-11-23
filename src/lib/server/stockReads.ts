/**
 * What is on hand, for the stock overview and the pickers of its dialogs: balances with the names
 * of what they hold, unit costs from the ledger, and the low-stock levels (per lot, product and
 * variant, falling back to the `stock.*` settings).
 */
import { and, desc, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	bagSize,
	greenStock,
	location,
	lot,
	packedStock,
	packingRun,
	product,
	productVariant,
	roastBatch,
	roastLevel,
	roastedStock,
	setting,
	station,
	stockMovement
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';

/** A setting's value, or the fallback when the row is missing or the wrong type. */
export async function readSetting<T>(key: string, fallback: T): Promise<T> {
	const [row] = await db.select({ value: setting.value }).from(setting).where(eq(setting.key, key));
	const value = row?.value as T | undefined;
	return value === undefined || value === null || typeof value !== typeof fallback
		? fallback
		: value;
}

export async function stockLevels() {
	const [greenLow, roastedLow, packedLow, lossRange] = await Promise.all([
		readSetting('stock.green_low_kg', 60),
		readSetting('stock.roasted_low_kg', 10),
		readSetting('stock.packed_low_units', 10),
		readSetting('roast.loss_range', { min: 12, max: 20 })
	]);
	return { greenLow, roastedLow, packedLow, lossRange };
}

/** The unit cost each roast batch and packing run carries on its output movement. */
const outputCost = (
	reason: 'roast_output' | 'pack_output',
	column: 'roast_batch_id' | 'packing_run_id',
	id: unknown
) =>
	sql<number>`(select coalesce(max(m.unit_cost), 0) from ${stockMovement} m where m.reason = ${reason} and m.${sql.raw(column)} = ${id})`.mapWith(
		Number
	);

export async function greenBalances() {
	return db
		.select({
			lotId: greenStock.lotId,
			code: lot.code,
			stationId: lot.stationId,
			station: station.code,
			locationId: greenStock.locationId,
			location: enOf(location.name),
			kg: greenStock.kg,
			costPerKg: greenStock.costPerKg,
			lowStockKg: lot.lowStockKg,
			updatedAt: greenStock.updatedAt
		})
		.from(greenStock)
		.innerJoin(lot, eq(greenStock.lotId, lot.id))
		.innerJoin(station, eq(lot.stationId, station.id))
		.innerJoin(location, eq(greenStock.locationId, location.id))
		.where(gt(greenStock.kg, 0))
		.orderBy(lot.code);
}

export async function roastedBalances() {
	return db
		.select({
			roastBatchId: roastedStock.roastBatchId,
			code: roastBatch.code,
			roastedAt: roastBatch.roastedAt,
			productId: roastBatch.productId,
			product: enOf(product.name),
			lowStockRoastedKg: product.lowStockRoastedKg,
			roastLevel: enOf(roastLevel.name),
			locationId: roastedStock.locationId,
			location: enOf(location.name),
			kg: roastedStock.kg,
			reservedKg: roastedStock.reservedKg,
			costPerKg: outputCost('roast_output', 'roast_batch_id', roastedStock.roastBatchId)
		})
		.from(roastedStock)
		.innerJoin(roastBatch, eq(roastedStock.roastBatchId, roastBatch.id))
		.innerJoin(roastLevel, eq(roastBatch.roastLevelId, roastLevel.id))
		.innerJoin(location, eq(roastedStock.locationId, location.id))
		.leftJoin(product, eq(roastBatch.productId, product.id))
		.where(gt(roastedStock.kg, 0))
		.orderBy(desc(roastBatch.roastedAt));
}

export async function packedBalances() {
	return db
		.select({
			packingRunId: packedStock.packingRunId,
			code: packingRun.code,
			bestBefore: packingRun.bestBefore,
			variantId: packedStock.variantId,
			sku: productVariant.sku,
			productId: productVariant.productId,
			product: enOf(product.name),
			size: sql<string>`coalesce(${enOf(bagSize.name)}, ${enOf(productVariant.name)})`,
			lowStockUnits: productVariant.lowStockUnits,
			roastLevel: enOf(roastLevel.name),
			locationId: packedStock.locationId,
			location: enOf(location.name),
			units: packedStock.units,
			reservedUnits: packedStock.reservedUnits,
			costPerBag: outputCost('pack_output', 'packing_run_id', packedStock.packingRunId)
		})
		.from(packedStock)
		.innerJoin(packingRun, eq(packedStock.packingRunId, packingRun.id))
		.innerJoin(productVariant, eq(packedStock.variantId, productVariant.id))
		.innerJoin(product, eq(productVariant.productId, product.id))
		.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
		.innerJoin(roastLevel, eq(packedStock.roastLevelId, roastLevel.id))
		.innerJoin(location, eq(packedStock.locationId, location.id))
		.where(gt(packedStock.units, 0))
		.orderBy(enOf(product.name), productVariant.sortOrder);
}

/** An item under its low-stock level, as the overview lists it. */
export type LowStock = {
	kind: string;
	entity: string;
	id: number;
	name: string;
	have: number;
	level: number;
	unit: string;
};

/**
 * What is under its low-stock level, judged on the whole holding across locations (4.3). The
 * balances are left-joined onto what is stocked, so an item with none left anywhere, the most
 * urgent, is listed too. Stocked means a live, active lot; a live, active coffee kept in stock
 * (not roasted to order, not archived) for roasted kg; and that coffee's bag sizes for bags.
 */
export async function lowStock(
	levels: Awaited<ReturnType<typeof stockLevels>>
): Promise<LowStock[]> {
	const stockedCoffee = and(
		isNull(product.deletedAt),
		eq(product.isActive, true),
		eq(product.kind, 'coffee'),
		eq(product.fulfilment, 'from_stock'),
		ne(product.publishStatus, 'archived')
	);
	const [lots, products, variants] = await Promise.all([
		db
			.select({
				id: lot.id,
				name: lot.code,
				level: lot.lowStockKg,
				have: sql<number>`coalesce(sum(${greenStock.kg}), 0)`.mapWith(Number)
			})
			.from(lot)
			.leftJoin(greenStock, eq(greenStock.lotId, lot.id))
			.where(and(isNull(lot.deletedAt), eq(lot.isActive, true)))
			.groupBy(lot.id)
			.orderBy(lot.code),
		db
			.select({
				id: product.id,
				name: enOf(product.name),
				level: product.lowStockRoastedKg,
				have: sql<number>`coalesce(sum(${roastedStock.kg} - ${roastedStock.reservedKg}), 0)`.mapWith(
					Number
				)
			})
			.from(product)
			.leftJoin(roastBatch, eq(roastBatch.productId, product.id))
			.leftJoin(roastedStock, eq(roastedStock.roastBatchId, roastBatch.id))
			.where(stockedCoffee)
			.groupBy(product.id)
			.orderBy(enOf(product.name)),
		db
			.select({
				id: productVariant.id,
				name: sql<string>`concat(${enOf(product.name)}, ' — ', coalesce(${enOf(bagSize.name)}, ${enOf(productVariant.name)}, ${productVariant.sku}))`,
				level: productVariant.lowStockUnits,
				have: sql<number>`coalesce(sum(${packedStock.units} - ${packedStock.reservedUnits}), 0)`.mapWith(
					Number
				)
			})
			.from(productVariant)
			.innerJoin(product, eq(productVariant.productId, product.id))
			.innerJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
			.leftJoin(packedStock, eq(packedStock.variantId, productVariant.id))
			.where(
				and(isNull(productVariant.deletedAt), eq(productVariant.isActive, true), stockedCoffee)
			)
			.groupBy(productVariant.id)
			.orderBy(enOf(product.name), productVariant.sortOrder)
	]);

	const low: LowStock[] = [];
	for (const l of lots) {
		const level = Number(l.level ?? levels.greenLow);
		if (l.have < level)
			low.push({
				kind: 'Green lot',
				entity: 'lot',
				id: l.id,
				name: l.name,
				have: l.have,
				level,
				unit: 'kg'
			});
	}
	for (const p of products) {
		const level = Number(p.level ?? levels.roastedLow);
		if (p.have < level)
			low.push({
				kind: 'Roasted',
				entity: 'product',
				id: p.id,
				name: p.name,
				have: p.have,
				level,
				unit: 'kg'
			});
	}
	for (const v of variants) {
		const level = Number(v.level ?? levels.packedLow);
		if (v.have < level)
			low.push({
				kind: 'Packed',
				entity: 'variant',
				id: v.id,
				name: v.name,
				have: v.have,
				level,
				unit: 'bags'
			});
	}
	return low;
}

/** What a dialog may pick, per stage: lots, batches and runs that have stock somewhere. */
export async function stockItemOptions() {
	const [lots, batches, runs] = await Promise.all([
		db
			.selectDistinct({ value: lot.id, name: lot.code })
			.from(lot)
			.where(
				and(
					isNull(lot.deletedAt),
					inArray(lot.id, db.select({ id: greenStock.lotId }).from(greenStock))
				)
			)
			.orderBy(lot.code),
		db
			.select({
				value: roastBatch.id,
				name: sql<string>`concat(${roastBatch.code}, ' · ', ${enOf(roastLevel.name)})`
			})
			.from(roastBatch)
			.innerJoin(roastLevel, eq(roastBatch.roastLevelId, roastLevel.id))
			.where(
				inArray(roastBatch.id, db.select({ id: roastedStock.roastBatchId }).from(roastedStock))
			)
			.orderBy(desc(roastBatch.roastedAt)),
		db
			.select({
				value: packingRun.id,
				name: sql<string>`concat(${packingRun.code}, ' · ', ${productVariant.sku})`
			})
			.from(packingRun)
			.innerJoin(productVariant, eq(packingRun.variantId, productVariant.id))
			.where(inArray(packingRun.id, db.select({ id: packedStock.packingRunId }).from(packedStock)))
			.orderBy(desc(packingRun.packedAt))
	]);
	return { green: lots, roasted: batches, packed: runs };
}
