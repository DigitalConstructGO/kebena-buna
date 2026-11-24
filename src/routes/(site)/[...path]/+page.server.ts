import { error } from '@sveltejs/kit';
import { pageAt, servedByCms } from '#lib/server/sitePages.ts';
import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/i18n.ts';
import type { PageServerLoad } from './$types';

/**
 * A page written in Website › Pages, at its own address: `/our-story`, `/visit/coffee-ceremony`.
 * Every route of the site's own comes first; this answers only what none of them does.
 */
export const load: PageServerLoad = async ({ params }) => {
	const path = params.path.replace(/\/+$/, '');
	const found = path && servedByCms(path) ? await pageAt(path, getLocale()) : null;
	if (!found) error(404, m.site_error_title_404());
	return { page: found };
};
