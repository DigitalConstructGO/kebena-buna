import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { bagSize } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { bagSizeEditSchema, bagSizeSchema } from '#lib/schemas/catalog.ts';

const crud = localizedCrud({
	table: bagSize,
	permission: 'catalog.manage',
	label: 'Bag size',
	addSchema: bagSizeSchema,
	editSchema: bagSizeEditSchema,
	uniqueField: 'code',
	localized: ['name']
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(bagSize, 'bag size') };
