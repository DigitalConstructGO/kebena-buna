import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { auditLog, user } from '#lib/server/db/schema.ts';
import { idParam } from '#lib/server/records.ts';
import { AUDIT_ENTITY, changeRows } from '#lib/server/admin.ts';

/** One entry in full: who, when, the record, and every field before and after. */
export const load = async ({ params }) => {
	const [row] = await db
		.select({ entry: auditLog, userName: user.name })
		.from(auditLog)
		.leftJoin(user, eq(auditLog.userId, user.id))
		.where(eq(auditLog.id, idParam(params.id, 'Audit entry')));
	if (!row) error(404, 'Audit entry not found');
	const { changes, ...entry } = row.entry;
	return {
		entry,
		userName: row.userName,
		recordEntity: AUDIT_ENTITY[entry.tableName] ?? null,
		changes: changeRows(changes)
	};
};
