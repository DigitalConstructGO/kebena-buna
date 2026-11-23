import { error } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { db } from '#lib/server/db/index.ts';
import { product } from '#lib/server/db/schema.ts';
import { packLocalized, unpackLocalized } from '#lib/server/localized.ts';
import { idParam } from '#lib/server/records.ts';
import { categoryOptions, taxRateOptions } from '#lib/server/options.ts';
import { stockLevels } from '#lib/server/stockReads.ts';
import { productEditSchema } from '#lib/schemas/catalog.ts';
import { PRODUCT_TEXT } from '../../schema.ts';

/**
 * A product's own fields, on a page of their own. They were an "Edit" dialog on the product page:
 * forty-odd fields, most of them translations, in a modal that scrolled past the screen.
 */
async function found(raw: string) {
	const [p] = await db
		.select()
		.from(product)
		.where(and(eq(product.id, idParam(raw, 'Product')), isNull(product.deletedAt)));
	if (!p) error(404, 'Product not found');
	return p;
}

export const load = async ({ params, locals }) => {
	requirePermission(locals, 'catalog.manage');
	const p = await found(params.id);
	const [categories, taxRates, levels] = await Promise.all([categoryOptions(), taxRateOptions(), stockLevels()]);
	return {
		product: { id: p.id, name: p.name },
		form: await superValidate({ ...unpackLocalized(p, PRODUCT_TEXT) }, zod4(productEditSchema), { errors: false }),
		options: { categories, taxRates },
		roastedLowDefault: levels.roastedLow
	};
};

export const actions = {
	default: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const form = await superValidate(event.request, zod4(productEditSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		// The product is the one in the URL; the form's own id is not trusted to name it.
		const before = await found(event.params.id);
		const id = before.id;
		const { id: _id, ...values } = form.data;
		const row = packLocalized({ ...values }, PRODUCT_TEXT);
		try {
			await db.transaction(async (tx) => {
				await tx
					.update(product)
					.set({ ...(row as Partial<typeof product.$inferInsert>), updatedBy: event.locals.user?.id })
					.where(eq(product.id, id));
				await recordAudit(tx, event, { table: 'product', recordId: id, action: 'update', before, after: row });
			});
		} catch (err) {
			if (isDuplicateKey(err)) {
				setError(form, 'slug', 'Another product already has this address.');
				return message(form, { type: 'error', text: 'That address is taken' }, { status: 400 });
			}
			throw err;
		}
		redirect(`/dashboard/catalog/products/${id}`, { type: 'success', message: 'Product saved' }, event.cookies);
	}
};
