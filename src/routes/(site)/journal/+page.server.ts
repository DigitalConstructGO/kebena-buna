import { journal } from '#lib/server/sitePages.ts';
import type { PageServerLoad } from './$types';

/** The journal: published posts, newest first; `?c=` one category, `?page=` further back. */
export const load: PageServerLoad = async ({ url }) =>
	journal({
		category: url.searchParams.get('c'),
		page: Number(url.searchParams.get('page')) || 1
	});
