import { fail, type RequestEvent } from '@sveltejs/kit';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { idSchema } from '@nahu/admin-kit/server/crud';
import { requirePermission, requireSuperAdmin } from '@nahu/admin-kit/server/permissions';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '#lib/server/db/index.ts';
import { language } from '#lib/server/db/schema.ts';
import { invalid, refusedForm } from '#lib/server/admin.ts';
import { languageEditSchema, languageSchema } from '#lib/schemas/admin.ts';

/**
 * The languages content is written in (questionnaire 1.1). Keyed by code, so the kit's
 * `LookupPage` is given the code as each row's id and these actions write by it.
 */
export const load = async () => {
	const rows = await db
		.select()
		.from(language)
		.where(isNull(language.deletedAt))
		.orderBy(asc(language.sortOrder));
	return {
		rows: rows.map((r) => ({ ...r, id: r.code as unknown as number })),
		addForm: await superValidate(zod4(languageSchema)),
		editForm: await superValidate(zod4(languageEditSchema)),
		deleteForm: await superValidate(zod4(idSchema))
	};
};

type Values = Omit<typeof language.$inferInsert, 'deletedAt' | 'deletedBy'>;

async function write(event: RequestEvent, values: Values, was?: string) {
	await db.transaction(async (tx) => {
		// One default language: choosing one takes it off the others.
		if (values.isDefault)
			await tx.update(language).set({ isDefault: false }).where(ne(language.code, values.code));
		if (was) await tx.update(language).set(values).where(eq(language.code, was));
		else await tx.insert(language).values(values);
		await recordAudit(tx, event, {
			table: 'language',
			recordId: values.code,
			action: was ? 'update' : 'create'
		});
	});
}

/** The default language is the one the site falls back to, so it has to be switched on. */
const OFF_DEFAULT = 'The default language cannot be switched off.';

export const actions = {
	add: async (event) => {
		requirePermission(event.locals, 'settings.manage');
		const form = await superValidate(event.request, zod4(languageSchema));
		if (!form.valid) return invalid(form);
		if (form.data.isDefault && !form.data.status)
			return refusedForm(form, new WriteRefused('status', OFF_DEFAULT));
		const [taken] = await db.select().from(language).where(eq(language.code, form.data.code));
		if (taken && !taken.deletedAt)
			return message(
				form,
				{ type: 'error', text: 'That language is already listed.' },
				{ status: 400 }
			);
		const values = { ...form.data, deletedAt: null, deletedBy: null };
		if (taken) await write(event, values, taken.code);
		else await write(event, form.data);
		return message(form, { type: 'success', text: `${form.data.name} added` });
	},
	edit: async (event) => {
		requirePermission(event.locals, 'settings.manage');
		const form = await superValidate(event.request, zod4(languageEditSchema));
		if (!form.valid) return invalid(form);
		const { id, ...values } = form.data;
		const [current] = await db
			.select({ isDefault: language.isDefault })
			.from(language)
			.where(eq(language.code, id));
		// Another language takes over by being made the default; this one cannot just let go.
		if (current?.isDefault && !values.isDefault)
			return refusedForm(
				form,
				new WriteRefused('isDefault', 'Make another language the default instead.')
			);
		if (values.isDefault && !values.status)
			return refusedForm(form, new WriteRefused('status', OFF_DEFAULT));
		if (values.code !== id) {
			const [taken] = await db.select().from(language).where(eq(language.code, values.code));
			if (taken)
				return message(
					form,
					{ type: 'error', text: 'Another language has that code.' },
					{ status: 400 }
				);
		}
		await write(event, values, id);
		return message(form, { type: 'success', text: `${values.name} saved` });
	},
	delete: async (event) => {
		requireSuperAdmin(event.locals);
		const code = String((await event.request.formData()).get('id') ?? '');
		const [row] = await db
			.select()
			.from(language)
			.where(and(eq(language.code, code), isNull(language.deletedAt)));
		if (!row) return fail(404, { message: { type: 'error', text: 'No such language' } });
		if (row.isDefault)
			return fail(400, {
				message: { type: 'error', text: 'Choose another default language first.' }
			});
		await db
			.update(language)
			.set(deletionStamp(event.locals.user?.id))
			.where(eq(language.code, code));
		return { message: { type: 'success', text: `${row.name} removed` } };
	}
};
