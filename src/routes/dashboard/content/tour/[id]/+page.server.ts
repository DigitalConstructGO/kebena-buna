import { error } from '@sveltejs/kit';
import type { z } from 'zod/v4';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { postedForm } from '@nahu/admin-kit/server/files';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { db } from '#lib/server/db/index.ts';
import {
	bookable,
	event as museumEvent,
	location,
	lot,
	product,
	station,
	tourHotspot,
	tourScene
} from '#lib/server/db/schema.ts';
import { enOf, unpackLocalized } from '#lib/server/localized.ts';
import { stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import {
	bookableOptions,
	eventOptions,
	locationOptions,
	lotOptions,
	productOptions,
	sceneOptions,
	stationOptions
} from '#lib/server/options.ts';
import { deleteScene, refusal, saveHotspot, saveScene } from '#lib/server/content.ts';
import { hotspotEditSchema, hotspotSchema, sceneEditSchema } from '#lib/schemas/content.ts';

const target = alias(tourScene, 'target');

async function found(raw: string) {
	const id = idParam(raw, 'Scene');
	const [row] = await db
		.select({ scene: tourScene, location: enOf(location.name) })
		.from(tourScene)
		.innerJoin(location, eq(tourScene.locationId, location.id))
		.where(and(eq(tourScene.id, id), isNull(tourScene.deletedAt)));
	if (!row) error(404, 'Scene not found');
	return row;
}

/** One 360° scene and the hotspots placed in it, each naming the record it opens. */
export const load = async ({ params }) => {
	const { scene: s, location: site } = await found(params.id);
	const [hotspots, stamps, ...lists] = await Promise.all([
		db
			.select({
				hotspot: tourHotspot,
				product: enOf(product.name),
				lot: lot.code,
				station: station.code,
				bookable: enOf(bookable.name),
				event: enOf(museumEvent.title),
				targetScene: enOf(target.title)
			})
			.from(tourHotspot)
			.leftJoin(product, eq(tourHotspot.productId, product.id))
			.leftJoin(lot, eq(tourHotspot.lotId, lot.id))
			.leftJoin(station, eq(tourHotspot.stationId, station.id))
			.leftJoin(bookable, eq(tourHotspot.bookableId, bookable.id))
			.leftJoin(museumEvent, eq(tourHotspot.eventId, museumEvent.id))
			.leftJoin(target, eq(tourHotspot.targetSceneId, target.id))
			.where(and(eq(tourHotspot.sceneId, s.id), isNull(tourHotspot.deletedAt)))
			.orderBy(asc(tourHotspot.sortOrder)),
		stampsOf(s),
		locationOptions(),
		productOptions(),
		lotOptions(),
		stationOptions(),
		bookableOptions(),
		eventOptions(),
		sceneOptions()
	]);
	const [locations, products, lots, stations, bookables, events, scenes] = lists;
	const rest = { ...s, panorama: undefined, preview: undefined };
	return {
		scene: { ...s, title: (s.title as Record<string, string>).en ?? s.slug, site },
		hotspots: hotspots.map((h) => ({
			...unpackLocalized(h.hotspot, ['title', 'body']),
			title: (h.hotspot.title as Record<string, string>).en ?? '',
			product: h.product,
			lot: h.lot,
			station: h.station,
			bookable: h.bookable,
			event: h.event,
			targetScene: h.targetScene
		})),
		stamps,
		locations,
		options: {
			products,
			lots,
			stations,
			bookables,
			events,
			scenes: scenes.filter((o) => o.value !== s.id)
		},
		editForm: await superValidate(
			unpackLocalized(rest, ['title', 'description']),
			zod4(sceneEditSchema),
			{ errors: false, id: 'scene' }
		),
		addForm: await superValidate(
			{ sceneId: s.id, kind: 'info', yaw: 0, pitch: 0 },
			zod4(hotspotSchema),
			{
				errors: false,
				id: 'addHotspot'
			}
		),
		hotspotForm: await superValidate({ sceneId: s.id }, zod4(hotspotEditSchema), {
			errors: false,
			id: 'editHotspot'
		})
	};
};

/** Runs a hotspot save, answering a refusal under its field. */
async function hotspotWrite<S extends typeof hotspotSchema | typeof hotspotEditSchema>(
	event: Parameters<typeof saveHotspot>[0],
	schema: S,
	formId: string,
	sceneId: number
) {
	const form = await superValidate(event.request, zod4(schema), { id: formId });
	if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
	if (form.data.sceneId !== sceneId) error(400, 'Wrong scene');
	const data = form.data as z.infer<typeof hotspotEditSchema>;
	const id = 'id' in data ? data.id : undefined;
	try {
		await saveHotspot(event, data, id);
	} catch (err) {
		const r = refusal(err);
		if (!r) throw err;
		if (r.field) setError(form, r.field as never, r.text);
		return message(form, { type: 'error', text: r.text }, { status: 400 });
	}
	return message(form, { type: 'success', text: id ? 'Hotspot saved' : 'Hotspot added' });
}

export const actions = {
	edit: async (event) => {
		const { scene: s } = await found(event.params.id);
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(sceneEditSchema), { id: 'scene' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		try {
			await saveScene(event, form.data, posted, s.id);
		} catch (err) {
			const r = refusal(err);
			if (!r) throw err;
			if (r.field) setError(form, r.field as 'slug', r.text);
			return message(form, { type: 'error', text: r.text }, { status: 400 });
		}
		return message(form, { type: 'success', text: 'Scene saved' });
	},
	addHotspot: async (event) => {
		const { scene: s } = await found(event.params.id);
		return hotspotWrite(event, hotspotSchema, 'addHotspot', s.id);
	},
	editHotspot: async (event) => {
		const { scene: s } = await found(event.params.id);
		return hotspotWrite(event, hotspotEditSchema, 'editHotspot', s.id);
	},
	deleteHotspot: async (event) => {
		const { scene: s } = await found(event.params.id);
		const id = Number((await event.request.formData()).get('id'));
		await db.transaction(async (tx) => {
			await tx
				.update(tourHotspot)
				.set(deletionStamp(event.locals.user?.id))
				.where(and(eq(tourHotspot.id, id), eq(tourHotspot.sceneId, s.id)));
			await recordAudit(tx, event, { table: 'tour_hotspot', recordId: id, action: 'delete' });
		});
		return { message: { type: 'success', text: 'Hotspot removed' } };
	},
	delete: async (event) => {
		const { scene: s } = await found(event.params.id);
		await deleteScene(event, s.id);
		redirect(
			'/dashboard/content/tour',
			{ type: 'success', message: 'Scene deleted' },
			event.cookies
		);
	}
};
