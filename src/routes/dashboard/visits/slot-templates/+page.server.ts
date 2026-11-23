import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { location, slotTemplate } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { locationOptions } from '#lib/server/options.ts';
import { slotTemplateEditSchema, slotTemplateSchema } from '#lib/schemas/visits.ts';
import { contentCrud } from '#lib/server/records.ts';

/**
 * The weekly slot pattern visit days are generated from (Visits › Visit days › Generate). Editing
 * it changes days generated afterwards, never the days that already exist.
 */
const crud = contentCrud({
	table: slotTemplate,
	permission: 'visits.manage',
	label: 'Slot',
	addSchema: slotTemplateSchema,
	editSchema: slotTemplateEditSchema,
	uniqueField: 'startsAt',
	references: [
		{
			field: 'locationId',
			table: location,
			as: 'location',
			nameColumn: enOf(location.name),
			options: () => locationOptions(),
			optionsKey: 'locationList'
		}
	]
});

export const load = async () => {
	const data = await crud.load();
	// The weekday picker's choices are strings; the column is a number.
	return {
		...data,
		rows: data.rows
			.map((r) => ({
				...r,
				weekday: String(r.weekday),
				startsAt: r.startsAt.slice(0, 5),
				endsAt: r.endsAt.slice(0, 5)
			}))
			.sort((a, b) => a.weekday.localeCompare(b.weekday) || a.startsAt.localeCompare(b.startsAt))
	};
};

export const actions = { ...crud.actions, delete: lookupDeleteAction(slotTemplate, 'slot') };
