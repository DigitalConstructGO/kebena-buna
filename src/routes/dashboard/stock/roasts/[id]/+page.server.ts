import { error } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import {
	location,
	lot,
	order,
	orderLine,
	packingRun,
	packingRunSource,
	product,
	productVariant,
	roastBatch,
	roastBatchInput,
	roastLevel,
	roastMachine,
	roastedStock,
	stockMovement
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { staffOptions, stampsOf, userAlias } from '#lib/server/people.ts';
import { productOptions, roastMachineOptions } from '#lib/server/options.ts';
import { idParam } from '#lib/server/records.ts';
import { roastedCost } from '#lib/server/stock.ts';
import { stockLevels } from '#lib/server/stockReads.ts';
import { roastEditSchema } from '#lib/schemas/stock.ts';

const roaster = userAlias('roaster');
const mover = userAlias('mover');

async function loadBatch(raw: string) {
	const id = idParam(raw, 'Roast batch');
	const [row] = await db
		.select({
			batch: roastBatch,
			roastLevel: enOf(roastLevel.name),
			machine: roastMachine.name,
			location: enOf(location.name),
			product: enOf(product.name),
			roaster: roaster.name
		})
		.from(roastBatch)
		.innerJoin(roastLevel, eq(roastBatch.roastLevelId, roastLevel.id))
		.innerJoin(location, eq(roastBatch.locationId, location.id))
		.leftJoin(roastMachine, eq(roastBatch.machineId, roastMachine.id))
		.leftJoin(product, eq(roastBatch.productId, product.id))
		.leftJoin(roaster, eq(roastBatch.roasterId, roaster.id))
		.where(eq(roastBatch.id, id));
	if (!row) error(404, 'Roast batch not found');
	return row;
}

export const load = async ({ params, locals }) => {
	const row = await loadBatch(params.id);
	const b = row.batch;
	const [inputs, stock, runs, lines, movements, stamps, cost, levels, staff, machines, products] =
		await Promise.all([
			db
				.select({ lotId: roastBatchInput.lotId, code: lot.code, greenKg: roastBatchInput.greenKg })
				.from(roastBatchInput)
				.innerJoin(lot, eq(roastBatchInput.lotId, lot.id))
				.where(eq(roastBatchInput.roastBatchId, b.id)),
			db
				.select({
					locationId: roastedStock.locationId,
					location: enOf(location.name),
					kg: roastedStock.kg,
					reservedKg: roastedStock.reservedKg,
					updatedAt: roastedStock.updatedAt
				})
				.from(roastedStock)
				.innerJoin(location, eq(roastedStock.locationId, location.id))
				.where(eq(roastedStock.roastBatchId, b.id)),
			db
				.select({
					id: packingRun.id,
					code: packingRun.code,
					packedAt: packingRun.packedAt,
					variantId: packingRun.variantId,
					sku: productVariant.sku,
					units: packingRun.units,
					roastedKg: packingRunSource.roastedKg
				})
				.from(packingRunSource)
				.innerJoin(packingRun, eq(packingRunSource.packingRunId, packingRun.id))
				.innerJoin(productVariant, eq(packingRun.variantId, productVariant.id))
				.where(eq(packingRunSource.roastBatchId, b.id))
				.orderBy(desc(packingRun.packedAt)),
			db
				.select({
					orderId: order.id,
					number: order.number,
					status: order.status,
					description: orderLine.description,
					quantity: orderLine.quantity
				})
				.from(orderLine)
				.innerJoin(order, eq(orderLine.orderId, order.id))
				.where(eq(orderLine.roastBatchId, b.id)),
			db
				.select({
					id: stockMovement.id,
					occurredAt: stockMovement.occurredAt,
					stage: stockMovement.stage,
					reason: stockMovement.reason,
					locationId: stockMovement.locationId,
					location: enOf(location.name),
					lotId: stockMovement.lotId,
					lot: lot.code,
					packingRunId: stockMovement.packingRunId,
					quantity: stockMovement.quantity,
					unitCost: stockMovement.unitCost,
					byId: stockMovement.createdBy,
					by: mover.name
				})
				.from(stockMovement)
				.innerJoin(location, eq(stockMovement.locationId, location.id))
				.leftJoin(lot, eq(stockMovement.lotId, lot.id))
				.leftJoin(mover, eq(stockMovement.createdBy, mover.id))
				.where(eq(stockMovement.roastBatchId, b.id))
				.orderBy(desc(stockMovement.occurredAt), desc(stockMovement.id)),
			stampsOf(b),
			roastedCost(db, b.id),
			stockLevels(),
			staffOptions(),
			roastMachineOptions(),
			productOptions()
		]);

	// Each input's cost per kg green, from its roast_input movement.
	const costOf = new Map(
		movements
			.filter((m) => m.reason === 'roast_input' && m.lotId)
			.map((m) => [m.lotId!, Number(m.unitCost)] as const)
	);

	return {
		batch: b,
		roastLevel: row.roastLevel,
		machine: row.machine,
		location: row.location,
		product: row.product,
		roaster: row.roaster,
		inputs: inputs.map((i) => ({ ...i, unitCost: costOf.get(i.lotId) ?? 0 })),
		stock,
		runs,
		lines,
		movements,
		stamps,
		costPerKg: cost,
		lossRange: levels.lossRange,
		options: { staff, machines, products },
		canManage: hasPermission(locals, 'stock.manage'),
		editForm: await superValidate(
			{
				id: b.id,
				machineId: b.machineId,
				roasterId: b.roasterId,
				productId: b.productId,
				durationMin: b.durationMin,
				dropTempC: b.dropTempC,
				cuppingScore: b.cuppingScore,
				notes: b.notes,
				isToOrder: b.isToOrder
			},
			zod4(roastEditSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const form = await superValidate(event.request, zod4(roastEditSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { id, ...values } = form.data;
		const { batch: before } = await loadBatch(String(id));
		await db.transaction(async (tx) => {
			await tx
				.update(roastBatch)
				.set({ ...values, updatedBy: event.locals.user?.id })
				.where(eq(roastBatch.id, id));
			await recordAudit(tx, event, { table: 'roast_batch', recordId: id, action: 'update', before, after: values });
		});
		return message(form, { type: 'success', text: 'Batch saved' });
	}
};
