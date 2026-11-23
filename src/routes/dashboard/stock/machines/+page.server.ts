import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { location, roastMachine } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stockLocationOptions } from '#lib/server/options.ts';
import { machineEditSchema, machineSchema } from '#lib/schemas/stock.ts';
import { contentCrud } from '#lib/server/records.ts';

const crud = contentCrud({
	table: roastMachine,
	permission: 'stock.manage',
	label: 'Roasting machine',
	addSchema: machineSchema,
	editSchema: machineEditSchema,
	references: [
		{
			field: 'locationId',
			table: location,
			as: 'location',
			nameColumn: enOf(location.name),
			options: stockLocationOptions,
			optionsKey: 'locationList'
		}
	]
});

export const load = () => crud.load();
export const actions = {
	...crud.actions,
	delete: lookupDeleteAction(roastMachine, 'roasting machine')
};
