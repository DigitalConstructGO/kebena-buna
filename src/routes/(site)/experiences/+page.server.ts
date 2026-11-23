import { experiences } from '#lib/server/experiences.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ experiences: await experiences() });
