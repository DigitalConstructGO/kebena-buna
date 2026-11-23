import { asc, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { postedForm, UploadRefused } from '@nahu/admin-kit/server/files';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { db } from '#lib/server/db/index.ts';
import { membership, membershipPlan } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { taxRateOptions, variantOptions } from '#lib/server/options.ts';
import { savePlan } from '#lib/server/plans.ts';
import { membershipPlanSchema } from '#lib/schemas/memberships.ts';

export const load = async ({ locals }) => {
	const canManage = hasPermission(locals, 'memberships.manage');
	const rows = await db
		.select({
			id: membershipPlan.id,
			code: membershipPlan.code,
			name: enOf(membershipPlan.name),
			price: membershipPlan.price,
			durationMonths: membershipPlan.durationMonths,
			maxAdults: membershipPlan.maxAdults,
			maxChildren: membershipPlan.maxChildren,
			shopDiscountPct: membershipPlan.shopDiscountPct,
			publishStatus: membershipPlan.publishStatus,
			isActive: membershipPlan.isActive,
			active: sql<number>`(select count(*) from ${membership} m where m.plan_id = ${membershipPlan.id} and m.status in ('active', 'grace') and m.deleted_at is null)`.mapWith(Number)
		})
		.from(membershipPlan)
		.where(isNull(membershipPlan.deletedAt))
		.orderBy(asc(membershipPlan.sortOrder));
	return {
		rows,
		canManage,
		form: await superValidate(zod4(membershipPlanSchema)),
		options: canManage
			? { taxRates: await taxRateOptions(), variants: await variantOptions() }
			: { taxRates: [], variants: [] }
	};
};

export const actions = {
	add: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(membershipPlanSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		let id: number;
		try {
			id = await savePlan(event, form.data, posted);
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
		redirect(`/dashboard/memberships/plans/${id}`, { type: 'success', message: 'Plan added' }, event.cookies);
	}
};

