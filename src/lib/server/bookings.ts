/**
 * The shared inbox workflow (questionnaire 8.5) and the booking writes around it: status changes
 * with their history, staff on bookings and sessions with the double-booking check (8.2), session
 * counters, booking numbers, and sessions generated from a bookable's weekly pattern.
 */
import { and, eq, gt, inArray, isNull, lt, notInArray, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import type { Writer } from '@nahu/admin-kit/server/db';
import { addLocalDays, fromLocal, localClock, localDate, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import {
	bookable,
	bookableSchedule,
	booking,
	bookingSession,
	calendarException,
	formSubmission,
	staffAssignment,
	user,
	workflowHistory
} from '#lib/server/db/schema.ts';
import { nextNumber } from '#lib/server/records.ts';
import { queueMessage } from '#lib/server/notify.ts';
import { moveCounters } from '#lib/server/visits.ts';
import type { WorkflowStatus } from '#lib/constants.ts';

export type WorkflowTarget = { bookingId: number } | { submissionId: number };

/**
 * Moves a booking or a submission to `to`, writing the history row. A submission's first move out
 * of `new` stamps `firstHandledAt`, for the inbox's response times. Returns false when nothing
 * changed (already in that status).
 */
export async function changeWorkflow(
	tx: Writer,
	target: WorkflowTarget,
	to: WorkflowStatus,
	note: string | null | undefined,
	userId: string | undefined
): Promise<boolean> {
	const isBooking = 'bookingId' in target;
	const table = isBooking ? booking : formSubmission;
	const id = isBooking ? target.bookingId : target.submissionId;
	const [row] = await tx
		.select({ status: table.status })
		.from(table)
		.where(eq(table.id, id))
		.for('update');
	if (!row || row.status === to) return false;

	const now = new Date();
	const set: Record<string, unknown> = { status: to, updatedBy: userId };
	if (isBooking) {
		if (to === 'confirmed') set.confirmedAt = now;
		if (to === 'cancelled' || to === 'declined') set.cancelledAt = now;
	} else {
		const [s] = await tx
			.select({ first: formSubmission.firstHandledAt })
			.from(formSubmission)
			.where(eq(formSubmission.id, id));
		if (!s?.first) set.firstHandledAt = now;
	}
	await tx.update(table).set(set).where(eq(table.id, id));
	await tx.insert(workflowHistory).values({
		...target,
		fromStatus: row.status,
		toStatus: to,
		note: note ?? null,
		changedBy: userId
	});
	if (isBooking) {
		// A booking called off gives back the places it held on the visit slot.
		if (to === 'cancelled' || to === 'declined') await holdPlaces(tx, id, 0);
		if (to === 'confirmed' || to === 'cancelled') await queueBookingMessage(tx, id, to);
		const [b] = await tx
			.select({ sessionId: booking.sessionId })
			.from(booking)
			.where(eq(booking.id, id));
		if (b?.sessionId) await syncSessionBooked(tx, b.sessionId);
	}
	return true;
}

/**
 * Tells the visitor their booking is confirmed or cancelled (8.5), in the booking's language. A
 * confirmation names its time, so confirming again for a new time sends again; the same time
 * twice does not.
 */
async function queueBookingMessage(tx: Writer, bookingId: number, to: 'confirmed' | 'cancelled') {
	const [b] = await tx
		.select({
			number: booking.number,
			customerId: booking.customerId,
			name: booking.contactName,
			phone: booking.contactPhone,
			email: booking.contactEmail,
			language: booking.language,
			party: booking.partySize,
			confirmedStartsAt: booking.confirmedStartsAt,
			sessionStartsAt: bookingSession.startsAt,
			what: bookable.name
		})
		.from(booking)
		.innerJoin(bookable, eq(booking.bookableId, bookable.id))
		.leftJoin(bookingSession, eq(booking.sessionId, bookingSession.id))
		.where(eq(booking.id, bookingId));
	if (!b) return;
	const startsAt = b.confirmedStartsAt ?? b.sessionStartsAt;
	const locale = b.language || 'am';
	const when = startsAt ? startsAt.toISOString() : 'none';
	await queueMessage(
		tx,
		`booking.${to}`,
		{ phone: b.phone, email: b.email, locale, customerId: b.customerId },
		{
			name: b.name,
			booking_number: b.number,
			what: b.what?.[locale] || b.what?.am || b.what?.en || '',
			date: startsAt ? localDate(startsAt) : '',
			time: startsAt ? localClock(startsAt) : '',
			party: b.party
		},
		{ refType: 'booking', refId: bookingId, dedupe: to === 'confirmed' ? `booking:${bookingId}:confirmed:${when}` : `booking:${bookingId}:cancelled` }
	);
}

/**
 * A session's `booked` counter, recounted from the bookings that still hold a place, under the
 * session's row lock. Refuses (rather than tripping the capacity check constraint) when they no
 * longer fit — a party grown, or a cancelled booking brought back into a full session.
 */
export async function syncSessionBooked(tx: Writer, sessionId: number) {
	const [session] = await tx
		.select({ capacity: bookingSession.capacity, booked: bookingSession.booked })
		.from(bookingSession)
		.where(eq(bookingSession.id, sessionId))
		.for('update');
	if (!session) return;
	// A locking read: it sees the latest committed bookings, not this transaction's snapshot.
	const [{ n }] = await tx
		.select({ n: sql<number>`coalesce(sum(${booking.partySize}), 0)`.mapWith(Number) })
		.from(booking)
		.where(
			and(
				eq(booking.sessionId, sessionId),
				notInArray(booking.status, ['cancelled', 'declined']),
				isNull(booking.deletedAt)
			)
		)
		.for('share');
	// Only growth is refused: a cancellation must still go through on a session already over.
	if (n > session.capacity && n > session.booked)
		throw new WriteRefused('partySize', `The session takes ${session.capacity}; its bookings would need ${n} places`);
	await tx.update(bookingSession).set({ booked: n }).where(eq(bookingSession.id, sessionId));
}

/**
 * Sets the places a booking holds on its visit slot while unpaid (6.6), moving the slot's and the
 * day's `held` counters by the change, under their row locks, so the website cannot sell them.
 * Raising a hold needs a slot with room; lowering or releasing one never fails.
 */
export async function holdPlaces(tx: Writer, bookingId: number, places: number) {
	const [b] = await tx
		.select({ status: booking.status, heldPlaces: booking.heldPlaces, visitSlotId: booking.visitSlotId })
		.from(booking)
		.where(eq(booking.id, bookingId))
		.for('update');
	if (!b) throw new WriteRefused(null, 'Booking not found');
	const delta = places - b.heldPlaces;
	if (!delta) return;
	if (delta > 0) {
		if (b.status === 'cancelled' || b.status === 'declined')
			throw new WriteRefused('heldPlaces', `A ${b.status} booking holds no places`);
		if (!b.visitSlotId) throw new WriteRefused('heldPlaces', 'The booking has no visit slot to hold places on');
	}
	if (b.visitSlotId) await moveCounters(tx, b.visitSlotId, delta, { column: 'held', field: 'heldPlaces' });
	await tx.update(booking).set({ heldPlaces: places }).where(eq(booking.id, bookingId));
}

/** What else this person is on in that stretch of time — the double-booking warning (8.2). */
export async function overlapsFor(
	userId: string,
	startsAt: Date,
	endsAt: Date,
	except?: { sessionId?: number | null; bookingId?: number | null; eventId?: number | null }
) {
	return db
		.select({
			id: staffAssignment.id,
			startsAt: staffAssignment.startsAt,
			endsAt: staffAssignment.endsAt,
			sessionId: staffAssignment.sessionId,
			bookingId: staffAssignment.bookingId,
			eventId: staffAssignment.eventId
		})
		.from(staffAssignment)
		.where(
			and(
				eq(staffAssignment.userId, userId),
				lt(staffAssignment.startsAt, endsAt),
				gt(staffAssignment.endsAt, startsAt),
				except?.sessionId
					? sql`(${staffAssignment.sessionId} is null or ${staffAssignment.sessionId} <> ${except.sessionId})`
					: undefined,
				except?.bookingId
					? sql`(${staffAssignment.bookingId} is null or ${staffAssignment.bookingId} <> ${except.bookingId})`
					: undefined,
				except?.eventId
					? sql`(${staffAssignment.eventId} is null or ${staffAssignment.eventId} <> ${except.eventId})`
					: undefined
			)
		);
}

/** Puts someone on a booking or session; the answer names any clash, which is warned, not refused. */
export async function assignStaff(
	values: {
		userId: string;
		role: string;
		date: string;
		startsAt: string;
		endsAt: string;
		sessionId?: number;
		bookingId?: number;
	},
	assignedBy: string | undefined
) {
	return assignStaffAt(
		{
			userId: values.userId,
			role: values.role,
			startsAt: fromLocal(values.date, values.startsAt.slice(0, 5)),
			endsAt: fromLocal(values.date, values.endsAt.slice(0, 5)),
			sessionId: values.sessionId,
			bookingId: values.bookingId
		},
		assignedBy
	);
}

/** `assignStaff` for a stretch already in instants — an event's, which may run over several days. */
export async function assignStaffAt(
	values: {
		userId: string;
		role: string;
		startsAt: Date;
		endsAt: Date;
		sessionId?: number;
		bookingId?: number;
		eventId?: number;
	},
	assignedBy: string | undefined
) {
	const { startsAt, endsAt } = values;
	if (endsAt <= startsAt) return { ok: false as const, text: 'The end must be after the start.' };
	const clashes = await overlapsFor(values.userId, startsAt, endsAt, values);
	await db.insert(staffAssignment).values({
		userId: values.userId,
		role: values.role,
		startsAt,
		endsAt,
		sessionId: values.sessionId ?? null,
		bookingId: values.bookingId ?? null,
		eventId: values.eventId ?? null,
		assignedBy
	});
	const [who] = await db.select({ name: user.name }).from(user).where(eq(user.id, values.userId));
	return {
		ok: true as const,
		text: clashes.length
			? `${who?.name ?? 'They'} assigned — but already on ${clashes.length} other assignment${clashes.length === 1 ? '' : 's'} at that time.`
			: `${who?.name ?? 'Staff'} assigned`
	};
}

/**
 * Moves the staff on a session, booking or event along with it when its times change: each
 * assignment's start moves as the start did and its end as the end did, so someone booked to
 * arrive early still does. Runs in the caller's transaction.
 */
export async function shiftAssignments(
	tx: Writer,
	owner: { sessionId: number } | { bookingId: number } | { eventId: number },
	before: { startsAt: Date; endsAt: Date },
	after: { startsAt: Date; endsAt: Date }
) {
	const startBy = Math.round((after.startsAt.getTime() - before.startsAt.getTime()) / 1000);
	const endBy = Math.round((after.endsAt.getTime() - before.endsAt.getTime()) / 1000);
	if (!startBy && !endBy) return;
	const column =
		'sessionId' in owner
			? eq(staffAssignment.sessionId, owner.sessionId)
			: 'bookingId' in owner
				? eq(staffAssignment.bookingId, owner.bookingId)
				: eq(staffAssignment.eventId, owner.eventId);
	await tx
		.update(staffAssignment)
		.set({
			startsAt: sql`${staffAssignment.startsAt} + interval ${startBy} second`,
			endsAt: sql`${staffAssignment.endsAt} + interval ${endBy} second`
		})
		.where(column);
}

/** `BK-26-0042`, skipping numbers already taken. */
export async function nextBookingNumber(tx: Writer) {
	const yy = localToday().slice(2, 4);
	for (;;) {
		const n = await nextNumber(tx, `booking:${yy}`);
		const number = `BK-${yy}-${String(n).padStart(4, '0')}`;
		const [taken] = await tx.select({ id: booking.id }).from(booking).where(eq(booking.number, number));
		if (!taken) return number;
	}
}

/**
 * Sessions for the next `days` days from the bookable's weekly pattern. A day closed in the
 * calendar (for every location or this bookable's) is skipped, and so is any start that already
 * has a session, cancelled or not. Returns how many were made.
 */
export async function generateSessions(bookableId: number, days: number, userId: string | undefined) {
	const [b] = await db.select().from(bookable).where(eq(bookable.id, bookableId));
	if (!b) return 0;
	const schedules = await db
		.select()
		.from(bookableSchedule)
		.where(and(eq(bookableSchedule.bookableId, bookableId), eq(bookableSchedule.status, true), sql`${bookableSchedule.deletedAt} is null`));
	if (!schedules.length) return 0;

	// Today in Addis Ababa, not on the server's clock: a UTC server is still on yesterday until 03:00.
	const today = localToday();
	const dates = Array.from({ length: days }, (_, i) => addLocalDays(today, i));
	const closed = new Set(
		(
			await db
				.select({ date: calendarException.date, locationId: calendarException.locationId })
				.from(calendarException)
				.where(and(inArray(calendarException.date, dates), eq(calendarException.isClosed, true), sql`${calendarException.deletedAt} is null`))
		)
			.filter((c) => c.locationId === null || c.locationId === b.locationId)
			.map((c) => c.date)
	);
	const existing = new Set(
		(
			await db
				.select({ startsAt: bookingSession.startsAt })
				.from(bookingSession)
				// A cancelled session still counts: staff called it off, and generating again must not
				// bring it back. Only a deleted one frees its start.
				.where(and(eq(bookingSession.bookableId, bookableId), isNull(bookingSession.deletedAt)))
		).map((s) => s.startsAt.getTime())
	);

	const rows: (typeof bookingSession.$inferInsert)[] = [];
	for (const date of dates) {
		if (closed.has(date)) continue;
		const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
		for (const s of schedules.filter((x) => x.weekday === weekday)) {
			const startsAt = fromLocal(date, s.startsAt.slice(0, 5));
			if (startsAt.getTime() < Date.now() || existing.has(startsAt.getTime())) continue;
			rows.push({
				bookableId,
				startsAt,
				endsAt: new Date(startsAt.getTime() + b.durationMin * 60000),
				language: s.language,
				capacity: s.capacity,
				createdBy: userId
			});
		}
	}
	if (rows.length) await db.insert(bookingSession).values(rows);
	return rows.length;
}
