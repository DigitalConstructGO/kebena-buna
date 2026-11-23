import { error } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { loadStory, type StoryMode } from '#lib/content/story.js';
import type { PageServerLoad } from './$types';

const MODES: StoryMode[] = ['demo', 'worst', 'empty', 'one'];

// Rendered on each request, not prerendered: its words can be edited in Website › Site text.
export const load: PageServerLoad = async ({ url }) => {
	// the ?data= stress-fixture switch is dev-only
	const m = import.meta.env.DEV ? (url.searchParams.get('data') as StoryMode | null) : null;
	const mode = m && MODES.includes(m) ? m : 'demo';
	const { kingdoms } = await loadStory(getLocale(), mode);
	if (!kingdoms) error(404);
	return { section: kingdoms };
};
