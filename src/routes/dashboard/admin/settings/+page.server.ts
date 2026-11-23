import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { idSchema } from '@nahu/admin-kit/server/crud';
import { requirePermission, requireSuperAdmin } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { z } from 'zod/v4';
import { db } from '#lib/server/db/index.ts';
import { setting, user } from '#lib/server/db/schema.ts';
import { invalid } from '#lib/server/admin.ts';
import { settingSchema } from '#lib/schemas/admin.ts';

const editSchema = settingSchema.extend({ id: z.string() });

/**
 * Every number the business may change without a deploy (questionnaire: "anything the client might
 * change later is a setting"). Defaults live in code; a row here overrides one. Values are JSON.
 */
export const load = async () => {
	const rows = await db
		.select({
			key: setting.key,
			value: setting.value,
			description: setting.description,
			updatedById: setting.updatedBy,
			updatedBy: user.name,
			updatedAt: setting.updatedAt
		})
		.from(setting)
		.leftJoin(user, eq(setting.updatedBy, user.id))
		.orderBy(asc(setting.key));
	return {
		rows: rows.map((r) => ({
			...r,
			id: r.key as unknown as number,
			value: JSON.stringify(r.value)
		})),
		addForm: await superValidate(zod4(settingSchema)),
		editForm: await superValidate(zod4(editSchema)),
		deleteForm: await superValidate(zod4(idSchema))
	};
};

export const actions = {
	add: async (event) => {
		requirePermission(event.locals, 'settings.manage');
		const form = await superValidate(event.request, zod4(settingSchema));
		if (!form.valid) return invalid(form);
		const [taken] = await db
			.select({ key: setting.key })
			.from(setting)
			.where(eq(setting.key, form.data.key));
		if (taken)
			return message(
				form,
				{ type: 'error', text: 'That setting exists: edit it instead.' },
				{ status: 400 }
			);
		await db.transaction(async (tx) => {
			await tx.insert(setting).values({
				key: form.data.key,
				value: JSON.parse(form.data.value),
				description: form.data.description ?? null,
				updatedBy: event.locals.user?.id
			});
			await recordAudit(tx, event, {
				table: 'setting',
				recordId: form.data.key,
				action: 'create',
				detail: { value: form.data.value }
			});
		});
		return message(form, { type: 'success', text: `${form.data.key} added` });
	},
	edit: async (event) => {
		requirePermission(event.locals, 'settings.manage');
		const form = await superValidate(event.request, zod4(editSchema));
		if (!form.valid) return invalid(form);
		const { id, key, value, description } = form.data;
		const [before] = await db.select().from(setting).where(eq(setting.key, id));
		if (!before)
			return message(
				form,
				{ type: 'error', text: 'This setting no longer exists.' },
				{ status: 404 }
			);
		if (key !== id) {
			const [taken] = await db
				.select({ key: setting.key })
				.from(setting)
				.where(eq(setting.key, key));
			if (taken) {
				setError(form, 'key', 'Another setting has this key');
				return message(
					form,
					{ type: 'error', text: 'Another setting has this key: edit that one instead.' },
					{ status: 400 }
				);
			}
		}
		const after = { key, value: JSON.parse(value), description: description ?? null };
		await db.transaction(async (tx) => {
			await tx
				.update(setting)
				.set({ ...after, updatedBy: event.locals.user?.id })
				.where(eq(setting.key, id));
			await recordAudit(tx, event, {
				table: 'setting',
				recordId: key,
				action: 'update',
				before,
				after
			});
		});
		return message(form, { type: 'success', text: `${key} saved` });
	},
	/** Removing an override puts the code's default back. */
	delete: async (event) => {
		requireSuperAdmin(event.locals);
		const key = String((await event.request.formData()).get('id') ?? '');
		const [row] = await db.select().from(setting).where(eq(setting.key, key));
		if (!row) return fail(404, { message: { type: 'error', text: 'No such setting' } });
		await db.transaction(async (tx) => {
			await tx.delete(setting).where(eq(setting.key, key));
			await recordAudit(tx, event, {
				table: 'setting',
				recordId: key,
				action: 'delete',
				detail: { value: row.value }
			});
		});
		return { message: { type: 'success', text: `${key} removed — the default applies` } };
	}
};
