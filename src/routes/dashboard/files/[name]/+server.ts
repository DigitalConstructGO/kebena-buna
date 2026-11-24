import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { streamStoredFile } from '@nahu/admin-kit/server/serveFile';
import { db } from '#lib/server/db/index.ts';
import { businessAccount, membershipMember, payment } from '#lib/server/db/schema.ts';
import type { Permission } from '#lib/access.ts';
import type { RequestHandler } from './$types';

/**
 * The uploads that hold someone's private papers, and who may open them: a bank-transfer
 * receipt is for whoever handles orders, a trade licence for wholesale, a member's photo for
 * memberships. Being on the staff is not enough for these.
 */
const PRIVATE: { permission: Permission; holds: (name: string) => Promise<unknown[]> }[] = [
	{
		permission: 'orders.view',
		holds: (name) =>
			db.select({ id: payment.id }).from(payment).where(eq(payment.receiptFile, name)).limit(1)
	},
	{
		permission: 'wholesale.view',
		holds: (name) =>
			db
				.select({ id: businessAccount.id })
				.from(businessAccount)
				.where(eq(businessAccount.tradeLicenceFile, name))
				.limit(1)
	},
	{
		permission: 'memberships.view',
		holds: (name) =>
			db
				.select({ id: membershipMember.id })
				.from(membershipMember)
				.where(eq(membershipMember.photo, name))
				.limit(1)
	}
];

/**
 * Who may open `name`. A private upload needs the permission of a section it belongs to; any
 * other file (catalogue pictures, media, an upload not yet saved to a record) any staff member with
 * a role. A refusal is a 404, so the answer does not confirm that the file exists.
 */
async function mayRead(locals: App.Locals, name: string) {
	if (locals.isSuperAdmin) return true;
	if (!locals.permList.length) return false;
	const owners = await Promise.all(
		PRIVATE.map(async (p) => ((await p.holds(name)).length ? p.permission : null))
	);
	const needed = owners.filter((p): p is Permission => p !== null);
	return !needed.length || needed.some((p) => locals.permList.includes(p));
}

/**
 * Serves uploaded files (`fileUrl(name)` from @nahu/admin-kit/files points here) to staff only.
 * Signed-out requests never get here: the kit's hook sends them to sign in.
 */
export const GET: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || !(await mayRead(locals, params.name))) error(404, 'Not found');
	return streamStoredFile(params.name, request, 'private');
};
