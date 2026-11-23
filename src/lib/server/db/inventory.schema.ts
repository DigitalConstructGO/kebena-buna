/**
 * Stock in three stages (questionnaire 4.1):
 *
 *     GREEN LOT (kg) ──roast batch──► ROASTED (kg per batch) ──packing run──► PACKED BAGS (units)
 *
 * `stock_movement` is the ledger and the only thing that changes stock: every receipt, roast,
 * packing, sale, café use, transfer and count is one signed row. The three `*_stock` tables are
 * balances kept in step in the same transaction — fast to read, and the rows a sale locks
 * (`SELECT … FOR UPDATE`) so two checkouts cannot sell the last bag twice. A balance can always be
 * rebuilt from the ledger.
 *
 * Traceability falls out of the keys: a packed bag knows its packing run, the run its roast
 * batches, each batch its lots, each lot its station and region (4.9).
 */
import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	datetime,
	decimal,
	index,
	int,
	mysqlTable,
	smallint,
	text,
	uniqueIndex,
	varchar
} from 'drizzle-orm/mysql-core';
import { bigId, id, kg, lesserFields, money, secureFields, status, userRef } from './fields';
import { location } from './system.schema';
import { lot } from './origins.schema';
import { grind, product, productVariant, roastLevel } from './catalog.schema';
import { STOCK_REASONS, STOCK_STAGES } from '../../constants';

/** For when there is more than one roaster (4.7). */
export const roastMachine = mysqlTable('roast_machine', {
	id: id(),
	name: varchar('name', { length: 64 }).notNull().unique(),
	locationId: int('location_id').references(() => location.id, { onDelete: 'restrict' }),
	capacityKg: kg('capacity_kg'),
	...lesserFields
});

/**
 * One roast (4.7): `RB-261120-02`. Green kg in comes out of the lots in `roast_batch_input`;
 * roasted kg out goes into `roasted_stock`. Weight loss is computed by the database, so it is never
 * out of step; outside 12–20% (a setting) the batch is flagged.
 */
export const roastBatch = mysqlTable(
	'roast_batch',
	{
		id: id(),
		code: varchar('code', { length: 20 }).notNull().unique(),
		roastedAt: datetime('roasted_at').notNull(),
		roasterId: userRef('roaster_id'),
		machineId: int('machine_id').references(() => roastMachine.id, { onDelete: 'restrict' }),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		/** What the batch was roasted for (a blend recipe, a single-origin product). */
		productId: int('product_id').references(() => product.id, { onDelete: 'restrict' }),
		roastLevelId: int('roast_level_id')
			.notNull()
			.references(() => roastLevel.id, { onDelete: 'restrict' }),
		greenKgIn: kg('green_kg_in'),
		roastedKgOut: kg('roasted_kg_out'),
		weightLossPct: decimal('weight_loss_pct', {
			precision: 5,
			scale: 2,
			mode: 'number'
		}).generatedAlwaysAs(
			sql`round((green_kg_in - roasted_kg_out) / nullif(green_kg_in, 0) * 100, 2)`,
			{ mode: 'stored' }
		),
		durationMin: decimal('duration_min', { precision: 5, scale: 2, mode: 'number' }),
		dropTempC: decimal('drop_temp_c', { precision: 5, scale: 1, mode: 'number' }),
		cuppingScore: decimal('cupping_score', { precision: 5, scale: 2, mode: 'number' }),
		notes: text('notes'),
		/** A roast-day batch for roast-to-order and subscription lines. */
		isToOrder: boolean('is_to_order').default(false).notNull(),
		...secureFields
	},
	(table) => [
		index('roast_batch_roasted_idx').on(table.roastedAt),
		index('roast_batch_product_idx').on(table.productId),
		check('roast_batch_weights_chk', sql`${table.roastedKgOut} <= ${table.greenKgIn}`)
	]
);

/** The lots a batch used and how much of each: blends and splits (4.6). */
export const roastBatchInput = mysqlTable(
	'roast_batch_input',
	{
		id: id(),
		roastBatchId: int('roast_batch_id')
			.notNull()
			.references(() => roastBatch.id, { onDelete: 'cascade' }),
		lotId: int('lot_id')
			.notNull()
			.references(() => lot.id, { onDelete: 'restrict' }),
		greenKg: kg('green_kg')
	},
	(table) => [
		uniqueIndex('roast_batch_input_uq').on(table.roastBatchId, table.lotId),
		index('roast_batch_input_lot_idx').on(table.lotId),
		check('roast_batch_input_kg_chk', sql`${table.greenKg} > 0`)
	]
);

/**
 * Roasted coffee turned into bags (4.9). One label — and one public QR page, at `/trace/{code}`
 * — per run, not per bag. Grind is chosen here, so ground and whole bean share roasted stock
 * (4.2).
 */
export const packingRun = mysqlTable(
	'packing_run',
	{
		id: id(),
		code: varchar('code', { length: 20 }).notNull().unique(),
		packedAt: datetime('packed_at').notNull(),
		packedBy: userRef('packed_by'),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		variantId: int('variant_id')
			.notNull()
			.references(() => productVariant.id, { onDelete: 'restrict' }),
		roastLevelId: int('roast_level_id')
			.notNull()
			.references(() => roastLevel.id, { onDelete: 'restrict' }),
		grindId: int('grind_id').references(() => grind.id, { onDelete: 'restrict' }),
		units: int('units').notNull(),
		bestBefore: date('best_before', { mode: 'string' }),
		labelPrintedAt: datetime('label_printed_at'),
		/** Packed for one order (roast to order) rather than for the shelf. */
		isToOrder: boolean('is_to_order').default(false).notNull(),
		...secureFields
	},
	(table) => [
		index('packing_run_variant_idx').on(table.variantId, table.roastLevelId),
		index('packing_run_packed_idx').on(table.packedAt)
	]
);

/** The roast batches a packing run drew from, and how many kg of each. */
export const packingRunSource = mysqlTable(
	'packing_run_source',
	{
		id: id(),
		packingRunId: int('packing_run_id')
			.notNull()
			.references(() => packingRun.id, { onDelete: 'cascade' }),
		roastBatchId: int('roast_batch_id')
			.notNull()
			.references(() => roastBatch.id, { onDelete: 'restrict' }),
		roastedKg: kg('roasted_kg')
	},
	(table) => [
		uniqueIndex('packing_run_source_uq').on(table.packingRunId, table.roastBatchId),
		index('packing_run_source_batch_idx').on(table.roastBatchId)
	]
);

/**
 * The stock ledger. Append-only: a mistake is corrected by a new `adjustment`, never an edit.
 * `quantity` is kg for green and roasted, bags for packed; negative takes stock out.
 * `unitCost` (per kg or per bag) makes the monthly stock-value report (5.2) a sum.
 */
export const stockMovement = mysqlTable(
	'stock_movement',
	{
		id: bigId(),
		stage: status('stage', STOCK_STAGES).notNull(),
		reason: status('reason', STOCK_REASONS).notNull(),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		lotId: int('lot_id').references(() => lot.id, { onDelete: 'restrict' }),
		roastBatchId: int('roast_batch_id').references(() => roastBatch.id, {
			onDelete: 'restrict'
		}),
		packingRunId: int('packing_run_id').references(() => packingRun.id, {
			onDelete: 'restrict'
		}),
		variantId: int('variant_id').references(() => productVariant.id, { onDelete: 'restrict' }),
		roastLevelId: int('roast_level_id').references(() => roastLevel.id, {
			onDelete: 'restrict'
		}),
		quantity: decimal('quantity', { precision: 12, scale: 3, mode: 'number' }).notNull(),
		unitCost: money('unit_cost'),
		/** The document that caused it: `order_line:812`, `roast_batch:44`, `stock_count:3`. */
		refType: varchar('ref_type', { length: 32 }),
		refId: varchar('ref_id', { length: 64 }),
		/** Pairs the two halves of a transfer. */
		transferKey: varchar('transfer_key', { length: 36 }),
		note: varchar('note', { length: 255 }),
		occurredAt: datetime('occurred_at').notNull(),
		createdBy: userRef('created_by'),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		index('stock_movement_stage_idx').on(table.stage, table.locationId, table.occurredAt),
		index('stock_movement_lot_idx').on(table.lotId),
		index('stock_movement_batch_idx').on(table.roastBatchId),
		index('stock_movement_run_idx').on(table.packingRunId),
		index('stock_movement_ref_idx').on(table.refType, table.refId)
	]
);

/** Green kg per lot per location. */
export const greenStock = mysqlTable(
	'green_stock',
	{
		id: id(),
		lotId: int('lot_id')
			.notNull()
			.references(() => lot.id, { onDelete: 'restrict' }),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		kg: kg('kg'),
		costPerKg: money('cost_per_kg'),
		updatedAt: datetime('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [uniqueIndex('green_stock_uq').on(table.lotId, table.locationId)]
);

/** Roasted kg per batch per location — the café's internal use comes out of here (4.2). */
export const roastedStock = mysqlTable(
	'roasted_stock',
	{
		id: id(),
		roastBatchId: int('roast_batch_id')
			.notNull()
			.references(() => roastBatch.id, { onDelete: 'restrict' }),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		kg: kg('kg'),
		/** Held for roast-to-order lines, not free for packing onto the shelf. */
		reservedKg: kg('reserved_kg'),
		updatedAt: datetime('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [uniqueIndex('roasted_stock_uq').on(table.roastBatchId, table.locationId)]
);

/**
 * Bags per packing run per location. Variant and roast are copied from the run so "how many
 * 500 g Medium Limu at the shop" is one indexed sum, and selling oldest-first is an `ORDER BY`.
 */
export const packedStock = mysqlTable(
	'packed_stock',
	{
		id: id(),
		packingRunId: int('packing_run_id')
			.notNull()
			.references(() => packingRun.id, { onDelete: 'restrict' }),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		variantId: int('variant_id')
			.notNull()
			.references(() => productVariant.id, { onDelete: 'restrict' }),
		roastLevelId: int('roast_level_id')
			.notNull()
			.references(() => roastLevel.id, { onDelete: 'restrict' }),
		units: int('units').notNull().default(0),
		/** In paid orders not yet packed off the shelf. */
		reservedUnits: int('reserved_units').notNull().default(0),
		updatedAt: datetime('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		uniqueIndex('packed_stock_uq').on(table.packingRunId, table.locationId),
		index('packed_stock_lookup_idx').on(table.variantId, table.roastLevelId, table.locationId),
		check('packed_stock_units_chk', sql`${table.units} >= 0 and ${table.reservedUnits} >= 0`)
	]
);

/** An opening or periodic count (4.4): its lines become `opening_count` / `adjustment` movements. */
export const stockCount = mysqlTable('stock_count', {
	id: id(),
	locationId: int('location_id')
		.notNull()
		.references(() => location.id, { onDelete: 'restrict' }),
	stage: status('stage', STOCK_STAGES).notNull(),
	countedAt: datetime('counted_at').notNull(),
	isOpening: boolean('is_opening').default(false).notNull(),
	postedAt: datetime('posted_at'),
	note: varchar('note', { length: 255 }),
	lineCount: smallint('line_count').default(0).notNull(),
	...secureFields
});

export const roastBatchRelations = relations(roastBatch, ({ one, many }) => ({
	machine: one(roastMachine, { fields: [roastBatch.machineId], references: [roastMachine.id] }),
	location: one(location, { fields: [roastBatch.locationId], references: [location.id] }),
	product: one(product, { fields: [roastBatch.productId], references: [product.id] }),
	roastLevel: one(roastLevel, { fields: [roastBatch.roastLevelId], references: [roastLevel.id] }),
	inputs: many(roastBatchInput),
	packedFrom: many(packingRunSource)
}));

export const roastBatchInputRelations = relations(roastBatchInput, ({ one }) => ({
	roastBatch: one(roastBatch, {
		fields: [roastBatchInput.roastBatchId],
		references: [roastBatch.id]
	}),
	lot: one(lot, { fields: [roastBatchInput.lotId], references: [lot.id] })
}));

export const packingRunRelations = relations(packingRun, ({ one, many }) => ({
	variant: one(productVariant, { fields: [packingRun.variantId], references: [productVariant.id] }),
	roastLevel: one(roastLevel, { fields: [packingRun.roastLevelId], references: [roastLevel.id] }),
	grind: one(grind, { fields: [packingRun.grindId], references: [grind.id] }),
	sources: many(packingRunSource)
}));

export const packingRunSourceRelations = relations(packingRunSource, ({ one }) => ({
	packingRun: one(packingRun, {
		fields: [packingRunSource.packingRunId],
		references: [packingRun.id]
	}),
	roastBatch: one(roastBatch, {
		fields: [packingRunSource.roastBatchId],
		references: [roastBatch.id]
	})
}));
