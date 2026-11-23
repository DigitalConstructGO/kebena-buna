import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { courier } from '#lib/server/db/schema.ts';
import { courierEditSchema, courierSchema } from '#lib/schemas/customers.ts';
import { contentCrud } from '#lib/server/records.ts';

const crud = contentCrud({
	table: courier,
	permission: 'delivery.manage',
	label: 'Courier',
	addSchema: courierSchema,
	editSchema: courierEditSchema
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(courier, 'courier') };
