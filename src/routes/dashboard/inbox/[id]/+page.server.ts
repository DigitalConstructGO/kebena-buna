import { error } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import {
	bookable,
	booking,
	customer,
	formSubmission,
	workflowHistory
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stampsOf, staffOptions, userAlias } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { bookableOptions } from '#lib/server/options.ts';
import { changeWorkflow, nextBookingNumber } from '#lib/server/bookings.ts';
import { assignSchema, submissionToBookingSchema, workflowSchema } from '#lib/schemas/bookings.ts';

/** Forms whose submission can become a booking. */
const BOOKABLE_FORMS = ['booking', 'group_booking', 'private_event', 'event_registration'];

async function loadSubmission(raw: string) {
	const id = idParam(raw, 'Submission');
	const [row] = await db
		.select({ f: formSubmission, customer: customer.name })
		.from(formSubmission)
		.leftJoin(customer, eq(formSubmission.customerId, customer.id))
		.where(and(eq(formSubmission.id, id), isNull(formSubmission.deletedAt)));
	if (!row) error(404, 'Submission not found');
	return row;
}

const changer = userAlias('changer');
const assignee = userAlias('assignee');

export const load = async ({ params, locals }) => {
	const row = await loadSubmission(params.id);
	const f = row.f;
	const [history, bookings, [handler], stamps, people, bookables] = await Promise.all([
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
			.where(eq(workflowHistory.submissionId, f.id))
			.orderBy(desc(workflowHistory.id)),
		db
			.select({
				id: booking.id,
				number: booking.number,
				status: booking.status,
				bookable: enOf(bookable.name)
			})
			.from(booking)
			.innerJoin(bookable, eq(booking.bookableId, bookable.id))
			.where(and(eq(booking.submissionId, f.id), isNull(booking.deletedAt))),
		f.assignedTo
			? db.select({ name: assignee.name }).from(assignee).where(eq(assignee.id, f.assignedTo))
			: Promise.resolve([]),
		stampsOf(f),
		staffOptions(),
		bookableOptions()
	]);
	const partySize = Number(f.data?.partySize ?? 1) || 1;
	return {
		submission: f,
		customer: row.customer,
		handler: handler?.name ?? null,
		history,
		bookings,
		stamps,
		people,
		bookables,
		canBook: BOOKABLE_FORMS.includes(f.formType),
		canManage: hasPermission(locals, 'inbox.manage'),
		canCreateBooking: hasPermission(locals, 'bookings.manage'),
		statusForm: await superValidate({ status: f.status }, zod4(workflowSchema), {
			errors: false,
			id: 'status'
		}),
		assignForm: await superValidate({ assignedTo: f.assignedTo }, zod4(assignSchema), {
			errors: false,
			id: 'assign'
		}),
		bookingForm: await superValidate({ partySize }, zod4(submissionToBookingSchema), {
			errors: false,
			id: 'book'
		})
	};
};

export const actions = {
	status: async (event) => {
		requirePermission(event.locals, 'inbox.manage');
		const form = await superValidate(event.request, zod4(workflowSchema), { id: 'status' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { f } = await loadSubmission(event.params.id);
		const changed = await db.transaction((tx) =>
			changeWorkflow(
				tx,
				{ submissionId: f.id },
				form.data.status,
				form.data.note,
				event.locals.user?.id
			)
		);
		return message(form, {
			type: changed ? 'success' : 'error',
			text: changed ? 'Status changed' : 'It already has that status'
		});
	},
	assign: async (event) => {
		requirePermission(event.locals, 'inbox.manage');
		const form = await superValidate(event.request, zod4(assignSchema), { id: 'assign' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { f } = await loadSubmission(event.params.id);
		await db
			.update(formSubmission)
			.set({
				assignedTo: form.data.assignedTo ?? null,
				firstHandledAt: f.firstHandledAt ?? new Date(),
				updatedBy: event.locals.user?.id
			})
			.where(eq(formSubmission.id, f.id));
		return message(form, {
			type: 'success',
			text: form.data.assignedTo ? 'Assigned' : 'Unassigned'
		});
	},
	/** A booking made from the submission's contact details; the submission moves to in progress. */
	book: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(submissionToBookingSchema), {
			id: 'book'
		});
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { f } = await loadSubmission(event.params.id);
		if (!BOOKABLE_FORMS.includes(f.formType))
			return message(
				form,
				{ type: 'error', text: 'This kind of submission cannot become a booking' },
				{ status: 400 }
			);
		const data = f.data ?? {};
		const userId = event.locals.user?.id;
		const made = await db.transaction(async (tx) => {
			// The submission's row is locked, so a second click waits here and then finds the first booking.
			await tx
				.select({ id: formSubmission.id })
				.from(formSubmission)
				.where(eq(formSubmission.id, f.id))
				.for('update');
			const [existing] = await tx
				.select({ id: booking.id })
				.from(booking)
				.where(and(eq(booking.submissionId, f.id), isNull(booking.deletedAt)))
				.limit(1);
			if (existing) return null;
			const number = await nextBookingNumber(tx);
			const [res] = await tx.insert(booking).values({
				number,
				bookableId: form.data.bookableId,
				customerId: f.customerId,
				submissionId: f.id,
				status: 'new',
				contactName: f.name ?? 'Visitor',
				contactPhone: f.phone ?? '',
				contactEmail: f.email,
				partySize: form.data.partySize,
				language: f.locale,
				// The website's group form sends every date offered (`preferredDates`); older posts one.
				preferredDates: Array.isArray(data.preferredDates)
					? data.preferredDates.filter((d): d is string => typeof d === 'string')
					: typeof data.preferredDate === 'string'
						? [data.preferredDate]
						: f.visitDate
							? [f.visitDate]
							: null,
				specialRequests: f.message,
				assignedTo: f.assignedTo ?? userId,
				createdBy: userId
			});
			await tx.insert(workflowHistory).values({
				bookingId: res.insertId,
				toStatus: 'new',
				note: 'Made from the inbox',
				changedBy: userId
			});
			if (f.status === 'new')
				await changeWorkflow(
					tx,
					{ submissionId: f.id },
					'in_progress',
					`Booking ${number} made`,
					userId
				);
			return { id: res.insertId, number };
		});
		if (!made)
			return message(
				form,
				{ type: 'error', text: 'A booking was already made from this submission' },
				{ status: 400 }
			);
		const { id, number } = made;
		redirect(
			`/dashboard/bookings/${id}`,
			{ type: 'success', message: `Booking ${number} made from the inbox` },
			event.cookies
		);
	}
};
