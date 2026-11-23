import { relations, sql } from 'drizzle-orm';
import {
	mysqlTable,
	varchar,
	text,
	timestamp,
	datetime,
	boolean,
	int,
	index,
	uniqueIndex,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { USER_KINDS } from '../../constants';

/**
 * Identity is owned by better-auth, but `user` also carries this app's own columns, so the file is
 * written by hand rather than generated: `npm run auth:schema` would overwrite them. Anything
 * better-auth must read back is declared again under `user.additionalFields` in
 * `#lib/server/auth.ts`.
 *
 * Ids are `varchar(255)` because the kit's `createdBy`/`deletedBy` columns are, and MySQL refuses
 * a foreign key whose types differ.
 *
 * A `user` is a sign-in only. Customers' commercial data lives on `customer` (which also exists for
 * guests with no sign-in); staff permissions come from `roles`.
 */
export const user = mysqlTable(
	'user',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		name: varchar('name', { length: 255 }).notNull(),
		/** better-auth requires one; the phone-number plugin fills a placeholder for phone-only sign-ups. */
		email: varchar('email', { length: 255 }).notNull().unique(),
		emailVerified: boolean('email_verified').default(false).notNull(),
		image: text('image'),

		/** Customer or staff. A sign-up is always a customer; staff are made from the admin panel. */
		kind: varchar('kind', { length: 16, enum: USER_KINDS }).notNull().default('customer'),
		/** Staff: the role whose permissions they hold. Null for customers, who get none. */
		roleId: int('role_id').references((): AnyMySqlColumn => roles.id, { onDelete: 'restrict' }),

		/** better-auth `phoneNumber` plugin: customers sign in with phone + SMS OTP (questionnaire 3.1). */
		phoneNumber: varchar('phone_number', { length: 20 }).unique(),
		phoneNumberVerified: boolean('phone_number_verified').default(false).notNull(),
		/** better-auth `twoFactor` plugin: required for Owner and Manager roles (questionnaire 5.1). */
		twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),

		/** Language for messages, receipts and the admin: a code from `language`. */
		locale: varchar('locale', { length: 8 }).notNull().default('am'),
		/** The Telegram user id, for the bot (Phase 2). */
		telegramId: varchar('telegram_id', { length: 20 }),
		/** The sign-in gate: a switched-off account cannot sign in or act. Distinct from deletion. */
		isActive: boolean('is_active').default(true).notNull(),

		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.$onUpdate(() => new Date())
			.notNull(),
		// The kit's `deletionFields`, written inline: that mixin references this table.
		deletedAt: datetime('deleted_at'),
		deletedBy: varchar('deleted_by', { length: 255 })
	},
	(table) => [
		index('user_kind_idx').on(table.kind),
		index('user_role_idx').on(table.roleId),
		index('user_telegram_idx').on(table.telegramId)
	]
);

export const session = mysqlTable(
	'session',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
		token: varchar('token', { length: 255 }).notNull().unique(),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { fsp: 3 })
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: varchar('user_id', { length: 255 })
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_userId_idx').on(table.userId)]
);

export const account = mysqlTable(
	'account',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		// varchar, not the generator's text: sign-in looks rows up by this pair.
		accountId: varchar('account_id', { length: 255 }).notNull(),
		providerId: varchar('provider_id', { length: 255 }).notNull(),
		userId: varchar('user_id', { length: 255 })
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { fsp: 3 }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { fsp: 3 }),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { fsp: 3 })
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('account_userId_idx').on(table.userId),
		uniqueIndex('account_provider_account_idx').on(table.providerId, table.accountId)
	]
);

export const verification = mysqlTable(
	'verification',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		identifier: varchar('identifier', { length: 255 }).notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { fsp: 3 })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

/** better-auth `twoFactor` plugin's secrets. */
export const twoFactor = mysqlTable(
	'two_factor',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		secret: text('secret').notNull(),
		backupCodes: text('backup_codes').notNull(),
		userId: varchar('user_id', { length: 255 })
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('two_factor_userId_idx').on(table.userId)]
);

/** Staff roles. Their permissions are rows in `role_permissions`. */
export const roles = mysqlTable('roles', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 32 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	isActive: boolean('is_active').default(true).notNull(),
	// Inline for the same reason as on `user`.
	deletedAt: datetime('deleted_at'),
	deletedBy: varchar('deleted_by', { length: 255 }).references((): AnyMySqlColumn => user.id, {
		onDelete: 'set null'
	})
});

export const userRelations = relations(user, ({ one, many }) => ({
	role: one(roles, { fields: [user.roleId], references: [roles.id] }),
	sessions: many(session),
	accounts: many(account)
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] })
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] })
}));
