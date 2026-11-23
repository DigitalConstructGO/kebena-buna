import { periodOf, reportData } from '#lib/server/reports.ts';

export const load = async ({ url, locals }) => reportData(locals, periodOf(url));
