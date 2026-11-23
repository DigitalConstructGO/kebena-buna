import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { localClock, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import {
	lot,
	packedStock,
	packingRun,
	productVariant,
	roastBatch,
	roastLevel,
	roastedStock,
	station
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stockLocationOptions } from '#lib/server/options.ts';
import { joinDateTime } from '#lib/server/records.ts';
import { balancesAt, postCount } from '#lib/server/stock.ts';
import { STOCK_STAGES, type StockStage } from '#lib/constants.ts';
import { countSchema } from '#lib/schemas/stock.ts';

/** Everything of a stage that could be on a shelf: every lot, and the batches and runs with stock. */
async function itemsOf(stage: StockStage) {
	if (stage === 'green') {
		return db
			.select({ itemId: lot.id, label: sql<string>`concat(${lot.code}, ' · ', ${station.code})` })
			.from(lot)
			.innerJoin(station, eq(lot.stationId, station.id))
			.where(and(isNull(lot.deletedAt), eq(lot.isActive, true)))
			.orderBy(lot.code);
	}
	if (stage === 'roasted') {
		return db
			.select({ itemId: roastBatch.id, label: sql<string>`concat(${roastBatch.code}, ' · ', ${enOf(roastLevel.name)})` })
			.from(roastBatch)
			.innerJoin(roastLevel, eq(roastBatch.roastLevelId, roastLevel.id))
			.where(inArray(roastBatch.id, db.select({ id: roastedStock.roastBatchId }).from(roastedStock)))
			.orderBy(desc(roastBatch.roastedAt));
	}
	return db
		.select({ itemId: packingRun.id, label: sql<string>`concat(${productVariant.sku}, ' · ', ${packingRun.code})` })
		.from(packingRun)
		.innerJoin(productVariant, eq(packingRun.variantId, productVariant.id))
		.where(inArray(packingRun.id, db.select({ id: packedStock.packingRunId }).from(packedStock)))
		.orderBy(productVariant.sku, packingRun.packedAt);
}

export const load = async ({ locals, url }) => {
	requirePermission(locals, 'stock.manage');
	const locations = await stockLocationOptions();
	const asked = Number(url.searchParams.get('location'));
	const locationId = locations.some((l) => l.value === asked) ? asked : locations[0]?.value;
	const stageParam = url.searchParams.get('stage') as StockStage | null;
	const stage: StockStage = stageParam && STOCK_STAGES.includes(stageParam) ? stageParam : 'packed';

	const [items, books] = await Promise.all([itemsOf(stage), balancesAt(db, stage, locationId)]);
	// What the books hold here first, then the rest — a count finds what is on the shelf.
	const lines = items
		.map((i) => ({ itemId: i.itemId, label: i.label, expected: books.get(i.itemId) ?? 0, counted: null }))
		.sort((a, b) => Number(b.expected > 0) - Number(a.expected > 0));

	return {
		locations,
		locationId,
		stage,
		form: await superValidate(
			{ locationId, stage, date: localToday(), time: localClock(new Date()), lines },
			zod4(countSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	default: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const form = await superValidate(event.request, zod4(countSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { date, time, lines, ...values } = form.data;
		let posted: { id: number; changed: number };
		try {
			posted = await db.transaction(async (tx) => {
				const p = await postCount(tx, {
					...values,
					countedAt: joinDateTime(date, time),
					lines: lines.flatMap((l) => (l.counted === null ? [] : [{ itemId: l.itemId, counted: l.counted }])),
					userId: event.locals.user?.id
				});
				await recordAudit(tx, event, { table: 'stock_count', recordId: p.id, action: 'create', detail: { corrections: p.changed } });
				return p;
			});
		} catch (err) {
			if (err instanceof WriteRefused) {
				if (err.field) setError(form, err.field as never, err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			throw err;
		}
		redirect(
			`/dashboard/stock/counts/${posted.id}`,
			{ type: 'success', message: posted.changed ? `Count posted: ${posted.changed} correction(s)` : 'Count posted: the books agree' },
			event.cookies
		);
	}
};
