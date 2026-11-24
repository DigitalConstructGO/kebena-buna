/**
 * The stock ledger's writes (questionnaire 4). Every change to stock is one `stock_movement` row
 * plus the matching balance row (`green_stock`, `roasted_stock`, `packed_stock`) updated in the same
 * transaction. Balance rows are locked `FOR UPDATE` before they are read, so two writers never
 * spend the same kilogram, and nothing may go below zero: that is a `WriteRefused`, which the form
 * shows under its field.
 *
 * Callers pass the transaction (`db.transaction((tx) => recordRoast(tx, …))`).
 */
import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import type { Writer } from '@nahu/admin-kit/server/db';
import { localDate } from '@nahu/admin-kit/time';
import {
	bagSize,
	greenStock,
	location,
	lot,
	order,
	orderLine,
	packedStock,
	packingRun,
	packingRunSource,
	product,
	productVariant,
	roastBatch,
	roastBatchInput,
	roastLevel,
	roastedStock,
	stockCount,
	stockMovement
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { nextNumber } from '#lib/server/records.ts';
import type { StockReason, StockStage } from '#lib/constants.ts';

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

type Movement = {
	stage: StockStage;
	reason: StockReason;
	locationId: number;
	quantity: number;
	occurredAt: Date;
	userId?: string | null;
	lotId?: number | null;
	roastBatchId?: number | null;
	packingRunId?: number | null;
	variantId?: number | null;
	roastLevelId?: number | null;
	unitCost?: number;
	refType?: string | null;
	refId?: string | number | null;
	transferKey?: string | null;
	note?: string | null;
};

async function writeMovement(tx: Writer, m: Movement) {
	await tx.insert(stockMovement).values({
		stage: m.stage,
		reason: m.reason,
		locationId: m.locationId,
		lotId: m.lotId ?? null,
		roastBatchId: m.roastBatchId ?? null,
		packingRunId: m.packingRunId ?? null,
		variantId: m.variantId ?? null,
		roastLevelId: m.roastLevelId ?? null,
		quantity: round3(m.quantity),
		unitCost: round2(m.unitCost ?? 0),
		refType: m.refType ?? null,
		refId: m.refId === null || m.refId === undefined ? null : String(m.refId),
		transferKey: m.transferKey ?? null,
		note: m.note ?? null,
		occurredAt: m.occurredAt,
		createdBy: m.userId ?? null
	});
}

// ── Balances ────────────────────────────────────────────────────────────────────────────────

/** Green kg of a lot at a location, changed by `delta`. A receipt carries its cost per kg. */
async function changeGreen(
	tx: Writer,
	lotId: number,
	locationId: number,
	delta: number,
	field: string,
	costPerKg?: number
) {
	const [row] = await tx
		.select()
		.from(greenStock)
		.where(and(eq(greenStock.lotId, lotId), eq(greenStock.locationId, locationId)))
		.for('update');
	const have = Number(row?.kg ?? 0);
	const next = round3(have + delta);
	if (next < -0.0005) {
		const [l] = await tx.select({ code: lot.code }).from(lot).where(eq(lot.id, lotId));
		throw new WriteRefused(field, `Only ${have} kg of ${l?.code ?? 'this lot'} is here.`);
	}
	// A receipt moves the average cost; anything else leaves it.
	const cost =
		costPerKg !== undefined && delta > 0
			? round2((have * Number(row?.costPerKg ?? 0) + delta * costPerKg) / (have + delta || 1))
			: Number(row?.costPerKg ?? costPerKg ?? 0);
	if (row) {
		await tx
			.update(greenStock)
			.set({ kg: next, costPerKg: cost, updatedAt: new Date() })
			.where(eq(greenStock.id, row.id));
	} else {
		await tx.insert(greenStock).values({ lotId, locationId, kg: next, costPerKg: cost });
	}
	return cost;
}

/** The cost per kg green of a lot at a location, as the ledger has it. */
async function greenCost(tx: Writer, lotId: number, locationId: number) {
	const [row] = await tx
		.select({ cost: greenStock.costPerKg })
		.from(greenStock)
		.where(and(eq(greenStock.lotId, lotId), eq(greenStock.locationId, locationId)));
	return Number(row?.cost ?? 0);
}

async function changeRoasted(
	tx: Writer,
	roastBatchId: number,
	locationId: number,
	delta: number,
	field: string
) {
	const [row] = await tx
		.select()
		.from(roastedStock)
		.where(
			and(eq(roastedStock.roastBatchId, roastBatchId), eq(roastedStock.locationId, locationId))
		)
		.for('update');
	const have = Number(row?.kg ?? 0);
	const free = have - Number(row?.reservedKg ?? 0);
	const next = round3(have + delta);
	if (delta < 0 && free + delta < -0.0005) {
		const [b] = await tx
			.select({ code: roastBatch.code })
			.from(roastBatch)
			.where(eq(roastBatch.id, roastBatchId));
		throw new WriteRefused(
			field,
			`Only ${round3(free)} kg of ${b?.code ?? 'this batch'} is free here (${round3(have)} kg, some held for orders).`
		);
	}
	if (row) {
		await tx
			.update(roastedStock)
			.set({ kg: next, updatedAt: new Date() })
			.where(eq(roastedStock.id, row.id));
	} else {
		await tx.insert(roastedStock).values({ roastBatchId, locationId, kg: next });
	}
}

/** The cost per kg of a roast batch: what its green cost, over what came out. */
export async function roastedCost(tx: Writer, roastBatchId: number) {
	const [row] = await tx
		.select({ cost: stockMovement.unitCost })
		.from(stockMovement)
		.where(
			and(eq(stockMovement.roastBatchId, roastBatchId), eq(stockMovement.reason, 'roast_output'))
		)
		.limit(1);
	return Number(row?.cost ?? 0);
}

/** The cost per bag of a packing run. */
export async function packedCost(tx: Writer, packingRunId: number) {
	const [row] = await tx
		.select({ cost: stockMovement.unitCost })
		.from(stockMovement)
		.where(
			and(eq(stockMovement.packingRunId, packingRunId), eq(stockMovement.reason, 'pack_output'))
		)
		.limit(1);
	return Number(row?.cost ?? 0);
}

async function changePacked(
	tx: Writer,
	packingRunId: number,
	locationId: number,
	delta: number,
	field: string
) {
	const [run] = await tx
		.select({
			code: packingRun.code,
			variantId: packingRun.variantId,
			roastLevelId: packingRun.roastLevelId
		})
		.from(packingRun)
		.where(eq(packingRun.id, packingRunId));
	if (!run)
		throw new WriteRefused(field, 'That packing run no longer exists: reload and choose again.');
	const [row] = await tx
		.select()
		.from(packedStock)
		.where(and(eq(packedStock.packingRunId, packingRunId), eq(packedStock.locationId, locationId)))
		.for('update');
	const have = row?.units ?? 0;
	const free = have - (row?.reservedUnits ?? 0);
	if (delta < 0 && free + delta < 0) {
		throw new WriteRefused(field, `Only ${free} bag(s) of ${run.code} are free here.`);
	}
	if (row) {
		await tx
			.update(packedStock)
			.set({ units: have + delta, updatedAt: new Date() })
			.where(eq(packedStock.id, row.id));
	} else {
		await tx.insert(packedStock).values({
			packingRunId,
			locationId,
			variantId: run.variantId,
			roastLevelId: run.roastLevelId,
			units: delta
		});
	}
	return run;
}

// ── Documents ───────────────────────────────────────────────────────────────────────────────

/** `261120` for 20 Nov 2026, in Addis Ababa time. */
const dayKey = (at: Date) => localDate(at).slice(2).replaceAll('-', '');

export async function receiveGreen(
	tx: Writer,
	r: {
		lotId: number;
		locationId: number;
		kg: number;
		costPerKg: number;
		occurredAt: Date;
		note?: string | null;
		userId?: string | null;
		opening?: boolean;
	}
) {
	if (r.kg <= 0) throw new WriteRefused('kg', 'Enter the kilograms received.');
	await changeGreen(tx, r.lotId, r.locationId, r.kg, 'kg', r.costPerKg);
	await writeMovement(tx, {
		stage: 'green',
		reason: r.opening ? 'opening_count' : 'receipt',
		locationId: r.locationId,
		lotId: r.lotId,
		quantity: r.kg,
		unitCost: r.costPerKg,
		occurredAt: r.occurredAt,
		note: r.note,
		userId: r.userId
	});
}

export type RoastInput = { lotId: number; greenKg: number };

/**
 * One roast (4.7): green out of each lot at the roastery, roasted in. The batch's cost per kg is the
 * green it used over what came out, carried on its `roast_output` movement.
 */
export async function recordRoast(
	tx: Writer,
	r: {
		roastedAt: Date;
		locationId: number;
		roastLevelId: number;
		roastedKgOut: number;
		inputs: RoastInput[];
		roasterId?: string | null;
		machineId?: number | null;
		productId?: number | null;
		durationMin?: number | null;
		dropTempC?: number | null;
		cuppingScore?: number | null;
		notes?: string | null;
		isToOrder?: boolean;
		userId?: string | null;
	}
) {
	const inputs = r.inputs.filter((i) => i.lotId && i.greenKg > 0);
	if (!inputs.length) throw new WriteRefused('inputs', 'Add the green lots this batch used.');
	if (new Set(inputs.map((i) => i.lotId)).size !== inputs.length)
		throw new WriteRefused('inputs', 'Each lot once: add its kilograms together.');
	const greenIn = round3(inputs.reduce((sum, i) => sum + i.greenKg, 0));
	if (r.roastedKgOut <= 0) throw new WriteRefused('roastedKgOut', 'Enter the roasted kilograms.');
	if (r.roastedKgOut > greenIn)
		throw new WriteRefused('roastedKgOut', `More came out than went in (${greenIn} kg green).`);

	const key = dayKey(r.roastedAt);
	const code = `RB-${key}-${String(await nextNumber(tx, `roast_batch:${key}`)).padStart(2, '0')}`;
	const [res] = await tx.insert(roastBatch).values({
		code,
		roastedAt: r.roastedAt,
		roasterId: r.roasterId ?? null,
		machineId: r.machineId ?? null,
		locationId: r.locationId,
		productId: r.productId ?? null,
		roastLevelId: r.roastLevelId,
		greenKgIn: greenIn,
		roastedKgOut: round3(r.roastedKgOut),
		durationMin: r.durationMin ?? null,
		dropTempC: r.dropTempC ?? null,
		cuppingScore: r.cuppingScore ?? null,
		notes: r.notes ?? null,
		isToOrder: r.isToOrder ?? false,
		createdBy: r.userId ?? null
	});
	const id = res.insertId;

	let greenValue = 0;
	for (const input of inputs) {
		const cost = await greenCost(tx, input.lotId, r.locationId);
		await changeGreen(tx, input.lotId, r.locationId, -input.greenKg, 'inputs');
		greenValue += cost * input.greenKg;
		await tx
			.insert(roastBatchInput)
			.values({ roastBatchId: id, lotId: input.lotId, greenKg: input.greenKg });
		await writeMovement(tx, {
			stage: 'green',
			reason: 'roast_input',
			locationId: r.locationId,
			lotId: input.lotId,
			roastBatchId: id,
			quantity: -input.greenKg,
			unitCost: cost,
			refType: 'roast_batch',
			refId: id,
			occurredAt: r.roastedAt,
			userId: r.userId
		});
	}
	await changeRoasted(tx, id, r.locationId, r.roastedKgOut, 'roastedKgOut');
	await writeMovement(tx, {
		stage: 'roasted',
		reason: 'roast_output',
		locationId: r.locationId,
		roastBatchId: id,
		roastLevelId: r.roastLevelId,
		quantity: r.roastedKgOut,
		unitCost: greenValue / r.roastedKgOut,
		refType: 'roast_batch',
		refId: id,
		occurredAt: r.roastedAt,
		userId: r.userId
	});
	// A roast-day batch takes the queue's lines it was roasted for.
	const linked = r.isToOrder ? await linkRoastToOrders(tx, id) : 0;
	return { id, code, linked };
}

export type PackSource = { roastBatchId: number; roastedKg: number };

/** What packing may draw over the coffee in the bags: spill, not a slipped digit. */
const PACK_SPILL = 0.02;

/**
 * Roasted coffee into bags (4.9): roasted kg out of each batch at `sourceLocationId`, bags in at
 * `locationId`. The sources must cover the coffee in the bags, by no more than `PACK_SPILL` over,
 * and be of the roast the bags are labelled with.
 */
export async function recordPacking(
	tx: Writer,
	r: {
		packedAt: Date;
		locationId: number;
		sourceLocationId: number;
		variantId: number;
		roastLevelId: number;
		grindId?: number | null;
		units: number;
		bestBefore?: string | null;
		isToOrder?: boolean;
		sources: PackSource[];
		userId?: string | null;
		packedBy?: string | null;
	}
) {
	const sources = r.sources.filter((s) => s.roastBatchId && s.roastedKg > 0);
	if (r.units <= 0) throw new WriteRefused('units', 'Enter the bags packed.');
	if (!sources.length)
		throw new WriteRefused('sources', 'Add the roast batches the bags came from.');
	if (new Set(sources.map((s) => s.roastBatchId)).size !== sources.length)
		throw new WriteRefused('sources', 'Each batch once: add its kilograms together.');
	const [variant] = await tx
		.select({ grams: bagSize.grams, sku: productVariant.sku })
		.from(productVariant)
		.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
		.where(eq(productVariant.id, r.variantId));
	if (!variant?.grams) throw new WriteRefused('variantId', 'Only a coffee bag size can be packed.');
	const needed = round3((r.units * variant.grams) / 1000);
	const given = round3(sources.reduce((sum, s) => sum + s.roastedKg, 0));
	if (given + 0.0005 < needed)
		throw new WriteRefused(
			'sources',
			`${r.units} × ${variant.grams} g needs ${needed} kg; the batches give ${given} kg.`
		);
	const most = round3(needed * (1 + PACK_SPILL));
	if (given > most + 0.0005)
		throw new WriteRefused(
			'sources',
			`${r.units} × ${variant.grams} g needs ${needed} kg; the batches give ${given} kg, more than the ${most} kg packing may use. Check the kilograms, and record anything spoiled as waste.`
		);

	// The bags carry the roast of the coffee in them, so every batch must be that roast.
	const batches = await tx
		.select({
			id: roastBatch.id,
			code: roastBatch.code,
			roastLevelId: roastBatch.roastLevelId,
			roast: enOf(roastLevel.name)
		})
		.from(roastBatch)
		.innerJoin(roastLevel, eq(roastBatch.roastLevelId, roastLevel.id))
		.where(
			inArray(
				roastBatch.id,
				sources.map((s) => s.roastBatchId)
			)
		);
	const missing = sources.find((s) => !batches.some((b) => b.id === s.roastBatchId));
	if (missing)
		throw new WriteRefused('sources', 'A roast batch no longer exists: reload and choose again.');
	const other = batches.find((b) => b.roastLevelId !== r.roastLevelId);
	if (other)
		throw new WriteRefused(
			'roastLevelId',
			`${other.code} was roasted ${other.roast}: pack each roast as its own run.`
		);

	const key = dayKey(r.packedAt);
	const code = `PR-${key}-${String(await nextNumber(tx, `packing_run:${key}`)).padStart(2, '0')}`;
	const [res] = await tx.insert(packingRun).values({
		code,
		packedAt: r.packedAt,
		packedBy: r.packedBy ?? r.userId ?? null,
		locationId: r.locationId,
		variantId: r.variantId,
		roastLevelId: r.roastLevelId,
		grindId: r.grindId ?? null,
		units: r.units,
		bestBefore: r.bestBefore ?? null,
		isToOrder: r.isToOrder ?? false,
		createdBy: r.userId ?? null
	});
	const id = res.insertId;

	let value = 0;
	for (const source of sources) {
		const cost = await roastedCost(tx, source.roastBatchId);
		await changeRoasted(tx, source.roastBatchId, r.sourceLocationId, -source.roastedKg, 'sources');
		value += cost * source.roastedKg;
		await tx
			.insert(packingRunSource)
			.values({ packingRunId: id, roastBatchId: source.roastBatchId, roastedKg: source.roastedKg });
		await writeMovement(tx, {
			stage: 'roasted',
			reason: 'pack_input',
			locationId: r.sourceLocationId,
			roastBatchId: source.roastBatchId,
			packingRunId: id,
			roastLevelId: r.roastLevelId,
			quantity: -source.roastedKg,
			unitCost: cost,
			refType: 'packing_run',
			refId: id,
			occurredAt: r.packedAt,
			userId: r.userId
		});
	}
	await changePacked(tx, id, r.locationId, r.units, 'units');
	await writeMovement(tx, {
		stage: 'packed',
		reason: 'pack_output',
		locationId: r.locationId,
		packingRunId: id,
		variantId: r.variantId,
		roastLevelId: r.roastLevelId,
		quantity: r.units,
		unitCost: value / r.units,
		refType: 'packing_run',
		refId: id,
		occurredAt: r.packedAt,
		userId: r.userId
	});
	const filled = r.isToOrder
		? await fillToOrderLines(tx, {
				packingRunId: id,
				batchIds: sources.map((s) => s.roastBatchId),
				variantId: r.variantId,
				roastLevelId: r.roastLevelId,
				grindId: r.grindId ?? null,
				locationId: r.locationId,
				units: r.units,
				packedAt: r.packedAt,
				userId: r.userId
			})
		: 0;
	return { id, code, filled };
}

/** What a stock line names: a lot (green), a batch (roasted) or a packing run (packed). */
export type StockItem = { stage: StockStage; itemId: number };

const itemColumns = (stage: StockStage, itemId: number) =>
	stage === 'green'
		? { lotId: itemId }
		: stage === 'roasted'
			? { roastBatchId: itemId }
			: { packingRunId: itemId };

/**
 * Changes one item's balance and writes its movement. Returns the unit cost used.
 *
 * Green coming in is valued at `costPerKg` when given (a transfer brings the sending location's
 * cost), else at what the lot already carries here.
 */
async function change(
	tx: Writer,
	item: StockItem,
	locationId: number,
	quantity: number,
	movement: Omit<Movement, 'stage' | 'locationId' | 'quantity'>,
	field = 'quantity',
	costPerKg?: number
) {
	let unitCost: number;
	let extra: Partial<Movement> = {};
	if (item.stage === 'green') {
		const [l] = await tx.select({ id: lot.id }).from(lot).where(eq(lot.id, item.itemId));
		if (!l) throw new WriteRefused(field, 'That lot no longer exists: reload and choose again.');
		if (costPerKg !== undefined && quantity > 0) {
			unitCost = costPerKg;
			await changeGreen(tx, item.itemId, locationId, quantity, field, costPerKg);
		} else {
			// Anything else moves at the cost the balance row holds, read under its lock.
			unitCost = await changeGreen(tx, item.itemId, locationId, quantity, field);
		}
	} else if (item.stage === 'roasted') {
		const [b] = await tx
			.select({ roastLevelId: roastBatch.roastLevelId })
			.from(roastBatch)
			.where(eq(roastBatch.id, item.itemId));
		if (!b)
			throw new WriteRefused(field, 'That roast batch no longer exists: reload and choose again.');
		unitCost = await roastedCost(tx, item.itemId);
		await changeRoasted(tx, item.itemId, locationId, quantity, field);
		extra = { roastLevelId: b.roastLevelId };
	} else {
		if (!Number.isInteger(quantity)) throw new WriteRefused(field, 'Bags are whole numbers.');
		unitCost = await packedCost(tx, item.itemId);
		const run = await changePacked(tx, item.itemId, locationId, quantity, field);
		extra = { variantId: run.variantId, roastLevelId: run.roastLevelId };
	}
	await writeMovement(tx, {
		...movement,
		...itemColumns(item.stage, item.itemId),
		...extra,
		stage: item.stage,
		locationId,
		quantity,
		unitCost
	});
	return unitCost;
}

/**
 * A correction, waste, the café's own use (4.2), or sold goods coming back on a refund: one signed
 * movement. `refType`/`refId` name the document behind it (a returned `order_line`).
 */
export async function adjustStock(
	tx: Writer,
	r: StockItem & {
		reason: 'adjustment' | 'waste' | 'internal_use' | 'sale_return';
		locationId: number;
		quantity: number;
		occurredAt: Date;
		note?: string | null;
		userId?: string | null;
		refType?: string | null;
		refId?: string | number | null;
	}
) {
	if (!r.quantity) throw new WriteRefused('quantity', 'Enter how much.');
	// Waste and use only take out, a return only puts back; the form asks for the amount, so the
	// sign is the reason's.
	const quantity =
		r.reason === 'adjustment'
			? r.quantity
			: r.reason === 'sale_return'
				? Math.abs(r.quantity)
				: -Math.abs(r.quantity);
	await change(tx, r, r.locationId, quantity, {
		reason: r.reason,
		occurredAt: r.occurredAt,
		note: r.note,
		userId: r.userId,
		refType: r.refType,
		refId: r.refId
	});
}

/** An order's coffee bags sold from the shelf: the lines whose stock is counted as packed bags. */
async function shelfLines(
	tx: Writer,
	orderId: number,
	fulfilments: ('from_stock' | 'roast_to_order')[] = ['from_stock']
) {
	return tx
		.select({
			id: orderLine.id,
			variantId: orderLine.variantId,
			roastLevelId: orderLine.roastLevelId,
			grindId: orderLine.grindId,
			quantity: orderLine.quantity,
			refundedQuantity: orderLine.refundedQuantity
		})
		.from(orderLine)
		.innerJoin(productVariant, eq(orderLine.variantId, productVariant.id))
		.innerJoin(product, eq(productVariant.productId, product.id))
		.where(
			and(
				eq(orderLine.orderId, orderId),
				eq(orderLine.itemType, 'product'),
				inArray(orderLine.fulfilment, fulfilments),
				eq(product.kind, 'coffee')
			)
		);
}

/** Bags each line has off the shelf now, per packing run and location: sold less returned. */
async function bagsOut(tx: Writer, lineIds: number[]) {
	if (!lineIds.length) return [];
	const rows = await tx
		.select({
			lineId: stockMovement.refId,
			packingRunId: stockMovement.packingRunId,
			locationId: stockMovement.locationId,
			// Sales are negative, returns positive: what is out is minus their sum.
			units: sql<number>`-sum(${stockMovement.quantity})`.mapWith(Number)
		})
		.from(stockMovement)
		.where(
			and(
				eq(stockMovement.stage, 'packed'),
				inArray(stockMovement.reason, ['sale', 'sale_return']),
				eq(stockMovement.refType, 'order_line'),
				inArray(stockMovement.refId, lineIds.map(String))
			)
		)
		.groupBy(stockMovement.refId, stockMovement.packingRunId, stockMovement.locationId);
	return rows.map((r) => ({ ...r, lineId: Number(r.lineId), units: Math.round(r.units) }));
}

/**
 * Takes a paid order's coffee off the shelf: a `sale` movement per packing run, oldest bags first,
 * of the line's size and roast (its grind preferred). It looks where the order is fulfilled from
 * first — its own location, then its pickup point — then the locations that ship online, then
 * anywhere. A line already taken is left alone, so a second call does nothing. Checkout checks the
 * shelves, but two unpaid orders can both pass for the last bags: payment is never refused for it,
 * the line takes what is there and the shortfall is returned (the order page shows it).
 */
export async function takeOrderStock(tx: Writer, orderId: number, userId?: string | null) {
	const lines = (await shelfLines(tx, orderId)).filter((l) => l.variantId !== null);
	if (!lines.length) return 0;
	const taken = new Set(
		(
			await bagsOut(
				tx,
				lines.map((l) => l.id)
			)
		).map((r) => r.lineId)
	);
	const [o] = await tx
		.select({ locationId: order.locationId, pickupLocationId: order.pickupLocationId })
		.from(order)
		.where(eq(order.id, orderId));
	const rank = sql<number>`case
		when ${packedStock.locationId} = ${o?.locationId ?? 0} then 0
		when ${packedStock.locationId} = ${o?.pickupLocationId ?? 0} then 1
		when ${location.fulfilsOnline} then 2
		else 3 end`;
	const now = new Date();
	let short = 0;
	for (const line of lines) {
		if (taken.has(line.id)) continue;
		const shelves = await tx
			.select({
				packingRunId: packedStock.packingRunId,
				locationId: packedStock.locationId,
				free: sql<number>`${packedStock.units} - ${packedStock.reservedUnits}`.mapWith(Number)
			})
			.from(packedStock)
			.innerJoin(packingRun, eq(packedStock.packingRunId, packingRun.id))
			.innerJoin(location, eq(packedStock.locationId, location.id))
			.where(
				and(
					eq(packedStock.variantId, line.variantId!),
					line.roastLevelId ? eq(packedStock.roastLevelId, line.roastLevelId) : undefined,
					gt(sql`${packedStock.units} - ${packedStock.reservedUnits}`, 0)
				)
			)
			.orderBy(
				rank,
				sql`case when ${packingRun.grindId} <=> ${line.grindId} then 0 else 1 end`,
				packingRun.packedAt,
				packingRun.id
			)
			.for('update');
		let need = line.quantity;
		for (const s of shelves) {
			if (need <= 0) break;
			const units = Math.min(s.free, need);
			await change(tx, { stage: 'packed', itemId: s.packingRunId }, s.locationId, -units, {
				reason: 'sale',
				occurredAt: now,
				userId,
				refType: 'order_line',
				refId: line.id
			});
			need -= units;
		}
		short += need;
	}
	return short;
}

/**
 * Puts a cancelled order's bags back on the shelf they came off, as `sale_return` movements. Bags
 * already refunded are not returned again: a refund that restocked put them back itself, and one
 * that did not means they are gone.
 */
export async function returnOrderStock(
	tx: Writer,
	orderId: number,
	note: string,
	userId?: string | null
) {
	// Bags packed for a roast-to-order line came off the shelf the same way, and go back too.
	const lines = await shelfLines(tx, orderId, ['from_stock', 'roast_to_order']);
	const out = await bagsOut(
		tx,
		lines.map((l) => l.id)
	);
	const now = new Date();
	for (const line of lines) {
		let left = line.quantity - line.refundedQuantity;
		for (const r of out.filter((x) => x.lineId === line.id && x.units > 0)) {
			if (left <= 0 || !r.packingRunId) break;
			const units = Math.min(r.units, left);
			await adjustStock(tx, {
				stage: 'packed',
				itemId: r.packingRunId,
				reason: 'sale_return',
				locationId: r.locationId,
				quantity: units,
				occurredAt: now,
				note,
				userId,
				refType: 'order_line',
				refId: line.id
			});
			left -= units;
		}
	}
}

/** Bags each of an order's shelf lines is still waiting for: ordered, less taken off the shelf. */
export async function shelfShortfall(tx: Writer, orderId: number) {
	const lines = await shelfLines(tx, orderId);
	const out = await bagsOut(
		tx,
		lines.map((l) => l.id)
	);
	const short = new Map<number, number>();
	for (const line of lines) {
		const have = out.filter((r) => r.lineId === line.id).reduce((sum, r) => sum + r.units, 0);
		// Refunded bags count as dealt with, whether or not they went back.
		const missing = line.quantity - line.refundedQuantity - have;
		if (missing > 0) short.set(line.id, missing);
	}
	return short;
}

/** A move between locations: `transfer_out` and `transfer_in`, paired by one `transferKey`. */
export async function transferStock(
	tx: Writer,
	r: StockItem & {
		fromLocationId: number;
		toLocationId: number;
		quantity: number;
		occurredAt: Date;
		note?: string | null;
		userId?: string | null;
	}
) {
	if (r.fromLocationId === r.toLocationId)
		throw new WriteRefused('toLocationId', 'Choose a different location to send it to.');
	if (r.quantity <= 0) throw new WriteRefused('quantity', 'Enter how much to send.');
	const transferKey = randomUUID();
	const base = { occurredAt: r.occurredAt, note: r.note, userId: r.userId, transferKey };
	// Green arrives at the cost it left with; the receiving location may have none of the lot yet.
	const cost = await change(tx, r, r.fromLocationId, -r.quantity, {
		...base,
		reason: 'transfer_out'
	});
	await change(
		tx,
		r,
		r.toLocationId,
		r.quantity,
		{ ...base, reason: 'transfer_in' },
		'quantity',
		cost
	);
}

/** What the books say is at a location for a stage, item by item. */
export async function balancesAt(tx: Writer, stage: StockStage, locationId: number) {
	if (stage === 'green') {
		const rows = await tx
			.select({ itemId: greenStock.lotId, quantity: greenStock.kg })
			.from(greenStock)
			.where(eq(greenStock.locationId, locationId));
		return new Map(rows.map((r) => [r.itemId, Number(r.quantity)]));
	}
	if (stage === 'roasted') {
		const rows = await tx
			.select({ itemId: roastedStock.roastBatchId, quantity: roastedStock.kg })
			.from(roastedStock)
			.where(eq(roastedStock.locationId, locationId));
		return new Map(rows.map((r) => [r.itemId, Number(r.quantity)]));
	}
	const rows = await tx
		.select({ itemId: packedStock.packingRunId, quantity: packedStock.units })
		.from(packedStock)
		.where(eq(packedStock.locationId, locationId));
	return new Map(rows.map((r) => [r.itemId, Number(r.quantity)]));
}

/**
 * One item's balance at a location, locked `FOR UPDATE` until the transaction ends, so nothing
 * moves it between this read and the write that follows.
 */
async function lockedBalance(tx: Writer, item: StockItem, locationId: number) {
	if (item.stage === 'green') {
		const [row] = await tx
			.select({ quantity: greenStock.kg })
			.from(greenStock)
			.where(and(eq(greenStock.lotId, item.itemId), eq(greenStock.locationId, locationId)))
			.for('update');
		return Number(row?.quantity ?? 0);
	}
	if (item.stage === 'roasted') {
		const [row] = await tx
			.select({ quantity: roastedStock.kg })
			.from(roastedStock)
			.where(
				and(eq(roastedStock.roastBatchId, item.itemId), eq(roastedStock.locationId, locationId))
			)
			.for('update');
		return Number(row?.quantity ?? 0);
	}
	const [row] = await tx
		.select({ quantity: packedStock.units })
		.from(packedStock)
		.where(and(eq(packedStock.packingRunId, item.itemId), eq(packedStock.locationId, locationId)))
		.for('update');
	return Number(row?.quantity ?? 0);
}

/**
 * What the books held of an item at a location at `at`: the balance, read under lock, less whatever
 * moved after `at`.
 */
async function booksAt(tx: Writer, item: StockItem, locationId: number, at: Date) {
	const now = await lockedBalance(tx, item, locationId);
	const column =
		item.stage === 'green'
			? stockMovement.lotId
			: item.stage === 'roasted'
				? stockMovement.roastBatchId
				: stockMovement.packingRunId;
	const [later] = await tx
		.select({ quantity: sql<number>`coalesce(sum(${stockMovement.quantity}), 0)`.mapWith(Number) })
		.from(stockMovement)
		.where(
			and(
				eq(stockMovement.stage, item.stage),
				eq(stockMovement.locationId, locationId),
				eq(column, item.itemId),
				gt(stockMovement.occurredAt, at)
			)
		);
	return round3(now - Number(later?.quantity ?? 0));
}

/**
 * Posts a count (4.4): each counted line that differs from the books becomes an `opening_count`
 * (a first count) or `adjustment` movement tied to the count. Lines that agree write nothing.
 *
 * Each line is compared with the books as they stood when it was counted, worked out under the
 * balance's lock: a sale made after the count, even one posted while the count is being written,
 * stays sold rather than being overwritten by the count.
 */
export async function postCount(
	tx: Writer,
	r: {
		locationId: number;
		stage: StockStage;
		countedAt: Date;
		isOpening: boolean;
		note?: string | null;
		lines: { itemId: number; counted: number }[];
		userId?: string | null;
	}
) {
	const lines = r.lines.filter((l) => l.itemId && l.counted !== null && l.counted !== undefined);
	if (!lines.length) throw new WriteRefused('lines', 'Count at least one line.');
	if (lines.some((l) => l.counted < 0))
		throw new WriteRefused('lines', 'A count cannot be negative.');
	const [res] = await tx.insert(stockCount).values({
		locationId: r.locationId,
		stage: r.stage,
		countedAt: r.countedAt,
		isOpening: r.isOpening,
		note: r.note ?? null,
		lineCount: lines.length,
		postedAt: new Date(),
		createdBy: r.userId ?? null
	});
	const id = res.insertId;
	let changed = 0;
	for (const line of lines) {
		const item = { stage: r.stage, itemId: line.itemId };
		const diff = round3(line.counted - (await booksAt(tx, item, r.locationId, r.countedAt)));
		if (Math.abs(diff) < 0.0005) continue;
		await change(
			tx,
			item,
			r.locationId,
			diff,
			{
				reason: r.isOpening ? 'opening_count' : 'adjustment',
				occurredAt: r.countedAt,
				refType: 'stock_count',
				refId: id,
				note: r.note,
				userId: r.userId
			},
			'lines'
		);
		changed++;
	}
	return { id, changed };
}

/** Batches with free roasted stock at a location, newest first — the packing form's sources. */
export async function roastedAvailable(tx: Writer, locationId?: number) {
	const rows = await tx
		.select({
			roastBatchId: roastedStock.roastBatchId,
			locationId: roastedStock.locationId,
			code: roastBatch.code,
			roastLevelId: roastBatch.roastLevelId,
			free: sql<number>`${roastedStock.kg} - ${roastedStock.reservedKg}`.mapWith(Number)
		})
		.from(roastedStock)
		.innerJoin(roastBatch, eq(roastedStock.roastBatchId, roastBatch.id))
		.where(
			and(
				sql`${roastedStock.kg} - ${roastedStock.reservedKg} > 0`,
				locationId ? eq(roastedStock.locationId, locationId) : undefined
			)
		)
		.orderBy(sql`${roastBatch.roastedAt} desc`);
	return rows;
}

/* ── Roast to order ─────────────────────────────────────────────────────────────────────────── */

/** Roast-to-order lines still waiting, in orders being made: paid, or roasting. */
const waitingLine = () =>
	and(
		eq(orderLine.itemType, 'product'),
		eq(orderLine.fulfilment, 'roast_to_order'),
		inArray(order.status, ['paid', 'roasting']),
		isNull(order.deletedAt)
	);

/** The coffee a line's bags hold, in kg. */
const lineKg = sql<number>`(${orderLine.quantity} - ${orderLine.refundedQuantity}) * coalesce(${bagSize.grams}, 0) / 1000`;

/**
 * A roast-to-order batch takes the roast queue's lines it can fill (7.5): of its product and roast,
 * due to be roasted on its day or before, oldest first, while its roasted kilograms last. Each line
 * taken carries the batch (`roast_batch_id`) and leaves the queue. Returns the lines taken.
 */
export async function linkRoastToOrders(tx: Writer, roastBatchId: number) {
	const [b] = await tx
		.select({
			productId: roastBatch.productId,
			roastLevelId: roastBatch.roastLevelId,
			roastedKgOut: roastBatch.roastedKgOut,
			roastedAt: roastBatch.roastedAt,
			isToOrder: roastBatch.isToOrder,
			deletedAt: roastBatch.deletedAt
		})
		.from(roastBatch)
		.where(eq(roastBatch.id, roastBatchId))
		.for('update');
	if (!b?.isToOrder || !b.productId || b.deletedAt) return 0;
	const [promised] = await tx
		.select({ kg: sql<number>`coalesce(sum(${lineKg}), 0)`.mapWith(Number) })
		.from(orderLine)
		.innerJoin(productVariant, eq(orderLine.variantId, productVariant.id))
		.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
		.where(eq(orderLine.roastBatchId, roastBatchId));
	let room = Number(b.roastedKgOut) - (promised?.kg ?? 0);
	const lines = await tx
		.select({ id: orderLine.id, kg: lineKg.mapWith(Number) })
		.from(orderLine)
		.innerJoin(order, eq(orderLine.orderId, order.id))
		.innerJoin(productVariant, eq(orderLine.variantId, productVariant.id))
		.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
		.where(
			and(
				waitingLine(),
				isNull(orderLine.roastBatchId),
				eq(productVariant.productId, b.productId),
				or(eq(orderLine.roastLevelId, b.roastLevelId), isNull(orderLine.roastLevelId)),
				or(isNull(orderLine.roastOn), lte(orderLine.roastOn, localDate(b.roastedAt)))
			)
		)
		.orderBy(asc(orderLine.roastOn), asc(order.id), asc(orderLine.id))
		.for('update');
	const taken: number[] = [];
	for (const line of lines) {
		if (line.kg <= 0 || line.kg > room + 0.0005) continue;
		taken.push(line.id);
		room -= line.kg;
	}
	if (taken.length)
		await tx.update(orderLine).set({ roastBatchId }).where(inArray(orderLine.id, taken));
	return taken.length;
}

/**
 * A to-order packing run hands its bags straight to the lines its batches were roasted for, as
 * `sale` movements like a bag off the shelf: of the run's size and roast, its grind first, oldest
 * first. Bags left over stay on the shelf. Returns the lines filled.
 */
async function fillToOrderLines(
	tx: Writer,
	r: {
		packingRunId: number;
		batchIds: number[];
		variantId: number;
		roastLevelId: number;
		grindId: number | null;
		locationId: number;
		units: number;
		packedAt: Date;
		userId?: string | null;
	}
) {
	const lines = await tx
		.select({
			id: orderLine.id,
			quantity: orderLine.quantity,
			refundedQuantity: orderLine.refundedQuantity
		})
		.from(orderLine)
		.innerJoin(order, eq(orderLine.orderId, order.id))
		.where(
			and(
				waitingLine(),
				inArray(orderLine.roastBatchId, r.batchIds),
				eq(orderLine.variantId, r.variantId),
				or(eq(orderLine.roastLevelId, r.roastLevelId), isNull(orderLine.roastLevelId))
			)
		)
		.orderBy(
			sql`case when ${orderLine.grindId} <=> ${r.grindId} then 0 else 1 end`,
			asc(orderLine.roastOn),
			asc(order.id),
			asc(orderLine.id)
		)
		.for('update');
	const out = await bagsOut(
		tx,
		lines.map((l) => l.id)
	);
	let left = r.units;
	let filled = 0;
	for (const line of lines) {
		if (left <= 0) break;
		const have = out.filter((o) => o.lineId === line.id).reduce((sum, o) => sum + o.units, 0);
		const need = Math.min(line.quantity - line.refundedQuantity - have, left);
		if (need <= 0) continue;
		await change(tx, { stage: 'packed', itemId: r.packingRunId }, r.locationId, -need, {
			reason: 'sale',
			occurredAt: r.packedAt,
			userId: r.userId,
			refType: 'order_line',
			refId: line.id
		});
		left -= need;
		filled++;
	}
	return filled;
}

/* ── Correcting a roast ─────────────────────────────────────────────────────────────────────── */

/**
 * The roasted weight was misread: the batch's output is set to what really came out, and the
 * difference moves its roasted stock where it was roasted as an `adjustment`. Less can only come
 * off what is still free there. The cost per kg stays as recorded.
 */
export async function correctRoastWeight(
	tx: Writer,
	r: { roastBatchId: number; roastedKgOut: number; reason: string; userId?: string | null }
) {
	const [b] = await tx
		.select()
		.from(roastBatch)
		.where(eq(roastBatch.id, r.roastBatchId))
		.for('update');
	if (!b || b.deletedAt) throw new WriteRefused('roastedKgOut', 'That batch was voided.');
	const next = round3(r.roastedKgOut);
	if (next <= 0) throw new WriteRefused('roastedKgOut', 'Enter the roasted kilograms.');
	if (next > Number(b.greenKgIn))
		throw new WriteRefused('roastedKgOut', `More came out than went in (${b.greenKgIn} kg green).`);
	const delta = round3(next - Number(b.roastedKgOut));
	if (!delta) throw new WriteRefused('roastedKgOut', 'That is the weight already recorded.');
	await change(
		tx,
		{ stage: 'roasted', itemId: b.id },
		b.locationId,
		delta,
		{
			reason: 'adjustment',
			occurredAt: new Date(),
			note: `Roasted weight corrected from ${b.roastedKgOut} to ${next} kg: ${r.reason}`,
			userId: r.userId,
			refType: 'roast_batch',
			refId: b.id
		},
		'roastedKgOut'
	);
	await tx
		.update(roastBatch)
		.set({ roastedKgOut: next, updatedBy: r.userId ?? null })
		.where(eq(roastBatch.id, b.id));
	return { before: Number(b.roastedKgOut), after: next };
}

/**
 * A batch recorded by mistake: its green goes back to the lots at what it cost, its roasted coffee
 * is taken out, its order lines go back to the roast queue, and it is marked deleted. Only while
 * all it made is still where it was roasted — none packed, moved, sold or wasted.
 */
export async function voidRoastBatch(
	tx: Writer,
	r: { roastBatchId: number; reason: string; userId?: string | null }
) {
	const [b] = await tx
		.select()
		.from(roastBatch)
		.where(eq(roastBatch.id, r.roastBatchId))
		.for('update');
	if (!b || b.deletedAt) throw new WriteRefused('reason', 'That batch was voided already.');
	const used = await tx
		.select({ reason: stockMovement.reason })
		.from(stockMovement)
		.where(
			and(
				eq(stockMovement.roastBatchId, b.id),
				eq(stockMovement.stage, 'roasted'),
				sql`${stockMovement.reason} not in ('roast_output', 'adjustment')`
			)
		)
		.limit(1);
	if (used.length)
		throw new WriteRefused(
			'reason',
			'Some of this batch was packed, moved or used since: correct its weight instead, or record waste.'
		);
	const now = new Date();
	const note = `Roast batch ${b.code} voided: ${r.reason}`;
	const base = { occurredAt: now, note, userId: r.userId, refType: 'roast_batch', refId: b.id };
	const [here] = await tx
		.select({ kg: roastedStock.kg })
		.from(roastedStock)
		.where(and(eq(roastedStock.roastBatchId, b.id), eq(roastedStock.locationId, b.locationId)));
	const kg = round3(Number(here?.kg ?? 0));
	if (kg > 0)
		await change(tx, { stage: 'roasted', itemId: b.id }, b.locationId, -kg, {
			...base,
			reason: 'adjustment'
		});
	const inputs = await tx
		.select({
			lotId: stockMovement.lotId,
			kg: stockMovement.quantity,
			cost: stockMovement.unitCost
		})
		.from(stockMovement)
		.where(and(eq(stockMovement.roastBatchId, b.id), eq(stockMovement.reason, 'roast_input')));
	for (const i of inputs) {
		if (!i.lotId) continue;
		await change(
			tx,
			{ stage: 'green', itemId: i.lotId },
			b.locationId,
			Math.abs(Number(i.kg)),
			{ ...base, reason: 'adjustment' },
			'reason',
			Number(i.cost)
		);
	}
	await tx.update(orderLine).set({ roastBatchId: null }).where(eq(orderLine.roastBatchId, b.id));
	await tx
		.update(roastBatch)
		.set({ deletedAt: now, deletedBy: r.userId ?? null, updatedBy: r.userId ?? null })
		.where(eq(roastBatch.id, b.id));
	return { code: b.code, kg, lots: inputs.length };
}
