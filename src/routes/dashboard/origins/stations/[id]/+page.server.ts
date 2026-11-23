import { error } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { postedForm, saveUploadedFile, UploadRefused } from '@nahu/admin-kit/server/files';
import { db } from '#lib/server/db/index.ts';
import {
	certification,
	lot,
	product,
	productOrigin,
	region,
	station,
	stationCertification
} from '#lib/server/db/schema.ts';
import { enOf, packLocalized, unpackLocalized } from '#lib/server/localized.ts';
import { stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { greenKgOfLot, setStationCertifications } from '#lib/server/origins.ts';
import { certificationOptions, regionOptions } from '#lib/server/options.ts';
import { stationEditSchema, stationPhotoSchema } from '#lib/schemas/origins.ts';

async function loadStation(raw: string | number) {
	const id = idParam(String(raw), 'Station');
	const [row] = await db
		.select({ station, region: enOf(region.name) })
		.from(station)
		.innerJoin(region, eq(station.regionId, region.id))
		.where(and(eq(station.id, id), isNull(station.deletedAt)));
	if (!row) error(404, 'Station not found');
	return row;
}

export const load = async ({ params, locals }) => {
	const row = await loadStation(params.id);
	const s = row.station;
	const [certifications, lots, products, stamps, regions, certificationList] = await Promise.all([
		db
			.select({ id: certification.id, name: enOf(certification.name), logo: certification.logo })
			.from(stationCertification)
			.innerJoin(certification, eq(stationCertification.certificationId, certification.id))
			.where(eq(stationCertification.stationId, s.id)),
		db
			.select({
				id: lot.id,
				code: lot.code,
				process: lot.process,
				cropYear: lot.cropYear,
				grade: lot.grade,
				cuppingScore: lot.cuppingScore,
				greenKg: greenKgOfLot,
				isActive: lot.isActive
			})
			.from(lot)
			.where(and(eq(lot.stationId, s.id), isNull(lot.deletedAt)))
			.orderBy(desc(lot.cropYear), desc(lot.id)),
		db
			.selectDistinct({
				id: product.id,
				name: enOf(product.name),
				publishStatus: product.publishStatus
			})
			.from(productOrigin)
			.innerJoin(product, eq(productOrigin.productId, product.id))
			.where(and(eq(productOrigin.stationId, s.id), isNull(product.deletedAt))),
		stampsOf(s),
		regionOptions(),
		certificationOptions()
	]);
	return {
		station: s,
		region: row.region,
		certifications,
		lots,
		products,
		stamps,
		options: { regions, certifications: certificationList },
		canManage: hasPermission(locals, 'origins.manage'),
		editForm: await superValidate(
			{
				...unpackLocalized(s, ['name', 'story']),
				certificationIds: certifications.map((c) => c.id)
			},
			zod4(stationEditSchema),
			{ errors: false, id: 'edit' }
		),
		photoForm: await superValidate(zod4(stationPhotoSchema), { id: 'photo' })
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'origins.manage');
		const form = await superValidate(event.request, zod4(stationEditSchema), { id: 'edit' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { id, certificationIds, ...values } = form.data;
		const { station: before } = await loadStation(id);
		const row = packLocalized({ ...values }, ['name', 'story']);
		try {
			await db.transaction(async (tx) => {
				await tx
					.update(station)
					.set({
						...(row as Partial<typeof station.$inferInsert>),
						updatedBy: event.locals.user?.id
					})
					.where(eq(station.id, id));
				await setStationCertifications(tx, id, certificationIds);
				await recordAudit(tx, event, {
					table: 'station',
					recordId: id,
					action: 'update',
					before,
					after: row
				});
			});
		} catch (err) {
			if (isDuplicateKey(err)) {
				setError(form, 'code', 'Another station has this code.');
				return message(form, { type: 'error', text: 'That code is taken' }, { status: 400 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Station saved' });
	},
	photo: async (event) => {
		requirePermission(event.locals, 'origins.manage');
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(stationPhotoSchema), { id: 'photo' });
		const { station: s } = await loadStation(event.params.id);
		if (!form.data.photo?.size) {
			setError(form, 'photo', 'Choose a picture');
			return message(form, { type: 'error', text: 'Choose a picture' }, { status: 400 });
		}
		try {
			const photo = await saveUploadedFile(form.data.photo);
			await db
				.update(station)
				.set({ photo, updatedBy: event.locals.user?.id })
				.where(eq(station.id, s.id));
		} catch (err) {
			if (err instanceof UploadRefused) {
				setError(form, 'photo', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Photo saved' });
	},
	delete: async (event) => {
		requirePermission(event.locals, 'origins.manage');
		const { station: s } = await loadStation(event.params.id);
		const [used] = await db
			.select({ id: lot.id })
			.from(lot)
			.where(and(eq(lot.stationId, s.id), isNull(lot.deletedAt)))
			.limit(1);
		if (used)
			return { message: { type: 'error', text: 'This station has lots: switch it off instead.' } };
		await db.transaction(async (tx) => {
			await tx
				.update(station)
				.set(deletionStamp(event.locals.user?.id))
				.where(eq(station.id, s.id));
			await recordAudit(tx, event, { table: 'station', recordId: s.id, action: 'delete' });
		});
		redirect(
			'/dashboard/origins/stations',
			{ type: 'success', message: `${s.code} deleted` },
			event.cookies
		);
	}
};
