import { error } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { loadStory, type StoryMode } from '#lib/content/story.js';
import type { PageServerLoad } from './$types';

const MODES: StoryMode[] = ['demo', 'worst', 'empty', 'one'];

// built once as static HTML per language; served straight from the CDN
export const prerender = true;

export const load: PageServerLoad = async ({ url }) => {
	// the ?data= fixture switch is dev-only; reading the query string would block prerendering
	const m = import.meta.env.DEV ? (url.searchParams.get('data') as StoryMode | null) : null;
	const mode = import.meta.env.DEV && m && MODES.includes(m) ? m : 'demo';
	const { history } = await loadStory(getLocale(), mode);
	if (!history) error(404);
	return { section: history };
};
