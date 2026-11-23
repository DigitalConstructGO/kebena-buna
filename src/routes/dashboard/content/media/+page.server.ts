import { stat } from 'node:fs/promises';
import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { mimeFor, resolveStoredFile } from '@nahu/admin-kit/server/files';
import { media } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { namesOf } from '#lib/server/people.ts';
import { mediaEditSchema, mediaSchema } from '#lib/schemas/content.ts';

/** The size of a stored file, or 0 when it is not on this server (seeded rows, another machine). */
async function sizeOf(name: string) {
	const path = resolveStoredFile(name);
	return path ? ((await stat(path).catch(() => null))?.size ?? 0) : 0;
}

/** The media library. A new upload records its type and size; an edit without one keeps the file. */
const crud = localizedCrud({
	table: media,
	permission: 'content.manage',
	label: 'File',
	addSchema: mediaSchema,
	editSchema: mediaEditSchema,
	uniqueField: 'fileName',
	fileFields: ['fileName'],
	localized: ['alt', 'caption'],
	transform: async (values) => {
		if (typeof values.fileName === 'string') {
			values.mimeType = mimeFor(values.fileName);
			values.sizeBytes = await sizeOf(values.fileName);
		}
		return values;
	}
});

export const load = async () => {
	const data = await crud.load();
	const names = await namesOf(data.rows.map((r) => r.createdBy as string | null));
	return {
		...data,
		rows: data.rows.map((r) => ({
			...r,
			// The table's label column, and what the edit dialog is titled: a picture dropped into an
			// editor has no alt text yet, so its file name stands in until one is written.
			altEn: (r.altEn as string) || String(r.fileName),
			folderName: (r.folder as string | null) ?? 'Unfiled',
			uploader: r.createdBy ? (names[r.createdBy as string] ?? null) : null
		}))
	};
};
export const actions = { ...crud.actions, delete: lookupDeleteAction(media, 'file') };
