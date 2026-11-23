import { createHash, randomBytes } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import { location, scannerDevice, ticketScan } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { creator } from '#lib/server/people.ts';
import { locationOptions } from '#lib/server/options.ts';
import { deviceEditSchema, deviceSchema } from '#lib/schemas/visits.ts';

/** A new device token: shown once, stored only as its SHA-256. */
function newToken() {
	const token = randomBytes(24).toString('base64url');
	return { token, tokenHash: createHash('sha256').update(token).digest('hex') };
}

export const load = async ({ locals }) => {
	const [rows, locations] = await Promise.all([
		db
			.select({
				id: scannerDevice.id,
				name: scannerDevice.name,
				locationId: scannerDevice.locationId,
				location: enOf(location.name),
				lastSyncAt: scannerDevice.lastSyncAt,
				isActive: scannerDevice.isActive,
				createdById: scannerDevice.createdBy,
				createdBy: creator.name,
				createdAt: scannerDevice.createdAt,
				scans: db.$count(ticketScan, eq(ticketScan.deviceId, scannerDevice.id))
			})
			.from(scannerDevice)
			.leftJoin(location, eq(scannerDevice.locationId, location.id))
			.leftJoin(creator, eq(scannerDevice.createdBy, creator.id))
			.where(isNull(scannerDevice.deletedAt))
			.orderBy(asc(scannerDevice.name)),
		locationOptions()
	]);
	return {
		rows,
		locations,
		canManage: hasPermission(locals, 'visits.manage'),
		addForm: await superValidate(zod4(deviceSchema), { id: 'add' }),
		editForm: await superValidate(zod4(deviceEditSchema), { id: 'edit' })
	};
};

export const actions = {
	/** Registers a device; the reply carries its token, which is never shown again. */
	add: async (event) => {
		requirePermission(event.locals, 'visits.manage');
		const form = await superValidate(event.request, zod4(deviceSchema), { id: 'add' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { token, tokenHash } = newToken();
		await db.transaction(async (tx) => {
			const [res] = await tx
				.insert(scannerDevice)
				.values({ ...form.data, tokenHash, createdBy: event.locals.user?.id });
			await recordAudit(tx, event, {
				table: 'scanner_device',
				recordId: res.insertId,
				action: 'create'
			});
		});
		return message(form, {
			type: 'success',
			text: `${form.data.name} added`,
			token,
			device: form.data.name
		});
	},
	edit: async (event) => {
		requirePermission(event.locals, 'visits.manage');
		const form = await superValidate(event.request, zod4(deviceEditSchema), { id: 'edit' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { id, ...values } = form.data;
		const [before] = await db
			.select()
			.from(scannerDevice)
			.where(and(eq(scannerDevice.id, id), isNull(scannerDevice.deletedAt)));
		if (!before) return message(form, { type: 'error', text: 'Device not found' }, { status: 404 });
		await db.transaction(async (tx) => {
			await tx
				.update(scannerDevice)
				.set({ ...values, updatedBy: event.locals.user?.id })
				.where(eq(scannerDevice.id, id));
			await recordAudit(tx, event, {
				table: 'scanner_device',
				recordId: id,
				action: 'update',
				before,
				after: values
			});
		});
		return message(form, { type: 'success', text: 'Device saved' });
	},
	/** Switches the device off and replaces its token, so the old one can never sync again. */
	revoke: async (event) => {
		requirePermission(event.locals, 'visits.manage');
		const id = Number((await event.request.formData()).get('id'));
		const { tokenHash } = newToken();
		const [res] = await db
			.update(scannerDevice)
			.set({ isActive: false, tokenHash, updatedBy: event.locals.user?.id })
			.where(and(eq(scannerDevice.id, id), isNull(scannerDevice.deletedAt)));
		if (!res.affectedRows) return { message: { type: 'error', text: 'Device not found' } };
		await recordAudit(db, event, {
			table: 'scanner_device',
			recordId: id,
			action: 'update',
			detail: { revoked: true }
		});
		return { message: { type: 'success', text: 'Device revoked: its token no longer works' } };
	}
};
