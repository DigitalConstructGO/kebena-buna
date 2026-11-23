import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, isNull, or, sum } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '#lib/server/db/index.ts';
import {
	calendarException,
	greenStock,
	location,
	openingHours,
	packedStock,
	roastMachine,
	roastedStock,
	scannerDevice
} from '#lib/server/db/schema.ts';
import { enOf, unpackLocalized } from '#lib/server/localized.ts';
import { stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { locationOptions } from '#lib/server/options.ts';
import { invalid, refusedForm, saveLocation } from '#lib/server/admin.ts';
import { hoursSchema, locationSchema } from '#lib/schemas/admin.ts';

async function loadLocation(raw: string) {
	const id = idParam(raw, 'Location');
	const [row] = await db
		.select()
		.from(location)
		.where(and(eq(location.id, id), isNull(location.deletedAt)));
	if (!row) error(404, 'Location not found');
	return row;
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/** The location and every one inside it, at any depth — none of them can be its parent. */
async function selfAndInside(id: number) {
	const rows = await db.select({ id: location.id, parentId: location.parentId }).from(location);
	const inside = new Set([id]);
	for (let grew = true; grew;) {
		grew = false;
		for (const r of rows) {
			if (r.parentId && inside.has(r.parentId) && !inside.has(r.id)) {
				inside.add(r.id);
				grew = true;
			}
		}
	}
	return inside;
}

export const load = async ({ params }) => {
	const l = await loadLocation(params.id);
	const [
		parent,
		children,
		hours,
		machines,
		devices,
		exceptions,
		[green],
		[roasted],
		[packed],
		stamps,
		parents
	] = await Promise.all([
		l.parentId
			? db
					.select({ id: location.id, name: enOf(location.name) })
					.from(location)
					.where(eq(location.id, l.parentId))
			: Promise.resolve([]),
		db
			.select({ id: location.id, name: enOf(location.name), type: location.type })
			.from(location)
			.where(and(eq(location.parentId, l.id), isNull(location.deletedAt))),
		db
			.select()
			.from(openingHours)
			.where(eq(openingHours.locationId, l.id))
			.orderBy(asc(openingHours.weekday)),
		db
			.select({
				id: roastMachine.id,
				name: roastMachine.name,
				capacityKg: roastMachine.capacityKg,
				status: roastMachine.status
			})
			.from(roastMachine)
			.where(and(eq(roastMachine.locationId, l.id), isNull(roastMachine.deletedAt))),
		db
			.select({
				id: scannerDevice.id,
				name: scannerDevice.name,
				lastSyncAt: scannerDevice.lastSyncAt,
				isActive: scannerDevice.isActive
			})
			.from(scannerDevice)
			.where(and(eq(scannerDevice.locationId, l.id), isNull(scannerDevice.deletedAt))),
		db
			.select({
				id: calendarException.id,
				date: calendarException.date,
				name: enOf(calendarException.name),
				isClosed: calendarException.isClosed,
				isHoliday: calendarException.isHoliday,
				everywhere: isNull(calendarException.locationId)
			})
			.from(calendarException)
			.where(
				and(
					or(eq(calendarException.locationId, l.id), isNull(calendarException.locationId)),
					isNull(calendarException.deletedAt)
				)
			)
			.orderBy(desc(calendarException.date)),
		db
			.select({ kg: sum(greenStock.kg).mapWith(Number) })
			.from(greenStock)
			.where(eq(greenStock.locationId, l.id)),
		db
			.select({ kg: sum(roastedStock.kg).mapWith(Number) })
			.from(roastedStock)
			.where(eq(roastedStock.locationId, l.id)),
		db
			.select({ units: sum(packedStock.units).mapWith(Number) })
			.from(packedStock)
			.where(eq(packedStock.locationId, l.id)),
		stampsOf(l),
		locationOptions()
	]);
	const inside = await selfAndInside(l.id);

	const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
		const h = hours.find((x) => x.weekday === weekday);
		return {
			weekday,
			isClosed: h?.isClosed ?? false,
			opensAt: hhmm(h?.opensAt ?? null),
			closesAt: hhmm(h?.closesAt ?? null),
			lastEntryAt: hhmm(h?.lastEntryAt ?? null)
		};
	});

	return {
		location: l,
		parent: parent[0] ?? null,
		children,
		hasHours: hours.length > 0,
		machines,
		devices,
		exceptions,
		stock: { green: green?.kg ?? 0, roasted: roasted?.kg ?? 0, packed: packed?.units ?? 0 },
		stamps,
		parents: parents.filter((p) => !inside.has(p.value)),
		editForm: await superValidate(unpackLocalized(l, ['name']), zod4(locationSchema), {
			errors: false
		}),
		hoursForm: await superValidate({ days }, zod4(hoursSchema), { id: 'hours' })
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'settings.manage');
		const l = await loadLocation(event.params.id);
		const form = await superValidate(event.request, zod4(locationSchema));
		if (!form.valid) return invalid(form);
		if (form.data.parentId && (await selfAndInside(l.id)).has(form.data.parentId))
			return refusedForm(
				form,
				new WriteRefused('parentId', 'A location cannot sit inside itself or a place within it.')
			);
		try {
			await saveLocation(event, form.data, l.id);
		} catch (err) {
			return refusedForm(form, err);
		}
		return message(form, { type: 'success', text: 'Location saved' });
	},
	hours: async (event) => {
		requirePermission(event.locals, 'settings.manage');
		const l = await loadLocation(event.params.id);
		const form = await superValidate(event.request, zod4(hoursSchema), { id: 'hours' });
		if (!form.valid) return invalid(form);
		const bad = form.data.days.find(
			(d) => !d.isClosed && (!d.opensAt || !d.closesAt || d.opensAt >= d.closesAt)
		);
		if (bad)
			return message(
				form,
				{ type: 'error', text: 'Every open day needs an opening time before its closing time.' },
				{ status: 400 }
			);
		await db.transaction(async (tx) => {
			await tx.delete(openingHours).where(eq(openingHours.locationId, l.id));
			await tx.insert(openingHours).values(
				form.data.days.map((d) => ({
					locationId: l.id,
					weekday: d.weekday,
					isClosed: d.isClosed,
					opensAt: d.isClosed ? null : d.opensAt,
					closesAt: d.isClosed ? null : d.closesAt,
					lastEntryAt: d.isClosed ? null : (d.lastEntryAt ?? null)
				}))
			);
			await recordAudit(tx, event, {
				table: 'location',
				recordId: l.id,
				action: 'update',
				detail: { openingHours: 'changed' }
			});
		});
		return message(form, { type: 'success', text: 'Opening hours saved' });
	}
};
