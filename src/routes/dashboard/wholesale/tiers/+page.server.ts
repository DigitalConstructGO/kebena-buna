import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { wholesaleTier } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { tierEditSchema, tierSchema } from '#lib/schemas/wholesale.ts';

const crud = localizedCrud({
	table: wholesaleTier,
	permission: 'wholesale.manage',
	label: 'Quantity tier',
	addSchema: tierSchema,
	editSchema: tierEditSchema,
	localized: ['name']
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(wholesaleTier, 'quantity tier') };
