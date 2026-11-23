import { homeData } from '#lib/server/dashboard.ts';

export const load = async ({ locals }) => homeData(locals);
