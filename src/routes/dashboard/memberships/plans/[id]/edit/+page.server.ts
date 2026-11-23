import { error } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { postedForm, UploadRefused } from '@nahu/admin-kit/server/files';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { db } from '#lib/server/db/index.ts';
import { membershipPlan } from '#lib/server/db/schema.ts';
import { unpackLocalized } from '#lib/server/localized.ts';
import { idParam } from '#lib/server/records.ts';
import { taxRateOptions, variantOptions } from '#lib/server/options.ts';
import { PLAN_LOCALIZED, savePlan } from '#lib/server/plans.ts';
import { membershipPlanEditSchema } from '#lib/schemas/memberships.ts';

/** A plan's fields, on a page of their own: thirty-odd of them were an "Edit" dialog. */
async function found(raw: string) {
	const [p] = await db
		.select()
		.from(membershipPlan)
		.where(and(eq(membershipPlan.id, idParam(raw, 'Plan')), isNull(membershipPlan.deletedAt)));
	if (!p) error(404, 'Plan not found');
	return p;
}

export const load = async ({ params, locals }) => {
	requirePermission(locals, 'memberships.manage');
	const p = await found(params.id);
	const [taxRates, variants] = await Promise.all([taxRateOptions(), variantOptions()]);
	return {
		plan: { id: p.id, name: p.name, image: p.image },
		options: { taxRates, variants },
		form: await superValidate(
			{ ...unpackLocalized(p, PLAN_LOCALIZED), image: undefined },
			zod4(membershipPlanEditSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	default: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(membershipPlanEditSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const plan = await found(event.params.id);
		try {
			await savePlan(event, form.data, posted, plan.id);
		} catch (err) {
			if (err instanceof UploadRefused) {
				setError(form, 'image', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			if (isDuplicateKey(err)) {
				setError(form, 'code', 'A plan already has this code');
				return message(form, { type: 'error', text: 'A plan already has this code' }, { status: 400 });
			}
			throw err;
		}
		redirect(`/dashboard/memberships/plans/${plan.id}`, { type: 'success', message: 'Plan saved' }, event.cookies);
	}
};
