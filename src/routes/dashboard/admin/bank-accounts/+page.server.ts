import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { bankAccount } from '#lib/server/db/schema.ts';
import { contentCrud } from '#lib/server/records.ts';
import { bankAccountEditSchema, bankAccountSchema } from '#lib/schemas/orders.ts';

/** The accounts buyers pay into by transfer, shown on their order's page with the receipt upload. */
const crud = contentCrud({
	table: bankAccount,
	permission: 'settings.manage',
	label: 'Bank account',
	addSchema: bankAccountSchema,
	editSchema: bankAccountEditSchema,
	audit: 'bank_account'
});

export const load = () => crud.load();
export const actions = { ...crud.actions, delete: lookupDeleteAction(bankAccount, 'bank account') };
