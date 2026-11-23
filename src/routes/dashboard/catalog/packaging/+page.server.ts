import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { packaging } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { packagingEditSchema, packagingSchema } from '#lib/schemas/catalog.ts';

const crud = localizedCrud({
	table: packaging,
	permission: 'catalog.manage',
	label: 'Packaging',
	addSchema: packagingSchema,
	editSchema: packagingEditSchema,
	uniqueField: 'code',
	localized: ['name']
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(packaging, 'packaging') };
