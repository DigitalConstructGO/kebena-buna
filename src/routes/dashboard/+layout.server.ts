import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { roles, user } from '#lib/server/db/schema.ts';

export const load = async ({ locals, setHeaders }) => {
	// The kit's hook already refuses signed-out requests under /dashboard; this narrows the type.
	if (!locals.user) redirect(302, '/kc-login');
	// Never kept by the browser: Back after signing out must not show the last screen's figures.
	setHeaders({ 'cache-control': 'private, no-store' });

	const [account] = await db
		.select({ name: user.name, email: user.email, role: roles.name })
		.from(user)
		.leftJoin(roles, eq(user.roleId, roles.id))
		.where(eq(user.id, locals.user.id));

	return {
		permList: locals.permList,
		isSuperAdmin: locals.isSuperAdmin,
		account: {
			id: locals.user.id,
			name: account?.name ?? locals.user.name,
			email: account?.email ?? '',
			role: account?.role ?? ''
		},
		today: localToday()
	};
};
