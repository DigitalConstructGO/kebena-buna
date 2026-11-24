import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { addLocalDays, localClock, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { bagSize, location, product, productVariant, roastBatch } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { grindOptions, roastLevelOptions, stockLocationOptions } from '#lib/server/options.ts';
import { joinDateTime } from '#lib/server/records.ts';
import { recordPacking, roastedAvailable } from '#lib/server/stock.ts';
import { packingSchema } from '#lib/schemas/stock.ts';

/** Coffee bags only: a packing run fills a bag size. */
const bagVariants = () =>
	db
		.select({
			value: productVariant.id,
			name: sql<string>`concat(${enOf(product.name)}, ' — ', ${enOf(bagSize.name)}, ' (', ${productVariant.sku}, ')')`,
			productId: productVariant.productId,
			grams: bagSize.grams
		})
		.from(productVariant)
		.innerJoin(product, eq(productVariant.productId, product.id))
		.innerJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
		.where(and(isNull(productVariant.deletedAt), isNull(product.deletedAt)))
		.orderBy(asc(product.sortOrder), asc(bagSize.grams));

export const load = async ({ locals, url }) => {
	requirePermission(locals, 'stock.manage');
	const [locations, variants, roastLevels, grinds, roasted, places] = await Promise.all([
		stockLocationOptions(),
		bagVariants(),
		roastLevelOptions(),
		grindOptions(),
		roastedAvailable(db),
		db.select({ id: location.id, type: location.type }).from(location)
	]);
	// "Pack from this batch": the batch, its roast and where it is, and the first bag of its product.
	const batchId = Number(url.searchParams.get('batch')) || null;
	const [batch] = batchId
		? await db.select().from(roastBatch).where(eq(roastBatch.id, batchId))
		: [];
	const from =
		roasted.find((r) => r.roastBatchId === batch?.id)?.locationId ??
		places.find((p) => p.type === 'roastery')?.id;
	const shop = places.find((p) => p.type === 'shop')?.id;

	/** Free roasted kg per batch, per location: what each source line may draw. */
	const free: Record<number, Record<number, number>> = {};
	for (const r of roasted) (free[r.locationId] ??= {})[r.roastBatchId] = r.free;
	const batches = [
		...new Map(
			roasted.map((r) => [
				r.roastBatchId,
				{
					value: r.roastBatchId,
					name: r.code,
					locationId: r.locationId,
					roastLevelId: r.roastLevelId
				}
			])
		).values()
	];

	return {
		options: { locations, variants, roastLevels, grinds, batches },
		free,
		form: await superValidate(
			{
				date: localToday(),
				time: localClock(new Date()),
				sourceLocationId: from,
				locationId: shop,
				roastLevelId: batch?.roastLevelId,
				variantId: batch?.productId
					? variants.find((v) => v.productId === batch.productId)?.value
					: undefined,
				bestBefore: addLocalDays(localToday(), 180),
				sources: [{ roastBatchId: batch?.id, roastedKg: 0 }]
			},
			zod4(packingSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	default: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const form = await superValidate(event.request, zod4(packingSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { date, time, ...values } = form.data;
		let run: { id: number; code: string; filled: number };
		try {
			run = await db.transaction(async (tx) => {
				const r = await recordPacking(tx, {
					...values,
					packedAt: joinDateTime(date, time),
					userId: event.locals.user?.id
				});
				await recordAudit(tx, event, { table: 'packing_run', recordId: r.id, action: 'create' });
				return r;
			});
		} catch (err) {
			if (err instanceof WriteRefused) {
				if (err.field) setError(form, err.field as never, err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			throw err;
		}
		redirect(
			`/dashboard/stock/packing/${run.id}`,
			{
				type: 'success',
				message: run.filled
					? `${run.code} recorded; bags went to ${run.filled} order line${run.filled === 1 ? '' : 's'}`
					: `${run.code} recorded`
			},
			event.cookies
		);
	}
};
