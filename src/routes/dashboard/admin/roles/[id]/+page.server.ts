import { error } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { requirePermission, requireSuperAdmin } from '@nahu/admin-kit/server/permissions';
import { permissionsSchema, roleSchema } from '#lib/schemas/admin.ts';
import { OWNER } from '#lib/server/roles.ts';
import {
	allPermissions,
	deleteRole,
	findRole,
	invalid,
	refusedForm,
	refusedPlain,
	roleHolders,
	rolePermissionIds,
	setRolePermissions,
	updateRole
} from '#lib/server/admin.ts';

async function liveRole(raw: string) {
	const role = await findRole(Number(raw));
	if (!role) error(404, 'No such role');
	return role;
}

export const load = async ({ params, locals }) => {
	const role = await liveRole(params.id);
	const [permissions, granted, holders] = await Promise.all([
		allPermissions(),
		rolePermissionIds(role.id),
		roleHolders(role.id)
	]);
	return {
		role,
		holders,
		canDelete: locals.isSuperAdmin,
		permissions,
		isOwner: role.name === OWNER,
		editForm: await superValidate(
			{ name: role.name, description: role.description, status: role.isActive },
			zod4(roleSchema)
		),
		permissionsForm: await superValidate({ permissionIds: granted }, zod4(permissionsSchema), {
			id: 'grants'
		})
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'users.manage');
		const role = await liveRole(event.params.id);
		const form = await superValidate(event.request, zod4(roleSchema));
		if (!form.valid) return invalid(form);
		try {
			await updateRole(event, role.id, form.data);
		} catch (err) {
			return refusedForm(form, err);
		}
		return message(form, { type: 'success', text: 'Role updated' });
	},
	permissions: async (event) => {
		requirePermission(event.locals, 'users.manage');
		const role = await liveRole(event.params.id);
		const form = await superValidate(event.request, zod4(permissionsSchema), { id: 'grants' });
		if (!form.valid) return invalid(form);
		let held: number;
		try {
			held = await setRolePermissions(event, role.id, form.data.permissionIds);
		} catch (err) {
			return refusedForm(form, err);
		}
		return message(form, {
			type: 'success',
			text: `${role.name} now has ${held} permission${held === 1 ? '' : 's'}. It applies at their next page.`
		});
	},
	/** Like every delete, an Owner's alone. */
	delete: async (event) => {
		requireSuperAdmin(event.locals);
		const role = await liveRole(event.params.id);
		try {
			await deleteRole(event, role.id);
		} catch (err) {
			return refusedPlain(err);
		}
		redirect('/dashboard/admin/roles', { type: 'success', message: `The ${role.name} role was deleted` }, event.cookies);
	}
};
