import { eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { redirect } from 'sveltekit-flash-message/server';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import { location } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { locationOptions } from '#lib/server/options.ts';
import { invalid, refusedForm, saveLocation } from '#lib/server/admin.ts';
import { locationSchema } from '#lib/schemas/admin.ts';

const parent = alias(location, 'parent');

/** Every place that sells, holds stock, admits visitors or hosts bookings (questionnaire 1.2, 1.3). */
export const load = async () => {
	const rows = await db
		.select({
			id: location.id,
			code: location.code,
			name: enOf(location.name),
			type: location.type,
			parentId: location.parentId,
			parent: enOf(parent.name),
			address: location.address,
			holdsStock: location.holdsStock,
			sellsAtDesk: location.sellsAtDesk,
			fulfilsOnline: location.fulfilsOnline,
			isPickupPoint: location.isPickupPoint,
			admitsVisitors: location.admitsVisitors,
			isActive: location.isActive,
			children:
				sql<number>`(select count(*) from location c where c.parent_id = ${location.id} and c.deleted_at is null)`.mapWith(
					Number
				)
		})
		.from(location)
		.leftJoin(parent, eq(location.parentId, parent.id))
		.where(isNull(location.deletedAt))
		.orderBy(location.sortOrder);
	return {
		rows,
		parents: await locationOptions(),
		addForm: await superValidate({ type: 'shop', isActive: true }, zod4(locationSchema), {
			errors: false
		})
	};
};

export const actions = {
	add: async (event) => {
		requirePermission(event.locals, 'settings.manage');
		const form = await superValidate(event.request, zod4(locationSchema));
		if (!form.valid) return invalid(form);
		let id: number;
		try {
			id = await saveLocation(event, form.data);
		} catch (err) {
			return refusedForm(form, err);
		}
		redirect(
			`/dashboard/admin/locations/${id}`,
			{ type: 'success', message: 'Location added' },
			event.cookies
		);
	}
};
