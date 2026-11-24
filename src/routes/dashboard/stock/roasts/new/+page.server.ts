import { eq } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { localClock, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { greenStock, location, lot } from '#lib/server/db/schema.ts';
import {
	productOptions,
	roastLevelOptions,
	roastMachineOptions,
	stockLocationOptions
} from '#lib/server/options.ts';
import { staffOptions } from '#lib/server/people.ts';
import { joinDateTime } from '#lib/server/records.ts';
import { recordRoast } from '#lib/server/stock.ts';
import { stockLevels } from '#lib/server/stockReads.ts';
import { roastSchema } from '#lib/schemas/stock.ts';

/** Green kg free per lot, per location: what each roast line may draw. */
async function greenByLocation() {
	const rows = await db
		.select({ lotId: greenStock.lotId, locationId: greenStock.locationId, kg: greenStock.kg })
		.from(greenStock);
	const out: Record<number, Record<number, number>> = {};
	for (const r of rows) (out[r.locationId] ??= {})[r.lotId] = Number(r.kg);
	return out;
}

export const load = async ({ locals, url }) => {
	requirePermission(locals, 'stock.manage');
	/*
	 * Opened from the home page's roast queue: the product and roast that orders are waiting on,
	 * roasted to order. Only ids that are offered are taken, so a stale link fills in nothing.
	 */
	const wanted = (name: string) => {
		const v = Number(url.searchParams.get(name));
		return Number.isInteger(v) && v > 0 ? v : undefined;
	};
	const [locations, machines, staff, products, roastLevels, lots, green, [roastery], levels] =
		await Promise.all([
			stockLocationOptions(),
			roastMachineOptions(),
			staffOptions(),
			productOptions(),
			roastLevelOptions(),
			db.select({ value: lot.id, name: lot.code }).from(lot).orderBy(lot.code),
			greenByLocation(),
			db.select({ id: location.id }).from(location).where(eq(location.type, 'roastery')),
			stockLevels()
		]);
	return {
		options: { locations, machines, staff, products, roastLevels, lots },
		green,
		lossRange: levels.lossRange,
		form: await superValidate(
			{
				date: localToday(),
				time: localClock(new Date()),
				locationId: roastery?.id,
				roasterId: locals.user?.id,
				productId: products.some((p) => p.value === wanted('product'))
					? wanted('product')
					: undefined,
				roastLevelId: roastLevels.some((r) => r.value === wanted('roast'))
					? wanted('roast')
					: undefined,
				isToOrder: url.searchParams.get('toOrder') === '1',
				inputs: [{ lotId: undefined, greenKg: 0 }]
			},
			zod4(roastSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	default: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const form = await superValidate(event.request, zod4(roastSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { date, time, ...values } = form.data;
		let batch: { id: number; code: string; linked: number };
		try {
			batch = await db.transaction(async (tx) => {
				const b = await recordRoast(tx, {
					...values,
					roastedAt: joinDateTime(date, time),
					userId: event.locals.user?.id
				});
				await recordAudit(tx, event, { table: 'roast_batch', recordId: b.id, action: 'create' });
				return b;
			});
		} catch (err) {
			if (err instanceof WriteRefused) {
				if (err.field) setError(form, err.field as never, err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			throw err;
		}
		redirect(
			`/dashboard/stock/roasts/${batch.id}`,
			{
				type: 'success',
				message: batch.linked
					? `${batch.code} recorded, roasted for ${batch.linked} order line${batch.linked === 1 ? '' : 's'}`
					: `${batch.code} recorded`
			},
			event.cookies
		);
	}
};
