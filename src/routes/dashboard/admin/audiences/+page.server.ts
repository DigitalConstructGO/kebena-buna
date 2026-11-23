import { and, eq, ne } from 'drizzle-orm';
import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { audience } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { audienceEditSchema, audienceSchema } from '#lib/schemas/admin.ts';

/** Who a price is for: resident, foreign visitor, and whatever comes later (6.1, 8.1). */
const crud = localizedCrud({
	table: audience,
	permission: 'settings.manage',
	label: 'Audience',
	addSchema: audienceSchema,
	editSchema: audienceEditSchema,
	uniqueField: 'code',
	localized: ['name', 'declaration'],
	/** One default: choosing one takes it off the others. */
	afterWrite: async (tx, { id, data }) => {
		if (data.isDefault) await tx.update(audience).set({ isDefault: false }).where(and(ne(audience.id, id), eq(audience.isDefault, true)));
	}
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(audience, 'audience') };
