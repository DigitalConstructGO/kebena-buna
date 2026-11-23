import { desc, eq, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { db } from '#lib/server/db/index.ts';
import { bundle } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { creator } from '#lib/server/people.ts';
import { bundleContents, bundleRow, bundleTotals, timesSoldOf } from '#lib/server/bundles.ts';
import { bundleSchema } from '#lib/schemas/catalog.ts';

export const load = async ({ locals }) => {
	const rows = await db
		.select({
			id: bundle.id,
			name: enOf(bundle.name),
			slug: bundle.slug,
			pricing: bundle.pricing,
			value: bundle.value,
			startsAt: bundle.startsAt,
			endsAt: bundle.endsAt,
			stacksWithDiscounts: bundle.stacksWithDiscounts,
			isMemberOnly: bundle.isMemberOnly,
			publishStatus: bundle.publishStatus,
			isActive: bundle.isActive,
			sold: timesSoldOf,
			createdById: bundle.createdBy,
			createdBy: creator.name
		})
		.from(bundle)
		.leftJoin(creator, eq(bundle.createdBy, creator.id))
		.where(isNull(bundle.deletedAt))
		.orderBy(bundle.sortOrder, desc(bundle.id));
	const contents = await bundleContents(rows.map((r) => r.id));
	return {
		rows: rows.map((r) => ({
			...r,
			...bundleTotals(
				{ pricing: r.pricing, value: Number(r.value) },
				contents.filter((c) => c.bundleId === r.id)
			)
		})),
		canManage: hasPermission(locals, 'catalog.manage'),
		addForm: await superValidate(
			{ pricing: 'percent_off', publishStatus: 'draft', isActive: true },
			zod4(bundleSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	add: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const form = await superValidate(event.request, zod4(bundleSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		let id: number;
		try {
			id = await db.transaction(async (tx) => {
				const [res] = await tx.insert(bundle).values({
					...bundleRow({ ...form.data }),
					createdBy: event.locals.user?.id
				} as typeof bundle.$inferInsert);
				await recordAudit(tx, event, { table: 'bundle', recordId: res.insertId, action: 'create' });
				return res.insertId;
			});
		} catch (err) {
			if (!isDuplicateKey(err)) throw err;
			setError(form, 'slug', 'Another bundle already has this address.');
			return message(form, { type: 'error', text: 'That address is taken' }, { status: 400 });
		}
		redirect(
			`/dashboard/catalog/bundles/${id}`,
			{ type: 'success', message: 'Bundle added — now say what goes in it' },
			event.cookies
		);
	}
};
