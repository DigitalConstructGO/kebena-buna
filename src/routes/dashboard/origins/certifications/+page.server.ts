import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { certification } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { certificationEditSchema, certificationSchema } from '#lib/schemas/origins.ts';

const crud = localizedCrud({
	table: certification,
	permission: 'origins.manage',
	label: 'Certification',
	addSchema: certificationSchema,
	editSchema: certificationEditSchema,
	uniqueField: 'code',
	fileFields: ['logo'],
	localized: ['name']
});

export const load = () => crud.load();
export const actions = {
	...crud.actions,
	delete: lookupDeleteAction(certification, 'certification')
};
