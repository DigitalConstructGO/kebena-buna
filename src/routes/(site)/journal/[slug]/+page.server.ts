import { error } from '@sveltejs/kit';
import { postBySlug } from '#lib/server/sitePages.ts';
import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/i18n.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const post = await postBySlug(params.slug, getLocale());
	if (!post) error(404, m.site_error_title_404());
	return { post };
};
