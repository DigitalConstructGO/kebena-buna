import { eq } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '#lib/server/db/index.ts';
import { roles, user } from '#lib/server/db/schema.ts';
import { auth } from '#lib/server/auth.ts';
import { accountSchema, changePasswordSchema } from '#lib/schemas/admin.ts';
import { invalid } from '#lib/server/admin.ts';

/** The signed-in person's own account: their name, and their password. */
export const load = async ({ locals }) => {
	const me = locals.user!;
	const [row] = await db
		.select({
			name: user.name,
			email: user.email,
			role: roles.name,
			locale: user.locale,
			createdAt: user.createdAt
		})
		.from(user)
		.leftJoin(roles, eq(user.roleId, roles.id))
		.where(eq(user.id, me.id));
	return {
		me: row,
		nameForm: await superValidate({ name: row.name }, zod4(accountSchema), { id: 'name' }),
		passwordForm: await superValidate(zod4(changePasswordSchema), { id: 'password' })
	};
};

export const actions = {
	name: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(accountSchema), { id: 'name' });
		if (!form.valid) return invalid(form);
		await db.update(user).set({ name: form.data.name }).where(eq(user.id, locals.user!.id));
		return message(form, { type: 'success', text: 'Name saved' });
	},
	password: async ({ request }) => {
		const form = await superValidate(request, zod4(changePasswordSchema), { id: 'password' });
		if (!form.valid) return invalid(form);
		try {
			await auth.api.changePassword({
				body: {
					currentPassword: form.data.currentPassword,
					newPassword: form.data.newPassword,
					revokeOtherSessions: true
				},
				headers: request.headers
			});
		} catch {
			setError(form, 'currentPassword', 'That is not your current password.');
			return message(form, { type: 'error', text: 'Not changed' }, { status: 400 });
		}
		form.data = { currentPassword: '', newPassword: '', confirm: '' };
		return message(form, {
			type: 'success',
			text: 'Password changed; other devices were signed out'
		});
	}
};
