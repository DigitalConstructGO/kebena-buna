import { error } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
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
import {
	correctRoastWeight,
	linkRoastToOrders,
	roastedCost,
	voidRoastBatch
} from '#lib/server/stock.ts';
import { stockLevels } from '#lib/server/stockReads.ts';
import { roastCorrectSchema, roastEditSchema, roastVoidSchema } from '#lib/schemas/stock.ts';

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
					id: orderLine.id,
					orderId: order.id,
					number: order.number,
					status: order.status,
					description: orderLine.description,
					quantity: orderLine.quantity,
					/** Bags it has had: sold off a run, less returned. */
					bagged:
						sql<number>`(select coalesce(-sum(m.quantity), 0) from stock_movement m where m.stage = 'packed' and m.reason in ('sale', 'sale_return') and m.ref_type = 'order_line' and m.ref_id = ${orderLine.id})`.mapWith(
							Number
						)
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
		),
		correctForm: await superValidate(
			{ id: b.id, roastedKgOut: Number(b.roastedKgOut) },
			zod4(roastCorrectSchema),
			{ errors: false, id: 'correct' }
		),
		voidForm: await superValidate({ id: b.id }, zod4(roastVoidSchema), {
			errors: false,
			id: 'void'
		})
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const form = await superValidate(event.request, zod4(roastEditSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { id, ...values } = form.data;
		const { batch: before } = await loadBatch(String(id));
		await db.transaction(async (tx) => {
			await tx
				.update(roastBatch)
				.set({ ...values, updatedBy: event.locals.user?.id })
				.where(eq(roastBatch.id, id));
			await recordAudit(tx, event, {
				table: 'roast_batch',
				recordId: id,
				action: 'update',
				before,
				after: values
			});
		});
		// Marked roast-day, or given its product, it may now fill queue lines.
		const linked = await db.transaction((tx) => linkRoastToOrders(tx, id));
		return message(form, {
			type: 'success',
			text: linked ? `Batch saved; roasted for ${linked} more order lines` : 'Batch saved'
		});
	},
	/** Takes the roast queue's lines this roast-day batch can still fill. */
	link: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const { batch } = await loadBatch(event.params.id);
		const linked = await db.transaction((tx) => linkRoastToOrders(tx, batch.id));
		return {
			message: linked
				? { type: 'success', text: `Roasted for ${linked} order line${linked === 1 ? '' : 's'}` }
				: { type: 'info', text: 'No waiting order line fits this batch' }
		};
	},
	/** A line wrongly named: it goes back to the roast queue, unless it has its bags already. */
	unlink: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const { batch } = await loadBatch(event.params.id);
		const lineId = Number((await event.request.formData()).get('lineId'));
		const [line] = await db
			.select({
				bagged:
					sql<number>`(select coalesce(-sum(m.quantity), 0) from stock_movement m where m.stage = 'packed' and m.reason in ('sale', 'sale_return') and m.ref_type = 'order_line' and m.ref_id = ${orderLine.id})`.mapWith(
						Number
					)
			})
			.from(orderLine)
			.where(and(eq(orderLine.id, lineId), eq(orderLine.roastBatchId, batch.id)));
		if (!line) return { message: { type: 'error', text: 'That line is not on this batch' } };
		if (line.bagged > 0) return { message: { type: 'error', text: 'Its bags are packed already' } };
		await db.transaction(async (tx) => {
			await tx.update(orderLine).set({ roastBatchId: null }).where(eq(orderLine.id, lineId));
			await recordAudit(tx, event, {
				table: 'order_line',
				recordId: lineId,
				action: 'update',
				detail: { roastBatchId: { from: batch.id, to: null } }
			});
		});
		return { message: { type: 'success', text: 'Back on the roast queue' } };
	},
	correct: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const form = await superValidate(event.request, zod4(roastCorrectSchema), { id: 'correct' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		try {
			const r = await db.transaction(async (tx) => {
				const done = await correctRoastWeight(tx, {
					roastBatchId: form.data.id,
					roastedKgOut: form.data.roastedKgOut,
					reason: form.data.reason,
					userId: event.locals.user?.id
				});
				await recordAudit(tx, event, {
					table: 'roast_batch',
					recordId: form.data.id,
					action: 'update',
					before: { roastedKgOut: done.before },
					after: { roastedKgOut: done.after },
					detail: { reason: form.data.reason }
				});
				return done;
			});
			return message(form, {
				type: 'success',
				text: `Roasted weight is now ${r.after} kg (was ${r.before} kg)`
			});
		} catch (err) {
			if (!(err instanceof WriteRefused)) throw err;
			setError(form, 'roastedKgOut', err.message);
			return message(form, { type: 'error', text: err.message }, { status: 400 });
		}
	},
	void: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const form = await superValidate(event.request, zod4(roastVoidSchema), { id: 'void' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		let done: Awaited<ReturnType<typeof voidRoastBatch>>;
		try {
			done = await db.transaction(async (tx) => {
				const r = await voidRoastBatch(tx, {
					roastBatchId: form.data.id,
					reason: form.data.reason,
					userId: event.locals.user?.id
				});
				await recordAudit(tx, event, {
					table: 'roast_batch',
					recordId: form.data.id,
					action: 'delete',
					detail: { voided: true, reason: form.data.reason }
				});
				return r;
			});
		} catch (err) {
			if (!(err instanceof WriteRefused)) throw err;
			return message(form, { type: 'error', text: err.message }, { status: 400 });
		}
		redirect(
			'/dashboard/stock/roasts',
			{
				type: 'success',
				message: `${done.code} voided; its green is back on ${done.lots} lot${done.lots === 1 ? '' : 's'}`
			},
			event.cookies
		);
	}
};
