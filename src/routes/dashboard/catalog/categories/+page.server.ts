import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { productCategory } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { categoryEditSchema, categorySchema } from '#lib/schemas/catalog.ts';

const crud = localizedCrud({
	table: productCategory,
	permission: 'catalog.manage',
	label: 'Category',
	addSchema: categorySchema,
	editSchema: categoryEditSchema,
	uniqueField: 'slug',
	localized: ['name', 'description']
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(productCategory, 'category') };
