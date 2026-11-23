import { asc, count, eq, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { postedForm } from '@nahu/admin-kit/server/files';
import { db } from '#lib/server/db/index.ts';
import { location, tourHotspot, tourScene } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { locationOptions } from '#lib/server/options.ts';
import { creator } from '#lib/server/people.ts';
import { refusal, saveScene } from '#lib/server/content.ts';
import { sceneSchema } from '#lib/schemas/content.ts';

/** Website › Virtual tour: the 360° scenes of Site A and Site B, in tour order. */
export const load = async () => {
	const hotspots = db
		.select({ sceneId: tourHotspot.sceneId, n: count().as('n') })
		.from(tourHotspot)
		.where(isNull(tourHotspot.deletedAt))
		.groupBy(tourHotspot.sceneId)
		.as('hotspots');
	const [rows, locations] = await Promise.all([
		db
			.select({
				id: tourScene.id,
				slug: tourScene.slug,
				title: enOf(tourScene.title),
				locationId: tourScene.locationId,
				location: enOf(location.name),
				preview: tourScene.preview,
				panorama: tourScene.panorama,
				isStart: tourScene.isStart,
				sortOrder: tourScene.sortOrder,
				isActive: tourScene.isActive,
				hotspots: hotspots.n,
				createdById: tourScene.createdBy,
				createdBy: creator.name
			})
			.from(tourScene)
			.innerJoin(location, eq(tourScene.locationId, location.id))
			.leftJoin(hotspots, eq(hotspots.sceneId, tourScene.id))
			.leftJoin(creator, eq(tourScene.createdBy, creator.id))
			.where(isNull(tourScene.deletedAt))
			.orderBy(asc(tourScene.locationId), asc(tourScene.sortOrder)),
		locationOptions()
	]);
	return {
		rows: rows.map((r) => ({ ...r, hotspots: Number(r.hotspots ?? 0) })),
		locations,
		addForm: await superValidate(zod4(sceneSchema))
	};
};

export const actions = {
	add: async (event) => {
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(sceneSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		try {
			await saveScene(event, form.data, posted);
		} catch (err) {
			const r = refusal(err);
			if (!r) throw err;
			if (r.field) setError(form, r.field as 'slug', r.text);
			return message(form, { type: 'error', text: r.text }, { status: 400 });
		}
		return message(form, { type: 'success', text: 'Scene added' });
	}
};
