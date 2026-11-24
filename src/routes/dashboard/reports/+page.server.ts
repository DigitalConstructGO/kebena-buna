import { periodOf, reportData } from '#lib/server/reports.ts';
import { readSetting } from '#lib/server/stockReads.ts';

export const load = async ({ url, locals }) => {
	const [report, lossRange] = await Promise.all([
		reportData(locals, periodOf(url)),
		// What a roast may lose and still look right: the same band the roasts page flags with.
		readSetting('roast.loss_range', { min: 12, max: 20 })
	]);
	return { ...report, lossRange };
};
