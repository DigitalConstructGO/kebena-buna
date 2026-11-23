/**
 * Who did what: the sign-ins behind `created_by`, `updated_by`, `roaster_id`, `assigned_to` …
 *
 * Lists join an alias of `user` per column (`creator`, `updater`, or `userAlias('roaster')`) and
 * pass the id and name to `user(id, name)` in `#lib/cells`, which links to the person's page for a
 * viewer who may open it. Detail pages call `stampsOf(row)` for the created/updated lines.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';

export const creator = alias(user, 'creator');
export const updater = alias(user, 'updater');
export const userAlias = (name: string) => alias(user, name);

/** Names of the given user ids. Unknown and empty ids are left out. */
export async function namesOf(ids: (string | null | undefined)[]): Promise<Record<string, string>> {
	const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
	if (!wanted.length) return {};
	const rows = await db
		.select({ id: user.id, name: user.name })
		.from(user)
		.where(inArray(user.id, wanted));
	return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

export type Stamps = {
	createdById: string | null;
	createdByName: string | null;
	createdAt: Date | string | null;
	updatedById: string | null;
	updatedByName: string | null;
	updatedAt: Date | string | null;
};

/** The created/updated lines of a `secureFields` row, with the people's names. */
export async function stampsOf(row: {
	createdBy?: string | null;
	updatedBy?: string | null;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
}): Promise<Stamps> {
	const names = await namesOf([row.createdBy, row.updatedBy]);
	return {
		createdById: row.createdBy ?? null,
		createdByName: row.createdBy ? (names[row.createdBy] ?? null) : null,
		createdAt: row.createdAt ?? null,
		updatedById: row.updatedBy ?? null,
		updatedByName: row.updatedBy ? (names[row.updatedBy] ?? null) : null,
		updatedAt: row.updatedAt ?? null
	};
}

/** Staff sign-ins as picker options. */
export async function staffOptions() {
	return db
		.select({ value: user.id, name: user.name })
		.from(user)
		.where(and(eq(user.kind, 'staff'), eq(user.isActive, true), isNull(user.deletedAt)))
		.orderBy(user.name);
}
