import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { roastLevel } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { roastLevelEditSchema, roastLevelSchema } from '#lib/schemas/catalog.ts';

const crud = localizedCrud({
	table: roastLevel,
	permission: 'catalog.manage',
	label: 'Roast level',
	addSchema: roastLevelSchema,
	editSchema: roastLevelEditSchema,
	uniqueField: 'code',
	localized: ['name', 'description']
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(roastLevel, 'roast level') };
