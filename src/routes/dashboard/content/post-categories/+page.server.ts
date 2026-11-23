import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { postCategory } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { postCategoryEditSchema, postCategorySchema } from '#lib/schemas/content.ts';

const crud = localizedCrud({
	table: postCategory,
	permission: 'content.manage',
	label: 'Post category',
	addSchema: postCategorySchema,
	editSchema: postCategoryEditSchema,
	uniqueField: 'slug',
	localized: ['name']
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(postCategory, 'post category') };
