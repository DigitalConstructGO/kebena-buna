import { redirect } from 'sveltekit-flash-message/server';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import { lot } from '#lib/server/db/schema.ts';
import { packLocalized } from '#lib/server/localized.ts';
import { nextLotCode, setLotLinks } from '#lib/server/origins.ts';
import {
	certificationOptions,
	regionOptions,
	stationOptions,
	varietyOptions
} from '#lib/server/options.ts';
import { lotSchema } from '#lib/schemas/origins.ts';
import { stockLevels } from '#lib/server/stockReads.ts';

export const load = async ({ locals }) => {
	requirePermission(locals, 'origins.manage');
	const [stations, regions, varieties, certifications] = await Promise.all([
		stationOptions(),
		regionOptions(),
		varietyOptions(),
		certificationOptions()
	]);
	return {
		greenLowDefault: (await stockLevels()).greenLow,
		form: await superValidate(
			{ cropYear: new Date().getFullYear(), process: 'washed' },
			zod4(lotSchema),
			{ errors: false }
		),
		options: { stations, regions, varieties, certifications }
	};
};

export const actions = {
	default: async (event) => {
		requirePermission(event.locals, 'origins.manage');
		const form = await superValidate(event.request, zod4(lotSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });

		const { varietyIds, certificationIds, ...values } = form.data;
		let made: { id: number; code: string };
		try {
			made = await db.transaction(async (tx) => {
				const code = await nextLotCode(tx, values.stationId, values.cropYear);
				const [res] = await tx.insert(lot).values({
					...packLocalized({ ...values }, ['tastingNotes', 'story']),
					code,
					createdBy: event.locals.user?.id
				} as typeof lot.$inferInsert);
				await setLotLinks(tx, res.insertId, varietyIds, certificationIds);
				await recordAudit(tx, event, { table: 'lot', recordId: res.insertId, action: 'create' });
				return { id: res.insertId, code };
			});
		} catch (err) {
			if (err instanceof WriteRefused) {
				if (err.field) setError(form, err.field as never, err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			throw err;
		}
		const { id, code } = made;
		redirect(
			`/dashboard/origins/lots/${id}`,
			{ type: 'success', message: `Lot ${code} recorded` },
			event.cookies
		);
	}
};
