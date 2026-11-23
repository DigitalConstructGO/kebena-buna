import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.ts';

/** Sign out: a POST from the user menu. A GET just goes home. */
export const load = () => redirect(302, '/');

export const actions = {
	default: async (event) => {
		await auth.api.signOut({ headers: event.request.headers });
		redirect(303, '/login');
	}
};
