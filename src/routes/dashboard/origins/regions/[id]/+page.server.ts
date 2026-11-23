import { error } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import { lot, region, station } from '#lib/server/db/schema.ts';
import { enOf, packLocalized, unpackLocalized } from '#lib/server/localized.ts';
import { idParam } from '#lib/server/records.ts';
import { greenKgOfLot, greenKgOfStation, lotCountOfStation } from '#lib/server/origins.ts';
import { regionOptions } from '#lib/server/options.ts';
import { regionEditSchema } from '#lib/schemas/origins.ts';

async function loadRegion(raw: string | number) {
	const id = idParam(String(raw), 'Region');
	const [row] = await db
		.select()
		.from(region)
		.where(and(eq(region.id, id), isNull(region.deletedAt)));
	if (!row) error(404, 'Region not found');
	return row;
}

/** The chain from the top of the tree down to this region: Oromia › Jimma › Limu. */
async function pathOf(r: typeof region.$inferSelect) {
	const path: { id: number; name: string }[] = [];
	let at = r.parentId;
	for (let depth = 0; at && depth < 20; depth++) {
		const [p] = await db
			.select({ id: region.id, name: enOf(region.name), parentId: region.parentId })
			.from(region)
			.where(eq(region.id, at));
		if (!p) break;
		path.unshift({ id: p.id, name: p.name });
		at = p.parentId;
	}
	return path;
}

export const load = async ({ params, locals }) => {
	const r = await loadRegion(params.id);
	const [path, children, stations, lots, regions] = await Promise.all([
		pathOf(r),
		db
			.select({
				id: region.id,
				name: enOf(region.name),
				level: region.level,
				status: region.status
			})
			.from(region)
			.where(and(eq(region.parentId, r.id), isNull(region.deletedAt)))
			.orderBy(enOf(region.name)),
		db
			.select({
				id: station.id,
				code: station.code,
				name: enOf(station.name),
				type: station.type,
				lots: lotCountOfStation,
				greenKg: greenKgOfStation
			})
			.from(station)
			.where(and(eq(station.regionId, r.id), isNull(station.deletedAt)))
			.orderBy(station.code),
		db
			.select({
				id: lot.id,
				code: lot.code,
				stationId: lot.stationId,
				station: station.code,
				process: lot.process,
				cropYear: lot.cropYear,
				greenKg: greenKgOfLot
			})
			.from(lot)
			.innerJoin(station, eq(lot.stationId, station.id))
			.where(and(eq(lot.regionId, r.id), isNull(lot.deletedAt)))
			.orderBy(desc(lot.cropYear), lot.code),
		regionOptions()
	]);
	return {
		region: r,
		path,
		children,
		stations,
		lots,
		regions: regions.filter((o) => o.value !== r.id),
		canManage: hasPermission(locals, 'origins.manage'),
		editForm: await superValidate(unpackLocalized(r, ['name', 'story']), zod4(regionEditSchema), {
			errors: false
		})
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'origins.manage');
		const form = await superValidate(event.request, zod4(regionEditSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { id, ...values } = form.data;
		const r = await loadRegion(id);
		if (values.parentId) {
			const above = await pathOf({ ...r, parentId: values.parentId });
			if (values.parentId === id || above.some((p) => p.id === id)) {
				setError(form, 'parentId', 'A region cannot sit inside itself.');
				return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
			}
		}
		await db
			.update(region)
			.set(packLocalized({ ...values }, ['name', 'story']))
			.where(eq(region.id, id));
		return message(form, { type: 'success', text: 'Region saved' });
	}
};
