import { error } from '@sveltejs/kit';
import { desc, eq, inArray } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import {
	grind,
	location,
	lot,
	packedStock,
	packingRun,
	packingRunSource,
	product,
	productVariant,
	roastBatch,
	roastBatchInput,
	roastLevel,
	station,
	stockMovement
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stampsOf, userAlias } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { packedCost } from '#lib/server/stock.ts';
import { packingEditSchema } from '#lib/schemas/stock.ts';

const packer = userAlias('packer');
const mover = userAlias('mover');

async function loadRun(raw: string) {
	const id = idParam(raw, 'Packing run');
	const [row] = await db
		.select({
			run: packingRun,
			sku: productVariant.sku,
			productId: productVariant.productId,
			product: enOf(product.name),
			roastLevel: enOf(roastLevel.name),
			grind: enOf(grind.name),
			location: enOf(location.name),
			packer: packer.name
		})
		.from(packingRun)
		.innerJoin(productVariant, eq(packingRun.variantId, productVariant.id))
		.innerJoin(product, eq(productVariant.productId, product.id))
		.innerJoin(roastLevel, eq(packingRun.roastLevelId, roastLevel.id))
		.innerJoin(location, eq(packingRun.locationId, location.id))
		.leftJoin(grind, eq(packingRun.grindId, grind.id))
		.leftJoin(packer, eq(packingRun.packedBy, packer.id))
		.where(eq(packingRun.id, id));
	if (!row) error(404, 'Packing run not found');
	return row;
}

export const load = async ({ params, locals }) => {
	const row = await loadRun(params.id);
	const r = row.run;
	const [sources, stock, movements, stamps, cost] = await Promise.all([
		db
			.select({
				roastBatchId: packingRunSource.roastBatchId,
				code: roastBatch.code,
				roastedAt: roastBatch.roastedAt,
				roastedKg: packingRunSource.roastedKg
			})
			.from(packingRunSource)
			.innerJoin(roastBatch, eq(packingRunSource.roastBatchId, roastBatch.id))
			.where(eq(packingRunSource.packingRunId, r.id)),
		db
			.select({
				locationId: packedStock.locationId,
				location: enOf(location.name),
				units: packedStock.units,
				reservedUnits: packedStock.reservedUnits,
				updatedAt: packedStock.updatedAt
			})
			.from(packedStock)
			.innerJoin(location, eq(packedStock.locationId, location.id))
			.where(eq(packedStock.packingRunId, r.id)),
		db
			.select({
				id: stockMovement.id,
				occurredAt: stockMovement.occurredAt,
				stage: stockMovement.stage,
				reason: stockMovement.reason,
				locationId: stockMovement.locationId,
				location: enOf(location.name),
				roastBatchId: stockMovement.roastBatchId,
				quantity: stockMovement.quantity,
				refType: stockMovement.refType,
				refId: stockMovement.refId,
				note: stockMovement.note,
				byId: stockMovement.createdBy,
				by: mover.name
			})
			.from(stockMovement)
			.innerJoin(location, eq(stockMovement.locationId, location.id))
			.leftJoin(mover, eq(stockMovement.createdBy, mover.id))
			.where(eq(stockMovement.packingRunId, r.id))
			.orderBy(desc(stockMovement.occurredAt), desc(stockMovement.id)),
		stampsOf(r),
		packedCost(db, r.id)
	]);
	// The traceability chain (questionnaire 4.9): the lots the batches used, and their stations.
	const lots = sources.length
		? await db
				.selectDistinct({
					lotId: lot.id,
					code: lot.code,
					process: lot.process,
					cropYear: lot.cropYear,
					stationId: station.id,
					station: enOf(station.name),
					roastBatchId: roastBatchInput.roastBatchId
				})
				.from(roastBatchInput)
				.innerJoin(lot, eq(roastBatchInput.lotId, lot.id))
				.innerJoin(station, eq(lot.stationId, station.id))
				.where(inArray(roastBatchInput.roastBatchId, sources.map((s) => s.roastBatchId)))
		: [];

	return {
		run: r,
		sku: row.sku,
		productId: row.productId,
		product: row.product,
		roastLevel: row.roastLevel,
		grind: row.grind,
		location: row.location,
		packer: row.packer,
		sources,
		lots,
		stock,
		movements,
		stamps,
		costPerBag: cost,
		canManage: hasPermission(locals, 'stock.manage'),
		editForm: await superValidate(
			{ id: r.id, bestBefore: r.bestBefore, labelPrinted: Boolean(r.labelPrintedAt), isActive: r.isActive },
			zod4(packingEditSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const form = await superValidate(event.request, zod4(packingEditSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { id, labelPrinted, ...values } = form.data;
		const { run: before } = await loadRun(String(id));
		const after = {
			...values,
			// Ticking it stamps when; unticking clears it. An already-printed label keeps its time.
			labelPrintedAt: labelPrinted ? (before.labelPrintedAt ?? new Date()) : null
		};
		await db.transaction(async (tx) => {
			await tx.update(packingRun).set({ ...after, updatedBy: event.locals.user?.id }).where(eq(packingRun.id, id));
			await recordAudit(tx, event, { table: 'packing_run', recordId: id, action: 'update', before, after });
		});
		return message(form, { type: 'success', text: 'Packing run saved' });
	}
};
