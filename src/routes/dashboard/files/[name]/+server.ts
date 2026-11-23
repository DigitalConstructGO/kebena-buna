import { createFileHandler } from '@nahu/admin-kit/server/serveFile';

/**
 * Serves uploaded files (`fileUrl(name)` from @nahu/admin-kit/files points here) to staff only.
 * The store holds trade licences and member photos, and customers can sign in too: being signed in
 * is not enough. A switched-off account, or one whose role is off, holds no permission either.
 */
export const GET = createFileHandler<App.Locals>({
	canRead: (locals) => locals.isSuperAdmin || locals.permList.length > 0
});
