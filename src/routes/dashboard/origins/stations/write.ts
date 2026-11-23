import type { RequestEvent } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { db } from '#lib/server/db/index.ts';
import { station } from '#lib/server/db/schema.ts';
import { packLocalized } from '#lib/server/localized.ts';
import { setStationCertifications } from '#lib/server/origins.ts';
import { stationSchema } from '#lib/schemas/origins.ts';

/** A new station, from the list's dialog; then its own page. */
export async function addStation(event: RequestEvent) {
	requirePermission(event.locals, 'origins.manage');
	const form = await superValidate(event.request, zod4(stationSchema));
	if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
	const { certificationIds, ...values } = form.data;
	let id: number;
	try {
		id = await db.transaction(async (tx) => {
			const [res] = await tx.insert(station).values({
				...packLocalized({ ...values }, ['name', 'story']),
				createdBy: event.locals.user?.id
			} as unknown as typeof station.$inferInsert);
			await setStationCertifications(tx, res.insertId, certificationIds);
			await recordAudit(tx, event, { table: 'station', recordId: res.insertId, action: 'create' });
			return res.insertId;
		});
	} catch (err) {
		if (isDuplicateKey(err)) {
			setError(form, 'code', 'Another station has this code.');
			return message(form, { type: 'error', text: 'That code is taken' }, { status: 400 });
		}
		throw err;
	}
	redirect(
		`/dashboard/origins/stations/${id}`,
		{ type: 'success', message: 'Station added' },
		event.cookies
	);
}
