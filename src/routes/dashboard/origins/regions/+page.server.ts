import { and, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '#lib/server/db/index.ts';
import { region } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { regionOptions } from '#lib/server/options.ts';
import { regionEditSchema, regionSchema } from '#lib/schemas/origins.ts';

const parent = alias(region, 'parent');

/** Oromia › Jimma › Limu: one tree. A region may not be its own parent, nor sit under a child. */
async function refuseCycle(id: number | undefined, parentId: number | null | undefined) {
	if (!id || !parentId) return;
	let at: number | null = parentId;
	for (let depth = 0; at && depth < 20; depth++) {
		if (at === id) throw new WriteRefused('parentId', 'A region cannot sit inside itself.');
		const [row] = await db
			.select({ parentId: region.parentId })
			.from(region)
			.where(and(eq(region.id, at), isNull(region.deletedAt)));
		at = row?.parentId ?? null;
	}
}

const crud = localizedCrud({
	table: region,
	permission: 'origins.manage',
	label: 'Region',
	addSchema: regionSchema,
	editSchema: regionEditSchema,
	uniqueField: 'nameEn',
	localized: ['name', 'story'],
	references: [
		{
			field: 'parentId',
			table: parent,
			as: 'parent',
			nameColumn: enOf(parent.name),
			options: regionOptions,
			optionsKey: 'regionList'
		}
	],
	transform: async (values, _event, before) => {
		await refuseCycle(before?.id as number | undefined, values.parentId as number | null);
		return values;
	}
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(region, 'region') };
