import { and, eq, ne } from 'drizzle-orm';
import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { taxRate } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { taxEditSchema, taxSchema } from '#lib/schemas/admin.ts';

/** VAT and any later tax. Lines copy the rate when sold, so a change never rewrites a receipt (2.6). */
const crud = localizedCrud({
	table: taxRate,
	permission: 'settings.manage',
	label: 'Tax rate',
	addSchema: taxSchema,
	editSchema: taxEditSchema,
	uniqueField: 'code',
	localized: ['name'],
	audit: 'tax_rate',
	moneyFields: ['rate'],
	/** One default: choosing one takes it off the others. */
	afterWrite: async (tx, { id, data }) => {
		if (data.isDefault) await tx.update(taxRate).set({ isDefault: false }).where(and(ne(taxRate.id, id), eq(taxRate.isDefault, true)));
	}
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(taxRate, 'tax rate') };
