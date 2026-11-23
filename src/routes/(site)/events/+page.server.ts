import { upcomingEvents } from '#lib/server/siteEvents.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ events: await upcomingEvents() });
