/**
 * The writes and reads behind Admin: staff accounts, roles and their grants, and naming the audit
 * trail's records. Every write that changes who may do what is audited.
 */
import { fail } from '@sveltejs/kit';
import { and, desc, eq, inArray, isNull, max, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { message, setError, type SuperValidated } from 'sveltekit-superforms';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { deletionStamp, notDeleted } from '@nahu/admin-kit/server/softDelete';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import {
	account,
	auditLog,
	location,
	permissions,
	rolePermissions,
	roles,
	session,
	user
} from '#lib/server/db/schema.ts';
import { PERMISSIONS } from '#lib/access.ts';
import { OWNER } from '#lib/server/roles.ts';
import { packLocalized } from '#lib/server/localized.ts';
import { ENTITIES } from '#lib/navigation.ts';

type Message = { type: 'success' | 'error'; text: string };

// ── Answers ──────────────────────────────────────────────────────────────────────────────────

/** For a superforms action: a refusal under its field and as the form's message; rethrows anything else. */
export function refusedForm<T extends Record<string, unknown>>(
	form: SuperValidated<T, Message>,
	err: unknown
) {
	if (err instanceof WriteRefused) {
		if (err.field) setError(form, err.field as never, err.message);
		return message(form, { type: 'error', text: err.message }, { status: 400 });
	}
	throw err;
}

/** For a plain action (`ConfirmAction`, `DeleteEntity`): the refusal as the message the root layout toasts. */
export function refusedPlain(err: unknown) {
	if (err instanceof WriteRefused) {
		return fail(400, { message: { type: 'error', text: err.message } satisfies Message });
	}
	throw err;
}

export function invalid<T extends Record<string, unknown>>(form: SuperValidated<T, Message>) {
	return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
}

// ── Who may change whom ──────────────────────────────────────────────────────────────────────
//
// `users.manage` opens Admin › Users and Roles, but on its own it must not be a way up: only a
// super admin (an Owner) may make an Owner, change an Owner's account or delete a role. Everyone
// else may give a role, or act on an account, only where it confers nothing they do not hold
// themselves, and may not change their own role.

/** The permission names a role confers: every one for the Owner, none for a deleted one. */
async function grantedNames(roleId: number): Promise<string[]> {
	const role = await findRole(roleId);
	if (!role) return [];
	if (role.name === OWNER) return PERMISSIONS.map((p) => p.name);
	const rows = await db
		.select({ name: permissions.name })
		.from(rolePermissions)
		.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
		.where(and(eq(rolePermissions.roleId, roleId), notDeleted(rolePermissions)));
	const known = new Set<string>(PERMISSIONS.map((p) => p.name));
	return rows.map((r) => r.name).filter((name) => known.has(name));
}

/** The names in `names` the signed-in user does not hold. */
const notHeld = (event: RequestEvent, names: readonly string[]) =>
	event.locals.isSuperAdmin ? [] : names.filter((n) => !event.locals.permList.includes(n));

async function ownRoleId(event: RequestEvent) {
	const id = event.locals.user?.id;
	if (!id) return null;
	const [row] = await db.select({ roleId: user.roleId }).from(user).where(eq(user.id, id));
	return row?.roleId ?? null;
}

/** A role the signed-in user may give someone: live, switched on, and nothing beyond their own. */
async function assignableRole(event: RequestEvent, roleId: number) {
	const role = await findRole(roleId);
	if (!role || !role.isActive) throw new WriteRefused('roleId', 'Pick a role that is switched on.');
	if (event.locals.isSuperAdmin) return role;
	if (role.name === OWNER)
		throw new WriteRefused('roleId', 'Only an Owner may make someone an Owner.');
	const missing = notHeld(event, await grantedNames(role.id));
	if (missing.length)
		throw new WriteRefused(
			'roleId',
			`This role can do things you cannot (${missing.join(', ')}): ask an Owner.`
		);
	return role;
}

/** Refuses unless the signed-in user may change `target`'s account, password or sessions. */
export async function assertMayManageUser(event: RequestEvent, target: { roleId: number | null }) {
	if (event.locals.isSuperAdmin || target.roleId === null) return;
	const role = await findRole(target.roleId);
	if (role?.name === OWNER)
		throw new WriteRefused(null, "Only an Owner may change an Owner's account.");
	const missing = notHeld(event, await grantedNames(target.roleId));
	if (missing.length)
		throw new WriteRefused(
			null,
			`This account can do things you cannot (${missing.join(', ')}): ask an Owner.`
		);
}

/** Refuses unless the signed-in user may change `role`: not their own, nothing beyond their own. */
async function assertMayManageRole(event: RequestEvent, role: { id: number; name: string }) {
	if (event.locals.isSuperAdmin) return;
	if (role.name === OWNER) throw new WriteRefused(null, 'Only an Owner may change the Owner role.');
	if ((await ownRoleId(event)) === role.id)
		throw new WriteRefused(null, 'You cannot change your own role.');
	const missing = notHeld(event, await grantedNames(role.id));
	if (missing.length)
		throw new WriteRefused(
			null,
			`This role can do things you cannot (${missing.join(', ')}): ask an Owner.`
		);
}

// ── Users ────────────────────────────────────────────────────────────────────────────────────

const lastSeen = sql<Date | null>`(select max(${session.updatedAt}) from ${session} where ${session.userId} = ${user.id})`;

export async function listUsers() {
	return db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			phone: user.phoneNumber,
			kind: user.kind,
			roleId: user.roleId,
			role: roles.name,
			isActive: user.isActive,
			twoFactor: user.twoFactorEnabled,
			createdAt: user.createdAt,
			lastSeen
		})
		.from(user)
		.leftJoin(roles, eq(user.roleId, roles.id))
		.where(isNull(user.deletedAt))
		.orderBy(desc(sql`${user.kind} = 'staff'`), user.name);
}

export async function findUser(id: string) {
	const [row] = await db
		.select({ user, role: roles.name })
		.from(user)
		.leftJoin(roles, eq(user.roleId, roles.id))
		.where(and(eq(user.id, id), isNull(user.deletedAt)));
	return row ?? null;
}

async function emailTaken(email: string, except?: string) {
	const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
	return Boolean(row && row.id !== except);
}

export async function addStaff(
	event: RequestEvent,
	data: { name: string; email: string; phone?: string | null; roleId: number; password: string }
) {
	const email = data.email.trim().toLowerCase();
	if (await emailTaken(email))
		throw new WriteRefused('email', 'Someone already signs in with this email.');
	await assignableRole(event, data.roleId);
	const id = randomUUID();
	const hash = await hashPassword(data.password);
	await db.transaction(async (tx) => {
		await tx.insert(user).values({
			id,
			name: data.name,
			email,
			emailVerified: true,
			kind: 'staff',
			roleId: data.roleId,
			phoneNumber: data.phone ?? null
		});
		await tx.insert(account).values({
			id: randomUUID(),
			accountId: id,
			providerId: 'credential',
			userId: id,
			password: hash,
			createdAt: new Date(),
			updatedAt: new Date()
		});
		await recordAudit(tx, event, {
			table: 'user',
			recordId: id,
			action: 'create',
			detail: { name: data.name, email, roleId: data.roleId }
		});
	});
	return id;
}

export async function updateUser(
	event: RequestEvent,
	id: string,
	data: {
		name: string;
		phone?: string | null;
		roleId: number | null;
		locale: string;
		isActive: boolean;
	}
) {
	const found = await findUser(id);
	if (!found) throw new WriteRefused(null, 'This account no longer exists.');
	const before = found.user;
	if (id === event.locals.user?.id && !data.isActive)
		throw new WriteRefused('isActive', 'You cannot switch off your own account.');
	if (before.kind === 'staff' && !data.roleId)
		throw new WriteRefused('roleId', 'Staff need a role.');
	await assertMayManageUser(event, before);
	const roleId = before.kind === 'staff' ? data.roleId : null;
	if (roleId !== before.roleId) {
		if (id === event.locals.user?.id && !event.locals.isSuperAdmin)
			throw new WriteRefused('roleId', 'You cannot change your own role.');
		if (roleId) await assignableRole(event, roleId);
	}
	const [ownerRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, OWNER));
	const ownerId = ownerRole?.id ?? null;
	const losesOwner =
		ownerId !== null && before.roleId === ownerId && (roleId !== ownerId || !data.isActive);
	const after = {
		name: data.name,
		phoneNumber: data.phone ?? null,
		roleId,
		locale: data.locale,
		isActive: data.isActive
	};
	await db.transaction(async (tx) => {
		// Nobody may take the last active Owner away. The Owners' rows stay locked until this commits,
		// so two Owners demoting each other at once cannot both pass.
		if (losesOwner && ownerId !== null) {
			const owners = await tx
				.select({ id: user.id })
				.from(user)
				.where(and(eq(user.roleId, ownerId), eq(user.isActive, true), isNull(user.deletedAt)))
				.for('update');
			if (owners.length <= 1)
				throw new WriteRefused(
					'roleId',
					'This is the only active Owner: give the role to someone else first.'
				);
		}
		await tx.update(user).set(after).where(eq(user.id, id));
		// A switched-off account is signed out everywhere at once.
		if (!data.isActive) await tx.delete(session).where(eq(session.userId, id));
		await recordAudit(tx, event, { table: 'user', recordId: id, action: 'update', before, after });
	});
}

export async function resetPassword(
	event: RequestEvent,
	target: { id: string; roleId: number | null },
	password: string
) {
	await assertMayManageUser(event, target);
	const id = target.id;
	const hash = await hashPassword(password);
	await db.transaction(async (tx) => {
		const [cred] = await tx
			.select({ id: account.id })
			.from(account)
			.where(and(eq(account.userId, id), eq(account.providerId, 'credential')));
		if (cred) await tx.update(account).set({ password: hash }).where(eq(account.id, cred.id));
		else
			await tx.insert(account).values({
				id: randomUUID(),
				accountId: id,
				providerId: 'credential',
				userId: id,
				password: hash,
				createdAt: new Date(),
				updatedAt: new Date()
			});
		await tx.delete(session).where(eq(session.userId, id));
		await recordAudit(tx, event, {
			table: 'user',
			recordId: id,
			action: 'update',
			detail: { password: 'reset' }
		});
	});
}

// ── Roles ────────────────────────────────────────────────────────────────────────────────────

export async function listRoles() {
	return db
		.select({
			id: roles.id,
			name: roles.name,
			description: roles.description,
			isActive: roles.isActive,
			holders:
				sql<number>`(select count(*) from ${user} where ${user.roleId} = ${roles.id} and ${user.deletedAt} is null)`.mapWith(
					Number
				),
			grants:
				sql<number>`(select count(*) from ${rolePermissions} where ${rolePermissions.roleId} = ${roles.id} and ${rolePermissions.deletedAt} is null)`.mapWith(
					Number
				)
		})
		.from(roles)
		.where(notDeleted(roles))
		.orderBy(roles.name);
}

export async function findRole(id: number) {
	if (!Number.isInteger(id)) return null;
	const [row] = await db
		.select()
		.from(roles)
		.where(and(eq(roles.id, id), notDeleted(roles)));
	return row ?? null;
}

export const allPermissions = () =>
	db
		.select({ id: permissions.id, name: permissions.name, description: permissions.description })
		.from(permissions)
		.orderBy(permissions.id);

export async function rolePermissionIds(roleId: number) {
	const rows = await db
		.select({ id: rolePermissions.permissionId })
		.from(rolePermissions)
		.where(and(eq(rolePermissions.roleId, roleId), notDeleted(rolePermissions)));
	return rows.map((r) => r.id);
}

export async function roleHolders(roleId: number) {
	return db
		.select({ id: user.id, name: user.name, email: user.email, isActive: user.isActive })
		.from(user)
		.where(and(eq(user.roleId, roleId), isNull(user.deletedAt)))
		.orderBy(user.name);
}

export async function addRole(
	event: RequestEvent,
	data: { name: string; description?: string | null; status: boolean }
) {
	const [taken] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, data.name));
	if (taken) throw new WriteRefused('name', 'A role by that name exists.');
	return db.transaction(async (tx) => {
		const [res] = await tx
			.insert(roles)
			.values({ name: data.name, description: data.description ?? null, isActive: data.status });
		await recordAudit(tx, event, {
			table: 'roles',
			recordId: res.insertId,
			action: 'create',
			detail: { name: data.name }
		});
		return res.insertId;
	});
}

export async function updateRole(
	event: RequestEvent,
	id: number,
	data: { name: string; description?: string | null; status: boolean }
) {
	const before = await findRole(id);
	if (!before) throw new WriteRefused(null, 'This role no longer exists.');
	if (before.name === OWNER && (data.name !== OWNER || !data.status))
		throw new WriteRefused('name', 'The Owner role keeps its name and is always on.');
	await assertMayManageRole(event, before);
	const [taken] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, data.name));
	if (taken && taken.id !== id) throw new WriteRefused('name', 'A role by that name exists.');
	const after = { name: data.name, description: data.description ?? null, isActive: data.status };
	await db.transaction(async (tx) => {
		await tx.update(roles).set(after).where(eq(roles.id, id));
		await recordAudit(tx, event, { table: 'roles', recordId: id, action: 'update', before, after });
	});
}

/** Replaces the role's grants with `ids`. Returns how many it holds now. */
export async function setRolePermissions(event: RequestEvent, roleId: number, ids: number[]) {
	const role = await findRole(roleId);
	if (!role) throw new WriteRefused(null, 'This role no longer exists.');
	if (role.name === OWNER)
		throw new WriteRefused(null, 'The Owner role always holds every permission.');
	await assertMayManageRole(event, role);
	const all = await allPermissions();
	const known = all.map((p) => p.id);
	const wanted = [...new Set(ids)].filter((id) => known.includes(id));
	const missing = notHeld(
		event,
		all.filter((p) => wanted.includes(p.id)).map((p) => p.name)
	);
	if (missing.length)
		throw new WriteRefused(
			null,
			`You can only give permissions you hold yourself (not ${missing.join(', ')}).`
		);
	const before = await rolePermissionIds(roleId);
	await db.transaction(async (tx) => {
		await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
		if (wanted.length)
			await tx
				.insert(rolePermissions)
				.values(
					wanted.map((permissionId) => ({ roleId, permissionId, createdBy: event.locals.user?.id }))
				);
		await recordAudit(tx, event, {
			table: 'role_permissions',
			recordId: roleId,
			action: 'update',
			detail: {
				added: wanted.filter((id) => !before.includes(id)).length,
				removed: before.filter((id) => !wanted.includes(id)).length
			}
		});
	});
	return wanted.length;
}

export async function deleteRole(event: RequestEvent, id: number) {
	const role = await findRole(id);
	if (!role) throw new WriteRefused(null, 'This role no longer exists.');
	if (role.name === OWNER) throw new WriteRefused(null, 'The Owner role cannot be deleted.');
	if ((await roleHolders(id)).length)
		throw new WriteRefused(null, 'Someone still holds this role: give them another first.');
	await db.transaction(async (tx) => {
		await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
		await tx.update(roles).set(deletionStamp(event.locals.user?.id)).where(eq(roles.id, id));
		await recordAudit(tx, event, { table: 'roles', recordId: id, action: 'delete' });
	});
}

// ── Audit trail ──────────────────────────────────────────────────────────────────────────────

/** Which `ENTITIES` kind an audited table's records open as; tables with no page are left plain. */
export const AUDIT_ENTITY: Record<string, string> = {
	user: 'user',
	roles: 'role',
	role_permissions: 'role',
	location: 'location',
	lot: 'lot',
	station: 'station',
	region: 'region',
	product: 'product',
	product_variant: 'variant',
	roast_batch: 'roastBatch',
	packing_run: 'packingRun',
	stock_count: 'stockCount',
	customer: 'customer',
	business_account: 'business',
	orders: 'order',
	payment: 'payment',
	refund: 'refund',
	invoice: 'invoice',
	discount_code: 'discount',
	ticket_type: 'ticketType',
	ticket: 'ticket',
	event: 'event',
	membership: 'membership',
	membership_plan: 'membershipPlan',
	subscription: 'subscription',
	bookable: 'bookable',
	booking: 'booking',
	form_submission: 'submission',
	page: 'page',
	post: 'post'
};

/** The path of an audited record's page, or null when its table has none. */
export const auditRecordPath = (tableName: string, recordId: string) => {
	const kind = AUDIT_ENTITY[tableName];
	return kind && ENTITIES[kind] ? `${ENTITIES[kind]}/${recordId}` : null;
};

const show = (value: unknown) =>
	value === null || value === undefined || value === ''
		? '∅'
		: typeof value === 'object'
			? JSON.stringify(value)
			: // Objects took the branch above; what is left prints as itself.
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				String(value);

/** `{ price: [500, 550] }` → one row per field; a create's or a run's detail → its one value. */
export function changeRows(changes: unknown) {
	if (!changes || typeof changes !== 'object') return [];
	return Object.entries(changes as Record<string, unknown>).map(([field, value]) =>
		Array.isArray(value) && value.length === 2
			? { field, before: show(value[0]), after: show(value[1]) }
			: { field, before: null as string | null, after: show(value) }
	);
}

export const summarise = (changes: unknown) =>
	changeRows(changes)
		.map((c) =>
			c.before === null ? `${c.field}: ${c.after}` : `${c.field}: ${c.before} → ${c.after}`
		)
		.join('; ');

/** A user's own recent trail, for their page. */
export async function auditBy(userId: string, limit = 25) {
	const rows = await db
		.select({
			id: auditLog.id,
			action: auditLog.action,
			tableName: auditLog.tableName,
			recordId: auditLog.recordId,
			changes: auditLog.changes,
			createdAt: auditLog.createdAt
		})
		.from(auditLog)
		.where(eq(auditLog.userId, userId))
		.orderBy(desc(auditLog.id))
		.limit(limit);
	return rows.map(({ changes, ...r }) => ({
		...r,
		recordEntity: AUDIT_ENTITY[r.tableName] ?? null,
		summary: summarise(changes)
	}));
}

/** Sessions of one user, newest first. */
export const sessionsOf = (userId: string) =>
	db
		.select({
			id: session.id,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			expiresAt: session.expiresAt,
			ipAddress: session.ipAddress,
			userAgent: session.userAgent
		})
		.from(session)
		.where(eq(session.userId, userId))
		.orderBy(desc(session.updatedAt));

export const lastSessionOf = async (ids: string[]) =>
	ids.length
		? db
				.select({ userId: session.userId, at: max(session.updatedAt) })
				.from(session)
				.where(inArray(session.userId, ids))
				.groupBy(session.userId)
		: [];

// ── Locations ────────────────────────────────────────────────────────────────────────────────

type LocationValues = Record<string, unknown> & { code: string; parentId?: number | null };

export async function saveLocation(event: RequestEvent, values: LocationValues, id?: number) {
	const [taken] = await db
		.select({ id: location.id })
		.from(location)
		.where(eq(location.code, values.code));
	if (taken && taken.id !== id) throw new WriteRefused('code', 'Another location has this code.');
	if (id && values.parentId === id)
		throw new WriteRefused('parentId', 'A location cannot sit inside itself.');
	const row = packLocalized({ ...values }, ['name']) as Partial<typeof location.$inferInsert>;
	return db.transaction(async (tx) => {
		if (!id) {
			const [res] = await tx
				.insert(location)
				.values({ ...row, createdBy: event.locals.user?.id } as typeof location.$inferInsert);
			await recordAudit(tx, event, { table: 'location', recordId: res.insertId, action: 'create' });
			return res.insertId;
		}
		const [before] = await tx.select().from(location).where(eq(location.id, id));
		await tx
			.update(location)
			.set({ ...row, updatedBy: event.locals.user?.id })
			.where(eq(location.id, id));
		await recordAudit(tx, event, {
			table: 'location',
			recordId: id,
			action: 'update',
			before,
			after: row
		});
		return id;
	});
}
