import { publicFaq } from '#lib/server/sitePages.ts';
import type { PageServerLoad } from './$types';

/** The knowledge base's questions marked for the public FAQ, by topic. */
export const load: PageServerLoad = async () => ({ topics: await publicFaq() });
