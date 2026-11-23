import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { addUserSchema } from '#lib/schemas/admin.ts';
import { roleOptions } from '#lib/server/options.ts';
import { addStaff, invalid, listUsers, refusedForm } from '#lib/server/admin.ts';

/** Everyone who may sign in: staff, with the role that decides what they may do, and customers. */
export const load = async () => {
	const [rows, roles, addForm] = await Promise.all([
		listUsers(),
		roleOptions(),
		superValidate(zod4(addUserSchema))
	]);
	return { rows, roles, addForm };
};

export const actions = {
	add: async (event) => {
		requirePermission(event.locals, 'users.manage');
		const form = await superValidate(event.request, zod4(addUserSchema));
		if (!form.valid) return invalid(form);
		try {
			await addStaff(event, form.data);
		} catch (err) {
			return refusedForm(form, err);
		}
		// The password goes back once, in this answer only, so the screen can show it to be handed
		// over. It is not left in the form and never appears in a page load.
		const credentials = {
			name: form.data.name,
			email: form.data.email.trim().toLowerCase(),
			password: form.data.password
		};
		form.data.password = '';
		form.message = { type: 'success', text: `${form.data.name} can now sign in` };
		return { form, credentials };
	}
};
