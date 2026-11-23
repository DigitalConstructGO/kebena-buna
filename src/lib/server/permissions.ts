/**
 * What a signed-in user may do, and keeping the permission and role tables in step with the code.
 *
 * - `loadGrant`: the user's role's permissions, read on every request. A switched-off account, or
 *   an inactive or deleted role, confers nothing. The Owner role holds every permission in
 *   `PERMISSIONS` and makes its holder a super admin; no other role does, whatever it holds.
 * - `syncAccessTables`: on boot, writes every permission in `PERMISSIONS`, creates the default
 *   roles that do not exist yet, and gives the Owner role every permission. Never removes a grant
 *   the Owner made.
 */
import { and, eq } from 'drizzle-orm';
import { notDeleted } from '@nahu/admin-kit/server/softDelete';
import { PERMISSIONS } from '#lib/access.ts';
import { db } from '#lib/server/db/index.ts';
import { permissions, rolePermissions, roles, user } from '#lib/server/db/schema.ts';
import { DEFAULT_ROLES, OWNER, permissionsOf } from '#lib/server/roles.ts';

export type Grant = { permList: string[]; isSuperAdmin: boolean };

const NONE: Grant = { permList: [], isSuperAdmin: false };

export async function loadGrant(userId: string): Promise<Grant> {
	const [holder] = await db
		.select({ roleId: roles.id, role: roles.name })
		.from(user)
		.innerJoin(roles, and(eq(user.roleId, roles.id), eq(roles.isActive, true), notDeleted(roles)))
		.where(and(eq(user.id, userId), notDeleted(user), eq(user.isActive, true)));
	if (!holder) return NONE;
	if (holder.role === OWNER) return { permList: PERMISSIONS.map((p) => p.name), isSuperAdmin: true };

	const rows = await db
		.select({ name: permissions.name })
		.from(rolePermissions)
		.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
		.where(and(eq(rolePermissions.roleId, holder.roleId), notDeleted(rolePermissions)));
	// Only names the code knows, and never super admin: that is the Owner role's alone, so a role
	// ticked with every permission still cannot assign the Owner role or touch an Owner's account.
	const known = new Set<string>(PERMISSIONS.map((p) => p.name));
	const permList = [...new Set(rows.map((r) => r.name))].filter((name) => known.has(name));
	return { permList, isSuperAdmin: false };
}

/** See the module comment. Returns how many permissions and roles it created. */
export async function syncAccessTables(): Promise<{ permissions: number; roles: number }> {
	let createdPermissions = 0;
	let createdRoles = 0;

	await db.transaction(async (tx) => {
		const existing = await tx.select().from(permissions);
		const byName = new Map(existing.map((p) => [p.name, p]));
		for (const p of PERMISSIONS) {
			const row = byName.get(p.name);
			if (!row) {
				await tx.insert(permissions).values({ name: p.name, description: p.description });
				createdPermissions++;
			} else if (row.description !== p.description) {
				await tx
					.update(permissions)
					.set({ description: p.description })
					.where(eq(permissions.id, row.id));
			}
		}

		const all = await tx.select().from(permissions);
		const idOf = new Map(all.map((p) => [p.name, p.id]));

		for (const def of DEFAULT_ROLES) {
			let [role] = await tx.select().from(roles).where(eq(roles.name, def.name));
			if (role) continue;
			const [res] = await tx.insert(roles).values({ name: def.name, description: def.description });
			[role] = await tx.select().from(roles).where(eq(roles.id, res.insertId));
			const ids = permissionsOf(def).flatMap((n) => (idOf.has(n) ? [idOf.get(n)!] : []));
			if (ids.length) {
				await tx
					.insert(rolePermissions)
					.values(ids.map((permissionId) => ({ roleId: role.id, permissionId })));
			}
			createdRoles++;
		}

		// The Owner role holds every permission, including ones added by a later release.
		const [owner] = await tx.select().from(roles).where(eq(roles.name, OWNER));
		if (owner) {
			const held = new Set(
				(
					await tx
						.select({ id: rolePermissions.permissionId })
						.from(rolePermissions)
						.where(eq(rolePermissions.roleId, owner.id))
				).map((r) => r.id)
			);
			const missing = all.filter((p) => !held.has(p.id));
			if (missing.length) {
				await tx
					.insert(rolePermissions)
					.values(missing.map((p) => ({ roleId: owner.id, permissionId: p.id })));
			}
		}
	});

	return { permissions: createdPermissions, roles: createdRoles };
}
