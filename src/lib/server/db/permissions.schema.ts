import { relations } from 'drizzle-orm';
import { index, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { roles } from './auth.schema';
import { secureFields } from './fields';

/** Permission names, synced from `#lib/server/permissions.ts` once per boot (additive). */
export const permissions = mysqlTable('permissions', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 50 }).notNull().unique(),
	description: varchar('description', { length: 255 })
});

/**
 * Which permissions a role holds. `restrict`, not `cascade`: removing a role clears its links in
 * app code first, so a delete never takes grants with it silently.
 */
export const rolePermissions = mysqlTable(
	'role_permissions',
	{
		id: int('id').autoincrement().primaryKey(),
		roleId: int('role_id')
			.notNull()
			.references(() => roles.id, { onDelete: 'restrict' }),
		permissionId: int('permission_id')
			.notNull()
			.references(() => permissions.id, { onDelete: 'restrict' }),
		...secureFields
	},
	(table) => [index('role_permissions_role_idx').on(table.roleId, table.permissionId)]
);

export const rolesRelations = relations(roles, ({ many }) => ({
	rolePermissions: many(rolePermissions)
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
	rolePermissions: many(rolePermissions)
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
	role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	})
}));
