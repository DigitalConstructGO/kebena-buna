import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { deliveryZone } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { zoneEditSchema, zoneSchema } from '#lib/schemas/customers.ts';

const crud = localizedCrud({
	table: deliveryZone,
	permission: 'delivery.manage',
	label: 'Delivery zone',
	addSchema: zoneSchema,
	editSchema: zoneEditSchema,
	uniqueField: 'code',
	localized: ['name']
});

export const load = () => crud.load();
export const actions = {
	...crud.actions,
	delete: lookupDeleteAction(deliveryZone, 'delivery zone')
};
