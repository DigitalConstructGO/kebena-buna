import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod/v4';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import {
	audience,
	bookable,
	booking,
	bookingSession,
	customer,
	event as eventTable,
	formSubmission,
	invoice,
	order,
	staffAssignment,
	ticket,
	visitSlot,
	workflowHistory
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stampsOf, staffOptions, userAlias } from '#lib/server/people.ts';
import { idParam, joinDateTime, splitDateTime } from '#lib/server/records.ts';
import { audienceOptions } from '#lib/server/options.ts';
import {
	assignStaff,
	changeWorkflow,
	holdExpiry,
	holdPlaces,
	setBookingSession,
	shiftAssignments,
	slotAt,
	syncSessionBooked
} from '#lib/server/bookings.ts';
import {
	assignSchema,
	bookingDetailsSchema,
	cancelBookingSchema,
	quoteSchema,
	scheduleSchema,
	staffAssignmentSchema,
	workflowSchema
} from '#lib/schemas/bookings.ts';

async function loadBooking(raw: string) {
	const id = idParam(raw, 'Booking');
	const [row] = await db
		.select({
			b: booking,
			bookable: enOf(bookable.name),
			bookableKind: bookable.kind,
			durationMin: bookable.durationMin,
			sessionStartsAt: bookingSession.startsAt,
			slotStartsAt: visitSlot.startsAt,
			slotDayId: visitSlot.visitDayId,
			customer: customer.name,
			submission: formSubmission.subject,
			orderNumber: order.number,
			invoiceNumber: invoice.number,
			ticketCode: ticket.code,
			eventTitle: enOf(eventTable.title),
			audience: enOf(audience.name)
		})
		.from(booking)
		.innerJoin(bookable, eq(booking.bookableId, bookable.id))
		.leftJoin(bookingSession, eq(booking.sessionId, bookingSession.id))
		.leftJoin(visitSlot, eq(booking.visitSlotId, visitSlot.id))
		.leftJoin(customer, eq(booking.customerId, customer.id))
		.leftJoin(formSubmission, eq(booking.submissionId, formSubmission.id))
		.leftJoin(order, eq(booking.orderId, order.id))
		.leftJoin(invoice, eq(booking.invoiceId, invoice.id))
		.leftJoin(ticket, eq(booking.groupTicketId, ticket.id))
		.leftJoin(eventTable, eq(booking.eventId, eventTable.id))
		.leftJoin(audience, eq(booking.audienceId, audience.id))
		.where(and(eq(booking.id, id), isNull(booking.deletedAt)));
	if (!row) error(404, 'Booking not found');
	return row;
}

const changer = userAlias('changer');
const staffer = userAlias('staffer');
const assigner = userAlias('assigner');
const assignee = userAlias('assignee');

export const load = async ({ params, locals }) => {
	const row = await loadBooking(params.id);
	const b = row.b;
	const [history, staff, [handler], stamps, people, audiences, sessionRows] = await Promise.all([
		db
			.select({
				id: workflowHistory.id,
				fromStatus: workflowHistory.fromStatus,
				toStatus: workflowHistory.toStatus,
				note: workflowHistory.note,
				changedById: workflowHistory.changedBy,
				changedBy: changer.name,
				createdAt: workflowHistory.createdAt
			})
			.from(workflowHistory)
			.leftJoin(changer, eq(workflowHistory.changedBy, changer.id))
			.where(eq(workflowHistory.bookingId, b.id))
			.orderBy(desc(workflowHistory.id)),
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
			.where(eq(staffAssignment.bookingId, b.id))
			.orderBy(asc(staffAssignment.startsAt)),
		b.assignedTo
			? db.select({ name: assignee.name }).from(assignee).where(eq(assignee.id, b.assignedTo))
			: Promise.resolve([]),
		stampsOf(b),
		staffOptions(),
		audienceOptions(),
		// Its bookable's sessions still to come, and the one it is on.
		db
			.select({
				id: bookingSession.id,
				startsAt: bookingSession.startsAt,
				booked: bookingSession.booked,
				capacity: bookingSession.capacity
			})
			.from(bookingSession)
			.where(
				and(
					eq(bookingSession.bookableId, b.bookableId),
					isNull(bookingSession.deletedAt),
					or(
						b.sessionId ? eq(bookingSession.id, b.sessionId) : undefined,
						and(eq(bookingSession.isCancelled, false), gt(bookingSession.startsAt, new Date()))
					)
				)
			)
			.orderBy(asc(bookingSession.startsAt))
			.limit(200)
	]);
	const start = b.confirmedStartsAt ?? row.sessionStartsAt ?? row.slotStartsAt;
	const startParts = splitDateTime(start);
	const endParts = start
		? splitDateTime(new Date(start.getTime() + row.durationMin * 60000))
		: { date: '', time: '' };
	const confirmed = splitDateTime(b.confirmedStartsAt);
	return {
		booking: b,
		info: row,
		handler: handler?.name ?? null,
		history,
		staff,
		stamps,
		people,
		audiences,
		sessions: sessionRows.map((r) => {
			const at = splitDateTime(r.startsAt);
			return { value: r.id, name: `${at.date} ${at.time} · ${r.booked}/${r.capacity} booked` };
		}),
		canManage: hasPermission(locals, 'bookings.manage'),
		statusForm: await superValidate({ status: b.status }, zod4(workflowSchema), {
			errors: false,
			id: 'status'
		}),
		assignForm: await superValidate({ assignedTo: b.assignedTo }, zod4(assignSchema), {
			errors: false,
			id: 'assign'
		}),
		staffForm: await superValidate(
			{
				role:
					row.bookableKind === 'ceremony' || row.bookableKind === 'private_event'
						? 'host'
						: 'guide',
				date: startParts.date || undefined,
				startsAt: startParts.time || undefined,
				endsAt: endParts.time || undefined
			},
			zod4(staffAssignmentSchema),
			{ errors: false, id: 'staff' }
		),
		quoteForm: await superValidate(
			{ quotedAmount: b.quotedAmount, depositAmount: b.depositAmount },
			zod4(quoteSchema),
			{ errors: false, id: 'quote' }
		),
		scheduleForm: await superValidate(
			{
				sessionId: b.sessionId,
				confirmedDate: confirmed.date || null,
				confirmedTime: confirmed.time || null,
				heldPlaces: b.heldPlaces,
				holdExpiresDate: b.holdExpiresAt ? splitDateTime(b.holdExpiresAt).date : null
			},
			zod4(scheduleSchema),
			{ errors: false, id: 'schedule' }
		),
		detailsForm: await superValidate(
			{
				contactName: b.contactName,
				contactPhone: b.contactPhone,
				contactEmail: b.contactEmail,
				organisationName: b.organisationName,
				tin: b.tin,
				partySize: b.partySize,
				audienceId: b.audienceId,
				language: b.language,
				ageRange: b.ageRange,
				eventType: b.eventType,
				specialRequests: b.specialRequests,
				accessibilityNeeds: b.accessibilityNeeds
			},
			zod4(bookingDetailsSchema),
			{ errors: false, id: 'details' }
		),
		cancelForm: await superValidate(zod4(cancelBookingSchema), { id: 'cancel' })
	};
};

const bad = <T extends Parameters<typeof message>[0]>(form: T) =>
	message(form, { type: 'error', text: 'Check the form' }, { status: 400 });

/** A refusal under its field when the form has one, and on the form either way. */
function refused<T extends Parameters<typeof message>[0]>(form: T, err: unknown) {
	if (!(err instanceof WriteRefused)) throw err;
	if (err.field && err.field in form.data) setError(form, err.field as never, err.message);
	return message(form, { type: 'error', text: err.message }, { status: 400 });
}

export const actions = {
	status: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(workflowSchema), { id: 'status' });
		if (!form.valid) return bad(form);
		const { b } = await loadBooking(event.params.id);
		let changed: boolean;
		try {
			changed = await db.transaction((tx) =>
				changeWorkflow(
					tx,
					{ bookingId: b.id },
					form.data.status,
					form.data.note,
					event.locals.user?.id
				)
			);
		} catch (err) {
			return refused(form, err);
		}
		return message(form, {
			type: changed ? 'success' : 'error',
			text: changed ? 'Status changed' : 'It already has that status'
		});
	},
	assign: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(assignSchema), { id: 'assign' });
		if (!form.valid) return bad(form);
		const { b } = await loadBooking(event.params.id);
		await db
			.update(booking)
			.set({ assignedTo: form.data.assignedTo ?? null, updatedBy: event.locals.user?.id })
			.where(eq(booking.id, b.id));
		return message(form, {
			type: 'success',
			text: form.data.assignedTo ? 'Assigned' : 'Unassigned'
		});
	},
	staff: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(staffAssignmentSchema), { id: 'staff' });
		if (!form.valid) return bad(form);
		const { b } = await loadBooking(event.params.id);
		const result = await assignStaff({ ...form.data, bookingId: b.id }, event.locals.user?.id);
		if (!result.ok) return message(form, { type: 'error', text: result.text }, { status: 400 });
		return message(form, { type: 'success', text: result.text });
	},
	unstaff: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const { b } = await loadBooking(event.params.id);
		const id = z.coerce
			.number()
			.int()
			.safeParse((await event.request.formData()).get('assignmentId'));
		if (!id.success) return { message: { type: 'error', text: 'Which assignment?' } };
		await db
			.delete(staffAssignment)
			.where(and(eq(staffAssignment.id, id.data), eq(staffAssignment.bookingId, b.id)));
		return { message: { type: 'success', text: 'Taken off the booking' } };
	},
	quote: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(quoteSchema), { id: 'quote' });
		if (!form.valid) return bad(form);
		const { b } = await loadBooking(event.params.id);
		await db.transaction(async (tx) => {
			await tx
				.update(booking)
				.set({ ...form.data, updatedBy: event.locals.user?.id })
				.where(eq(booking.id, b.id));
			await recordAudit(tx, event, {
				table: 'booking',
				recordId: b.id,
				action: 'update',
				before: b,
				after: form.data
			});
		});
		return message(form, { type: 'success', text: 'Quote saved' });
	},
	schedule: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(scheduleSchema), { id: 'schedule' });
		if (!form.valid) return bad(form);
		const { b } = await loadBooking(event.params.id);
		const { sessionId, confirmedDate, confirmedTime, heldPlaces, holdExpiresDate } = form.data;
		try {
			await db.transaction(async (tx) => {
				// On a session, the booking takes its places there (refused when it is full)…
				await setBookingSession(tx, b.id, sessionId ?? null);
				const [session] = sessionId
					? await tx
							.select({ startsAt: bookingSession.startsAt })
							.from(bookingSession)
							.where(eq(bookingSession.id, sessionId))
					: [];
				// …and is for the session's time unless staff give another.
				const confirmedStartsAt = confirmedDate
					? joinDateTime(confirmedDate, confirmedTime)
					: (session?.startsAt ?? null);
				// A hold goes on the visit slot the booking falls in; a new time moves it there.
				const [x] = await tx
					.select({ locationId: bookable.locationId, usesVisit: bookable.usesVisitCapacity })
					.from(bookable)
					.where(eq(bookable.id, b.bookableId));
				const slotId =
					confirmedStartsAt && (heldPlaces > 0 || x?.usesVisit)
						? await slotAt(tx, x?.locationId ?? null, confirmedStartsAt)
						: b.visitSlotId;
				if (slotId !== b.visitSlotId) {
					await holdPlaces(tx, b.id, 0);
					await tx.update(booking).set({ visitSlotId: slotId }).where(eq(booking.id, b.id));
				}
				// The hold takes (or gives back) places on the visit slot in the same transaction.
				await holdPlaces(tx, b.id, heldPlaces);
				// A confirmed date moved: the staff on the booking move with it.
				if (b.confirmedStartsAt && confirmedStartsAt) {
					const before = { startsAt: b.confirmedStartsAt, endsAt: b.confirmedStartsAt };
					await shiftAssignments(tx, { bookingId: b.id }, before, {
						startsAt: confirmedStartsAt,
						endsAt: confirmedStartsAt
					});
				}
				await tx
					.update(booking)
					.set({
						confirmedStartsAt,
						// A hold always ends: on the date given, else after the bookable's hold days.
						holdExpiresAt: !heldPlaces
							? null
							: holdExpiresDate
								? joinDateTime(holdExpiresDate, '23:59')
								: (b.holdExpiresAt ?? (await holdExpiry(tx, b.bookableId))),
						updatedBy: event.locals.user?.id
					})
					.where(eq(booking.id, b.id));
			});
		} catch (err) {
			return refused(form, err);
		}
		return message(form, { type: 'success', text: 'Date and hold saved' });
	},
	details: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(bookingDetailsSchema), { id: 'details' });
		if (!form.valid) return bad(form);
		const { b } = await loadBooking(event.params.id);
		try {
			await db.transaction(async (tx) => {
				await tx
					.update(booking)
					.set({ ...form.data, updatedBy: event.locals.user?.id })
					.where(eq(booking.id, b.id));
				// Refuses a party the session has no room for, before the check constraint would.
				if (b.sessionId) await syncSessionBooked(tx, b.sessionId);
			});
		} catch (err) {
			return refused(form, err);
		}
		return message(form, { type: 'success', text: 'Booking saved' });
	},
	cancel: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(cancelBookingSchema), { id: 'cancel' });
		if (!form.valid) return bad(form);
		const { b } = await loadBooking(event.params.id);
		await db.transaction(async (tx) => {
			// Releasing the hold moves the slot's counters back, so it goes through `holdPlaces`.
			await holdPlaces(tx, b.id, 0);
			await tx
				.update(booking)
				.set({ cancelReason: form.data.reason, holdExpiresAt: null })
				.where(eq(booking.id, b.id));
			await changeWorkflow(
				tx,
				{ bookingId: b.id },
				'cancelled',
				form.data.reason,
				event.locals.user?.id
			);
		});
		return message(form, { type: 'success', text: `${b.number} cancelled` });
	}
};
