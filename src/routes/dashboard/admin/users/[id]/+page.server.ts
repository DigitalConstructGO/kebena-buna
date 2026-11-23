import { error } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import {
	booking,
	bookable,
	customer,
	formSubmission,
	order,
	roastBatch,
	roastLevel,
	session,
	staffAssignment
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { LANGS, type Lang } from '#lib/languages.ts';
import { roleOptions } from '#lib/server/options.ts';
import { editUserSchema, resetPasswordSchema } from '#lib/schemas/admin.ts';
import {
	assertMayManageUser,
	auditBy,
	findUser,
	invalid,
	refusedForm,
	refusedPlain,
	resetPassword,
	sessionsOf,
	updateUser
} from '#lib/server/admin.ts';

async function liveUser(id: string) {
	const found = await findUser(id);
	if (!found) error(404, 'No such user');
	return found;
}

/** One sign-in: who they are, what they may do, and what they have done. */
export const load = async ({ params }) => {
	const { user: u, role } = await liveUser(params.id);
	const [linked, sessions, trail, roasts, rides, assignments, bookings, submissions, roles] =
		await Promise.all([
			db
				.select({ id: customer.id, name: customer.name, phone: customer.phone })
				.from(customer)
				.where(and(eq(customer.userId, u.id), isNull(customer.deletedAt))),
			sessionsOf(u.id),
			auditBy(u.id),
			db
				.select({
					id: roastBatch.id,
					code: roastBatch.code,
					roastedAt: roastBatch.roastedAt,
					roastLevel: enOf(roastLevel.name),
					greenKgIn: roastBatch.greenKgIn,
					roastedKgOut: roastBatch.roastedKgOut,
					weightLossPct: roastBatch.weightLossPct
				})
				.from(roastBatch)
				.innerJoin(roastLevel, eq(roastBatch.roastLevelId, roastLevel.id))
				.where(and(eq(roastBatch.roasterId, u.id), isNull(roastBatch.deletedAt)))
				.orderBy(desc(roastBatch.roastedAt))
				.limit(20),
			db
				.select({
					id: order.id,
					number: order.number,
					status: order.status,
					placedAt: order.placedAt,
					total: order.total,
					customerId: order.customerId,
					customer: customer.name
				})
				.from(order)
				.innerJoin(customer, eq(order.customerId, customer.id))
				.where(eq(order.riderId, u.id))
				.orderBy(desc(order.placedAt))
				.limit(20),
			db
				.select({
					id: staffAssignment.id,
					role: staffAssignment.role,
					startsAt: staffAssignment.startsAt,
					endsAt: staffAssignment.endsAt,
					sessionId: staffAssignment.sessionId,
					bookingId: staffAssignment.bookingId,
					eventId: staffAssignment.eventId
				})
				.from(staffAssignment)
				.where(eq(staffAssignment.userId, u.id))
				.orderBy(desc(staffAssignment.startsAt))
				.limit(20),
			db
				.select({
					id: booking.id,
					number: booking.number,
					status: booking.status,
					bookable: enOf(bookable.name),
					contactName: booking.contactName,
					partySize: booking.partySize,
					createdAt: booking.createdAt
				})
				.from(booking)
				.innerJoin(bookable, eq(booking.bookableId, bookable.id))
				.where(and(eq(booking.assignedTo, u.id), isNull(booking.deletedAt)))
				.orderBy(desc(booking.createdAt))
				.limit(20),
			db
				.select({
					id: formSubmission.id,
					formType: formSubmission.formType,
					status: formSubmission.status,
					name: formSubmission.name,
					subject: formSubmission.subject,
					submittedAt: formSubmission.submittedAt
				})
				.from(formSubmission)
				.where(and(eq(formSubmission.assignedTo, u.id), isNull(formSubmission.deletedAt)))
				.orderBy(desc(formSubmission.submittedAt))
				.limit(20),
			roleOptions()
		]);

	return {
		person: u,
		role,
		customer: linked[0] ?? null,
		sessions,
		trail,
		roasts,
		rides,
		assignments,
		bookings,
		submissions,
		roles,
		editForm: await superValidate(
			{
				name: u.name,
				phone: u.phoneNumber,
				roleId: u.roleId,
				locale: (LANGS as readonly string[]).includes(u.locale) ? (u.locale as Lang) : 'am',
				isActive: u.isActive
			},
			zod4(editUserSchema),
			{ errors: false }
		),
		passwordForm: await superValidate(zod4(resetPasswordSchema), { id: 'password' })
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'users.manage');
		const form = await superValidate(event.request, zod4(editUserSchema));
		if (!form.valid) return invalid(form);
		try {
			await updateUser(event, event.params.id, form.data);
		} catch (err) {
			return refusedForm(form, err);
		}
		return message(form, { type: 'success', text: 'Saved' });
	},
	password: async (event) => {
		requirePermission(event.locals, 'users.manage');
		const { user: u } = await liveUser(event.params.id);
		const form = await superValidate(event.request, zod4(resetPasswordSchema), { id: 'password' });
		if (!form.valid) return invalid(form);
		try {
			await resetPassword(event, u, form.data.password);
		} catch (err) {
			return refusedForm(form, err);
		}
		const credentials = { name: u.name, email: u.email, password: form.data.password };
		form.data.password = '';
		form.message = { type: 'success', text: `New password set; ${u.name} was signed out everywhere` };
		return { form, credentials };
	},
	/** Signs one session out (`sessionId`), or every one when none is named. */
	revoke: async (event) => {
		requirePermission(event.locals, 'users.manage');
		const { user: u } = await liveUser(event.params.id);
		try {
			await assertMayManageUser(event, u);
		} catch (err) {
			return refusedPlain(err);
		}
		const sessionId = String((await event.request.formData()).get('sessionId') ?? '');
		await db.transaction(async (tx) => {
			await tx
				.delete(session)
				.where(sessionId ? and(eq(session.id, sessionId), eq(session.userId, u.id)) : eq(session.userId, u.id));
			await recordAudit(tx, event, {
				table: 'user',
				recordId: u.id,
				action: 'update',
				detail: { signedOut: sessionId ? 'one session' : 'every session' }
			});
		});
		return { message: { type: 'success', text: sessionId ? 'Session signed out' : 'Signed out everywhere' } };
	}
};
