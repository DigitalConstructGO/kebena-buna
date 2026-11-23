import { error } from '@sveltejs/kit';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod/v4';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import { bookable, booking, bookingSession, staffAssignment } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stampsOf, staffOptions, userAlias } from '#lib/server/people.ts';
import { idParam, joinDateTime, splitDateTime } from '#lib/server/records.ts';
import { assignStaff, shiftAssignments } from '#lib/server/bookings.ts';
import { sessionEditSchema, staffAssignmentSchema } from '#lib/schemas/bookings.ts';

async function loadSession(raw: string) {
	const id = idParam(raw, 'Session');
	const [row] = await db
		.select({ s: bookingSession, bookable: enOf(bookable.name), kind: bookable.kind })
		.from(bookingSession)
		.innerJoin(bookable, eq(bookingSession.bookableId, bookable.id))
		.where(and(eq(bookingSession.id, id), isNull(bookingSession.deletedAt)));
	if (!row) error(404, 'Session not found');
	return row;
}

const staffer = userAlias('staffer');
const assigner = userAlias('assigner');

export const load = async ({ params, locals }) => {
	const row = await loadSession(params.id);
	const s = row.s;
	const [bookings, staff, stamps, people] = await Promise.all([
		db
			.select({
				id: booking.id,
				number: booking.number,
				customerId: booking.customerId,
				contactName: booking.contactName,
				contactPhone: booking.contactPhone,
				partySize: booking.partySize,
				language: booking.language,
				status: booking.status,
				specialRequests: booking.specialRequests
			})
			.from(booking)
			.where(and(eq(booking.sessionId, s.id), isNull(booking.deletedAt)))
			.orderBy(asc(booking.id)),
		db
			.select({
				id: staffAssignment.id,
				userId: staffAssignment.userId,
				user: staffer.name,
				role: staffAssignment.role,
				startsAt: staffAssignment.startsAt,
				endsAt: staffAssignment.endsAt,
				assignedById: staffAssignment.assignedBy,
				assignedBy: assigner.name
			})
			.from(staffAssignment)
			.innerJoin(staffer, eq(staffAssignment.userId, staffer.id))
			.leftJoin(assigner, eq(staffAssignment.assignedBy, assigner.id))
			.where(eq(staffAssignment.sessionId, s.id)),
		stampsOf(s),
		staffOptions()
	]);
	const start = splitDateTime(s.startsAt);
	const end = splitDateTime(s.endsAt);
	return {
		session: s,
		bookable: row.bookable,
		bookings,
		staff,
		stamps,
		people,
		canManage: hasPermission(locals, 'bookings.manage'),
		editForm: await superValidate(
			{
				date: start.date,
				startsAt: start.time,
				endsAt: end.time,
				capacity: s.capacity,
				language: s.language,
				notes: s.notes
			},
			zod4(sessionEditSchema),
			{ errors: false, id: 'edit' }
		),
		staffForm: await superValidate(
			{
				role: row.kind === 'ceremony' ? 'host' : 'guide',
				date: start.date,
				startsAt: start.time,
				endsAt: end.time
			},
			zod4(staffAssignmentSchema),
			{ errors: false, id: 'staff' }
		)
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(sessionEditSchema), { id: 'edit' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { s } = await loadSession(event.params.id);
		const { date, startsAt, endsAt, capacity, language, notes } = form.data;
		const start = joinDateTime(date, startsAt);
		const end = joinDateTime(date, endsAt);
		if (end <= start)
			return message(
				form,
				{ type: 'error', text: 'The end must be after the start.' },
				{ status: 400 }
			);
		const refusal = await db.transaction(async (tx) => {
			const [before] = await tx
				.select()
				.from(bookingSession)
				.where(eq(bookingSession.id, s.id))
				.for('update');
			if (capacity < before.booked) return `${before.booked} places are already booked.`;
			await tx
				.update(bookingSession)
				.set({
					startsAt: start,
					endsAt: end,
					capacity,
					language,
					notes,
					updatedBy: event.locals.user?.id
				})
				.where(eq(bookingSession.id, s.id));
			// Its staff move with it, so the double-booking check reads the real times.
			await shiftAssignments(tx, { sessionId: s.id }, before, { startsAt: start, endsAt: end });
			return null;
		});
		if (refusal) return message(form, { type: 'error', text: refusal }, { status: 400 });
		return message(form, { type: 'success', text: 'Session saved' });
	},
	staff: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(staffAssignmentSchema), { id: 'staff' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { s } = await loadSession(event.params.id);
		const result = await assignStaff({ ...form.data, sessionId: s.id }, event.locals.user?.id);
		if (!result.ok) return message(form, { type: 'error', text: result.text }, { status: 400 });
		return message(form, { type: 'success', text: result.text });
	},
	unstaff: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const { s } = await loadSession(event.params.id);
		const id = z.coerce
			.number()
			.int()
			.safeParse((await event.request.formData()).get('assignmentId'));
		if (!id.success) return { message: { type: 'error', text: 'Which assignment?' } };
		await db
			.delete(staffAssignment)
			.where(and(eq(staffAssignment.id, id.data), eq(staffAssignment.sessionId, s.id)));
		return { message: { type: 'success', text: 'Taken off the session' } };
	},
	/** Cancels or reinstates the run. Its bookings are left for staff to move or refund one by one. */
	toggle: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const { s } = await loadSession(event.params.id);
		await db
			.update(bookingSession)
			.set({ isCancelled: !s.isCancelled, updatedBy: event.locals.user?.id })
			.where(eq(bookingSession.id, s.id));
		return {
			message: { type: 'success', text: s.isCancelled ? 'Session reinstated' : 'Session cancelled' }
		};
	}
};
