import { error } from '@sveltejs/kit';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { db } from '#lib/server/db/index.ts';
import {
	certification,
	greenStock,
	location,
	lot,
	lotCertification,
	lotVariety,
	product,
	productOrigin,
	region,
	roastBatch,
	roastBatchInput,
	roastLevel,
	station,
	stockMovement,
	variety
} from '#lib/server/db/schema.ts';
import { enOf, packLocalized, unpackLocalized } from '#lib/server/localized.ts';
import { stampsOf, userAlias } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { setLotLinks } from '#lib/server/origins.ts';
import {
	certificationOptions,
	regionOptions,
	stationOptions,
	varietyOptions
} from '#lib/server/options.ts';
import { lotEditSchema } from '#lib/schemas/origins.ts';
import { stockLevels } from '#lib/server/stockReads.ts';

async function loadLot(raw: string) {
	const id = idParam(raw, 'Lot');
	const [row] = await db
		.select({
			lot,
			station: enOf(station.name),
			stationCode: station.code,
			region: enOf(region.name)
		})
		.from(lot)
		.innerJoin(station, eq(lot.stationId, station.id))
		.innerJoin(region, eq(lot.regionId, region.id))
		.where(and(eq(lot.id, id), isNull(lot.deletedAt)));
	if (!row) error(404, 'Lot not found');
	return row;
}

const mover = userAlias('mover');
const roaster = userAlias('roaster');

export const load = async ({ params, locals }) => {
	const row = await loadLot(params.id);
	const l = row.lot;
	const [varieties, certifications, stock, roasts, movements, products, stamps, options] =
		await Promise.all([
			db
				.select({ id: variety.id, name: variety.name })
				.from(lotVariety)
				.innerJoin(variety, eq(lotVariety.varietyId, variety.id))
				.where(eq(lotVariety.lotId, l.id)),
			db
				.select({
					id: certification.id,
					name: enOf(certification.name),
					number: lotCertification.certificateNumber
				})
				.from(lotCertification)
				.innerJoin(certification, eq(lotCertification.certificationId, certification.id))
				.where(eq(lotCertification.lotId, l.id)),
			db
				.select({
					locationId: greenStock.locationId,
					location: enOf(location.name),
					kg: greenStock.kg,
					costPerKg: greenStock.costPerKg,
					updatedAt: greenStock.updatedAt
				})
				.from(greenStock)
				.innerJoin(location, eq(greenStock.locationId, location.id))
				.where(eq(greenStock.lotId, l.id)),
			db
				.select({
					id: roastBatch.id,
					code: roastBatch.code,
					roastedAt: roastBatch.roastedAt,
					roastLevel: enOf(roastLevel.name),
					greenKg: roastBatchInput.greenKg,
					weightLossPct: roastBatch.weightLossPct,
					roasterId: roastBatch.roasterId,
					roaster: roaster.name
				})
				.from(roastBatchInput)
				.innerJoin(roastBatch, eq(roastBatchInput.roastBatchId, roastBatch.id))
				.innerJoin(roastLevel, eq(roastBatch.roastLevelId, roastLevel.id))
				.leftJoin(roaster, eq(roastBatch.roasterId, roaster.id))
				.where(eq(roastBatchInput.lotId, l.id))
				.orderBy(desc(roastBatch.roastedAt)),
			db
				.select({
					id: stockMovement.id,
					occurredAt: stockMovement.occurredAt,
					reason: stockMovement.reason,
					locationId: stockMovement.locationId,
					location: enOf(location.name),
					quantity: stockMovement.quantity,
					unitCost: stockMovement.unitCost,
					roastBatchId: stockMovement.roastBatchId,
					note: stockMovement.note,
					byId: stockMovement.createdBy,
					by: mover.name
				})
				.from(stockMovement)
				.innerJoin(location, eq(stockMovement.locationId, location.id))
				.leftJoin(mover, eq(stockMovement.createdBy, mover.id))
				.where(eq(stockMovement.lotId, l.id))
				.orderBy(desc(stockMovement.occurredAt))
				.limit(100),
			db
				.select({ id: product.id, name: enOf(product.name), share: productOrigin.sharePercent })
				.from(productOrigin)
				.innerJoin(product, eq(productOrigin.productId, product.id))
				.where(and(eq(productOrigin.lotId, l.id), isNull(product.deletedAt))),
			stampsOf(l),
			Promise.all([stationOptions(), regionOptions(), varietyOptions(), certificationOptions()])
		]);

	return {
		lot: l,
		greenLowDefault: (await stockLevels()).greenLow,
		station: row.station,
		stationCode: row.stationCode,
		region: row.region,
		varieties,
		certifications,
		stock,
		roasts,
		movements,
		products,
		stamps,
		options: {
			stations: options[0],
			regions: options[1],
			varieties: options[2],
			certifications: options[3]
		},
		canManage: hasPermission(locals, 'origins.manage'),
		editForm: await superValidate(
			{
				...unpackLocalized(l, ['tastingNotes', 'story']),
				varietyIds: varieties.map((v) => v.id),
				certificationIds: certifications.map((c) => c.id)
			},
			zod4(lotEditSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'origins.manage');
		const form = await superValidate(event.request, zod4(lotEditSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		// The lot is the one in the URL; the form's own id is not trusted to name it.
		const { lot: before } = await loadLot(event.params.id);
		const id = before.id;
		// The station and crop year are in the lot code, so they stay as the lot was entered.
		const { id: _id, varietyIds, certificationIds, ...values } = form.data;
		const row = packLocalized({ ...values }, ['tastingNotes', 'story']);
		await db.transaction(async (tx) => {
			await tx
				.update(lot)
				.set({ ...(row as Partial<typeof lot.$inferInsert>), updatedBy: event.locals.user?.id })
				.where(eq(lot.id, id));
			await setLotLinks(tx, id, varietyIds, certificationIds);
			await recordAudit(tx, event, {
				table: 'lot',
				recordId: id,
				action: 'update',
				before,
				after: row
			});
		});
		return message(form, { type: 'success', text: 'Lot saved' });
	},
	delete: async (event) => {
		requirePermission(event.locals, 'origins.manage');
		const { lot: l } = await loadLot(event.params.id);
		const refusal = await db.transaction(async (tx) => {
			// The lot row is held for the checks and the delete together.
			await tx.select({ id: lot.id }).from(lot).where(eq(lot.id, l.id)).for('update');
			const [used] = await tx
				.select({ id: roastBatchInput.id })
				.from(roastBatchInput)
				.where(eq(roastBatchInput.lotId, l.id))
				.limit(1);
			if (used) return 'This lot has been roasted: switch it off instead.';
			// Stock on hand, or any movement at all, keeps the lot: its coffee is in the stock value
			// and its ledger, and a deleted lot drops out of every picker that could set it right.
			const [held] = await tx
				.select({ id: greenStock.id })
				.from(greenStock)
				.where(and(eq(greenStock.lotId, l.id), gt(greenStock.kg, 0)))
				.limit(1);
			if (held) return 'This lot has coffee on hand: count or adjust it to zero, then switch it off instead.';
			const [moved] = await tx
				.select({ id: stockMovement.id })
				.from(stockMovement)
				.where(eq(stockMovement.lotId, l.id))
				.limit(1);
			if (moved) return 'This lot has stock movements: switch it off instead.';
			await tx.update(lot).set(deletionStamp(event.locals.user?.id)).where(eq(lot.id, l.id));
			await recordAudit(tx, event, { table: 'lot', recordId: l.id, action: 'delete' });
			return null;
		});
		if (refusal) return { message: { type: 'error', text: refusal } };
		redirect('/dashboard/origins/lots', { type: 'success', message: `${l.code} deleted` }, event.cookies);
	}
};
