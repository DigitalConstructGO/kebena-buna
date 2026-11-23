import { redirect } from 'sveltekit-flash-message/server';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { db } from '#lib/server/db/index.ts';
import { product } from '#lib/server/db/schema.ts';
import { packLocalized, toRichLocalized } from '#lib/server/localized.ts';
import { setProductOptions } from '#lib/server/catalog.ts';
import {
	categoryOptions,
	grindOptions,
	packagingOptions,
	roastLevelOptions,
	taxRateOptions
} from '#lib/server/options.ts';
import { PRODUCT_TEXT, productNewSchema } from '../schema.ts';
import { stockLevels } from '#lib/server/stockReads.ts';

export const load = async ({ locals }) => {
	requirePermission(locals, 'catalog.manage');
	const [categories, taxRates, roastLevels, grinds, packagings] = await Promise.all([
		categoryOptions(),
		taxRateOptions(),
		roastLevelOptions(),
		grindOptions(),
		packagingOptions()
	]);
	return {
		roastedLowDefault: (await stockLevels()).roastedLow,
		form: await superValidate(
			{
				kind: 'coffee',
				fulfilment: 'from_stock',
				publishStatus: 'draft',
				dispatchDays: 1,
				isSubscribable: true,
				taxRateId: taxRates[0]?.value ?? null,
				roastLevelIds: roastLevels.map((r) => r.value),
				grindIds: grinds.map((g) => g.value),
				packagingIds: packagings.slice(0, 1).map((p) => p.value)
			},
			zod4(productNewSchema),
			{ errors: false }
		),
		options: { categories, taxRates, roastLevels, grinds, packagings }
	};
};

export const actions = {
	default: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const form = await superValidate(event.request, zod4(productNewSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });

		const {
			roastLevelIds,
			defaultRoastLevelId,
			grindIds,
			defaultGrindId,
			packagingIds,
			defaultPackagingId,
			descriptionEn,
			descriptionAm,
			descriptionOm,
			descriptionAr,
			descriptionIt,
			descriptionFr,
			...values
		} = form.data;
		let id: number;
		try {
			id = await db.transaction(async (tx) => {
				const [res] = await tx.insert(product).values({
					...packLocalized({ ...values }, PRODUCT_TEXT),
					description: toRichLocalized(
						{
							descriptionEn,
							descriptionAm,
							descriptionOm,
							descriptionAr,
							descriptionIt,
							descriptionFr
						},
						'description'
					),
					createdBy: event.locals.user?.id
				} as unknown as typeof product.$inferInsert);
				await setProductOptions(tx, res.insertId, {
					roastLevelIds,
					defaultRoastLevelId,
					grindIds,
					defaultGrindId,
					packagingIds,
					defaultPackagingId
				});
				await recordAudit(tx, event, {
					table: 'product',
					recordId: res.insertId,
					action: 'create'
				});
				return res.insertId;
			});
		} catch (err) {
			if (isDuplicateKey(err)) {
				setError(form, 'slug', 'Another product already has this address.');
				return message(form, { type: 'error', text: 'That address is taken' }, { status: 400 });
			}
			throw err;
		}
		redirect(
			`/dashboard/catalog/products/${id}`,
			{ type: 'success', message: 'Product added — now add its sizes and prices' },
			event.cookies
		);
	}
};
