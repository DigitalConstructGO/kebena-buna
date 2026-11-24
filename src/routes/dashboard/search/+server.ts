import { error, json } from '@sveltejs/kit';
import { searchRecords } from '#lib/server/search.ts';

/**
 * The top bar's record search: `?q=`, grouped by kind, only what the viewer may open. An endpoint
 * is not under the dashboard layout's sign-in check, so it makes its own.
 */
export const GET = async ({ locals, url }) => {
	if (!locals.user) error(401, 'Sign in first');
	return json({ groups: await searchRecords(locals, url.searchParams.get('q') ?? '') });
};
