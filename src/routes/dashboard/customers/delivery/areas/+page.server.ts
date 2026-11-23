import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { deliveryArea, deliveryZone } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { deliveryZoneOptions } from '#lib/server/options.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { areaEditSchema, areaSchema } from '#lib/schemas/customers.ts';

const crud = localizedCrud({
	table: deliveryArea,
	permission: 'delivery.manage',
	label: 'Delivery area',
	addSchema: areaSchema,
	editSchema: areaEditSchema,
	localized: ['name'],
	references: [
		{
			field: 'zoneId',
			table: deliveryZone,
			as: 'zone',
			nameColumn: enOf(deliveryZone.name),
			options: deliveryZoneOptions,
			optionsKey: 'zoneList'
		}
	]
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(deliveryArea, 'delivery area') };
