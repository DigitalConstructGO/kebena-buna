import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { variety } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { varietyEditSchema, varietySchema } from '#lib/schemas/origins.ts';

const crud = localizedCrud({
	table: variety,
	permission: 'origins.manage',
	label: 'Variety',
	addSchema: varietySchema,
	editSchema: varietyEditSchema,
	localized: ['description']
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(variety, 'variety') };
