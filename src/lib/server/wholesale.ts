/** Business accounts (questionnaire 11): what their lists show, and the maker-checker release. */
import { sql } from 'drizzle-orm';
import { businessAccount, businessMember, order } from '#lib/server/db/schema.ts';

export const memberCountOf =
	sql<number>`(select count(*) from ${businessMember} bm where bm.business_account_id = ${businessAccount.id} and bm.deleted_at is null)`.mapWith(
		Number
	);

export const orderCountOf =
	sql<number>`(select count(*) from ${order} o where o.business_account_id = ${businessAccount.id})`.mapWith(
		Number
	);

/**
 * Who may release an application: never the person who entered it — unless they are a super
 * admin, and then the release is marked overridden so the exception stays on the record.
 */
export function releaseCheck(
	requestedBy: string | null,
	userId: string | undefined,
	isSuperAdmin: boolean
): { allowed: boolean; overridden: boolean } {
	const own = Boolean(requestedBy && requestedBy === userId);
	if (!own) return { allowed: true, overridden: false };
	return isSuperAdmin ? { allowed: true, overridden: true } : { allowed: false, overridden: false };
}
