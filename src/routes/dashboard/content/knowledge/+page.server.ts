import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { knowledgeEntry } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { knowledgeEditSchema, knowledgeSchema } from '#lib/schemas/content.ts';

/**
 * The AI agent's knowledge base and the public FAQ. Any save clears `embeddingUpdatedAt`, which is
 * what tells the indexer the entry must be embedded again.
 */
const crud = localizedCrud({
	table: knowledgeEntry,
	permission: 'content.manage',
	label: 'Entry',
	addSchema: knowledgeSchema,
	editSchema: knowledgeEditSchema,
	uniqueField: 'topic',
	listFields: ['tags'],
	localized: ['question', 'answer'],
	transform: (values) => ({ ...values, embeddingUpdatedAt: null })
});

export const load = async () => {
	const data = await crud.load();
	return {
		...data,
		rows: data.rows.map((r) => ({
			...r,
			// One per line in the form, as `listFields` reads them back.
			tags: Array.isArray(r.tags) ? (r.tags as string[]).join('\n') : '',
			tagList: Array.isArray(r.tags) ? (r.tags as string[]).join(', ') : '',
			publicFaq: r.isPublicFaq ? 'On the FAQ page' : 'Agent only',
			embedded: r.embeddingUpdatedAt ? 'Embedded' : 'Needs embedding'
		}))
	};
};
export const actions = { ...crud.actions, delete: lookupDeleteAction(knowledgeEntry, 'entry') };
