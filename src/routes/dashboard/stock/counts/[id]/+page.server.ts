import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	location,
	lot,
	packingRun,
	productVariant,
	roastBatch,
	stockCount,
	stockMovement
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';

export const load = async ({ params }) => {
	const id = idParam(params.id, 'Stock count');
	const [row] = await db
		.select({ count: stockCount, location: enOf(location.name) })
		.from(stockCount)
		.innerJoin(location, eq(stockCount.locationId, location.id))
		.where(eq(stockCount.id, id));
	if (!row) error(404, 'Stock count not found');
	const [corrections, stamps] = await Promise.all([
		db
			.select({
				id: stockMovement.id,
				reason: stockMovement.reason,
				lotId: stockMovement.lotId,
				lot: lot.code,
				roastBatchId: stockMovement.roastBatchId,
				batch: roastBatch.code,
				packingRunId: stockMovement.packingRunId,
				run: packingRun.code,
				sku: productVariant.sku,
				quantity: stockMovement.quantity,
				unitCost: stockMovement.unitCost
			})
			.from(stockMovement)
			.leftJoin(lot, eq(stockMovement.lotId, lot.id))
			.leftJoin(roastBatch, eq(stockMovement.roastBatchId, roastBatch.id))
			.leftJoin(packingRun, eq(stockMovement.packingRunId, packingRun.id))
			.leftJoin(productVariant, eq(packingRun.variantId, productVariant.id))
			.where(and(eq(stockMovement.refType, 'stock_count'), eq(stockMovement.refId, String(id))))
			.orderBy(desc(stockMovement.id)),
		stampsOf(row.count)
	]);
	return { count: row.count, location: row.location, corrections, stamps };
};
