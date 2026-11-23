import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { calendarException, location } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { locationOptions } from '#lib/server/options.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { calendarEditSchema, calendarSchema } from '#lib/schemas/admin.ts';

/** Days the weekly pattern does not hold: holidays, closures, special hours (questionnaire 6.5). */
const crud = localizedCrud({
	table: calendarException,
	permission: 'settings.manage',
	label: 'Holiday or closure',
	addSchema: calendarSchema,
	editSchema: calendarEditSchema,
	uniqueField: 'date',
	localized: ['name'],
	references: [
		{
			field: 'locationId',
			table: location,
			as: 'location',
			nameColumn: enOf(location.name),
			options: () => locationOptions(),
			optionsKey: 'locationList'
		}
	],
	transform: (values) => {
		// Times only mean something on a day that opens.
		if (values.isClosed) {
			values.opensAt = null;
			values.closesAt = null;
		}
		return values;
	}
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(calendarException, 'holiday') };
