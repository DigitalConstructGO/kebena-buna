import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { grind } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { grindEditSchema, grindSchema } from '#lib/schemas/catalog.ts';

const crud = localizedCrud({
	table: grind,
	permission: 'catalog.manage',
	label: 'Grind',
	addSchema: grindSchema,
	editSchema: grindEditSchema,
	uniqueField: 'code',
	localized: ['name']
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(grind, 'grind') };
