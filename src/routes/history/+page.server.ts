import { error } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { loadStory, type StoryMode } from '#lib/content/story.js';
import type { PageServerLoad } from './$types';

const MODES: StoryMode[] = ['demo', 'worst', 'empty', 'one'];

export const load: PageServerLoad = async ({ url }) => {
	const m = url.searchParams.get('data') as StoryMode | null;
	const mode = import.meta.env.DEV && m && MODES.includes(m) ? m : 'demo';
	const { history } = await loadStory(getLocale(), mode);
	if (!history) error(404);
	return { section: history };
};
