import { json } from '@sveltejs/kit';
import { fileUrl } from '@nahu/admin-kit/files';
import { saveUploadedFile, UploadRefused } from '@nahu/admin-kit/server/files';
import { hasPermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import { media } from '#lib/server/db/schema.ts';

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']);

/**
 * A picture put into a page or post with the editor's image button (`RichEditor`'s `uploadUrl`).
 * Stored like every upload, listed in the media library (folder `editor`), and answered with the
 * address the editor inserts. Refusals are `{ message }`, which the editor shows.
 */
export const POST = async ({ request, locals }) => {
	if (!hasPermission(locals, 'content.manage')) {
		return json({ message: 'You may not add pictures to website content.' }, { status: 403 });
	}
	const data = await request.formData().catch(() => null);
	const file = data?.get('file');
	if (!(file instanceof File) || !file.size) {
		return json({ message: 'Choose a picture to add.' }, { status: 400 });
	}
	if (!IMAGE_TYPES.has(file.type)) {
		return json({ message: 'Only pictures (JPEG, PNG, WebP, AVIF or GIF) can be added.' }, { status: 415 });
	}
	try {
		const fileName = await saveUploadedFile(file);
		await db.insert(media).values({
			fileName,
			mimeType: file.type,
			sizeBytes: file.size,
			folder: 'editor',
			createdBy: locals.user?.id
		});
		return json({ url: fileUrl(fileName) });
	} catch (err) {
		if (err instanceof UploadRefused) return json({ message: err.message }, { status: 400 });
		console.error('Editor picture upload failed:', err);
		return json({ message: 'The picture could not be saved. Try again.' }, { status: 500 });
	}
};
