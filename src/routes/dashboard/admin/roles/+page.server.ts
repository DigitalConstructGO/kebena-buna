import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { roleSchema } from '#lib/schemas/admin.ts';
import { addRole, invalid, listRoles, refusedForm } from '#lib/server/admin.ts';

export const load = async () => ({
	rows: await listRoles(),
	addForm: await superValidate({ status: true }, zod4(roleSchema), { errors: false })
});

export const actions = {
	add: async (event) => {
		requirePermission(event.locals, 'users.manage');
		const form = await superValidate(event.request, zod4(roleSchema));
		if (!form.valid) return invalid(form);
		try {
			await addRole(event, form.data);
		} catch (err) {
			return refusedForm(form, err);
		}
		return message(form, {
			type: 'success',
			text: `${form.data.name} added — now tick what it may do`
		});
	}
};
