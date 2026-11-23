import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { notificationTemplate } from '#lib/server/db/schema.ts';
import { templateEditSchema, templateSchema } from '#lib/schemas/admin.ts';
import { contentCrud } from '#lib/server/records.ts';

/** Message wording per event, channel and language (questionnaire 3.3, 7.4, 8.5). */
const crud = contentCrud({
	table: notificationTemplate,
	permission: 'messages.manage',
	label: 'Template',
	addSchema: templateSchema,
	editSchema: templateEditSchema,
	uniqueField: 'key'
});

export const load = () => crud.load();
export const actions = {
	...crud.actions,
	delete: lookupDeleteAction(notificationTemplate, 'template')
};
