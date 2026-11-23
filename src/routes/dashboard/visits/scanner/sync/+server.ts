import { error, json } from '@sveltejs/kit';
import { z } from 'zod/v4';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordScan, scannerDay } from '#lib/server/scanner.ts';

const syncSchema = z.object({
	scans: z
		.array(
			z.object({
				clientScanId: z.uuid(),
				raw: z.string().min(1).max(300),
				headcount: z.number().int().positive().max(999).optional(),
				scannedAt: z.string().max(40),
				wasOffline: z.boolean()
			})
		)
		.max(500)
});

/** A fresh copy of today's list, for a scanner coming back online. */
export const GET = async ({ locals }) => {
	requirePermission(locals, 'visits.view');
	return json(await scannerDay());
};

/**
 * The scanner's queue: every scan it made, oldest first. Each is settled on its own, so one bad
 * scan never blocks the rest; the reply says how each one landed.
 */
export const POST = async (event) => {
	requirePermission(event.locals, 'visits.view');
	const parsed = syncSchema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) error(400, 'Bad scan batch');
	const results = [];
	for (const scan of parsed.data.scans.toSorted((a, b) => a.scannedAt.localeCompare(b.scannedAt))) {
		results.push(await recordScan(event, scan));
	}
	return json({ results });
};
