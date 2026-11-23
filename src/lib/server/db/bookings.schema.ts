/**
 * Bookings and forms (questionnaire 6.6, 8): what visitors can book, the sessions it runs in,
 * bookings with their staff, and every public form in one shared inbox.
 *
 * A new kind of bookable (a roasting class) is a row in `bookable`; a new form is a `formType`
 * value with its fields in `data` — neither needs a migration.
 */
import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	datetime,
	index,
	int,
	json,
	mysqlTable,
	smallint,
	text,
	time,
	tinyint,
	uniqueIndex,
	varchar,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { user } from './auth.schema';
import {
	bigId,
	currency,
	extra,
	file,
	id,
	lesserFields,
	localized,
	money,
	secureFields,
	status,
	userRef
} from './fields';
import { audience, location, taxRate } from './system.schema';
import { customer } from './customers.schema';
import { visitSlot, ticket, event } from './visits.schema';
import { invoice, order } from './orders.schema';
import {
	BOOKABLE_KINDS,
	BOOKING_PRICING,
	FORM_TYPES,
	PUBLISH_STATUSES,
	WORKFLOW_STATUSES
} from '../../constants';

/** Guided tour, coffee ceremony, cupping, private hire, school visit (8.1). */
export const bookable = mysqlTable('bookable', {
	id: id(),
	slug: varchar('slug', { length: 100 }).notNull().unique(),
	kind: status('kind', BOOKABLE_KINDS).notNull(),
	name: localized('name').notNull(),
	description: localized('description'),
	image: file('image'),
	locationId: int('location_id').references(() => location.id, { onDelete: 'restrict' }),
	durationMin: smallint('duration_min').notNull().default(60),
	minParty: smallint('min_party').notNull().default(1),
	maxParty: smallint('max_party'),
	pricing: status('pricing', BOOKING_PRICING).notNull().default('per_person'),
	/** Paid online at booking (true) or invoiced / quoted (false). */
	requiresPrepayment: boolean('requires_prepayment').default(true).notNull(),
	/** Also takes a place in the timed-entry slot (tours, school visits). */
	usesVisitCapacity: boolean('uses_visit_capacity').default(false).notNull(),
	requiresStaff: boolean('requires_staff').default(true).notNull(),
	/** By enquiry only: no sessions, staff confirm a date (private hire, schools). */
	isEnquiryOnly: boolean('is_enquiry_only').default(false).notNull(),
	/** Languages it is run in: `['am', 'en']`. */
	languages: json('languages').$type<string[]>(),
	/** Unpaid holds are released after this many days (6.6); null → the setting. */
	holdDays: tinyint('hold_days'),
	taxRateId: int('tax_rate_id').references(() => taxRate.id, { onDelete: 'restrict' }),
	publishStatus: status('publish_status', PUBLISH_STATUSES).notNull().default('draft'),
	sortOrder: smallint('sort_order').default(0).notNull(),
	...secureFields
});

/** Price per audience: ceremony 300 resident / 600 foreign; a tour's surcharge over the ticket. */
export const bookablePrice = mysqlTable(
	'bookable_price',
	{
		id: id(),
		bookableId: int('bookable_id')
			.notNull()
			.references(() => bookable.id, { onDelete: 'cascade' }),
		audienceId: int('audience_id')
			.notNull()
			.references(() => audience.id, { onDelete: 'restrict' }),
		price: money('price'),
		currency: currency(),
		...lesserFields
	},
	(table) => [
		uniqueIndex('bookable_price_uq').on(table.bookableId, table.audienceId, table.currency)
	]
);

/** The weekly pattern sessions are generated from: tours 10:00, 13:00, 15:00 daily. */
export const bookableSchedule = mysqlTable(
	'bookable_schedule',
	{
		id: id(),
		bookableId: int('bookable_id')
			.notNull()
			.references(() => bookable.id, { onDelete: 'cascade' }),
		weekday: tinyint('weekday').notNull(),
		startsAt: time('starts_at').notNull(),
		capacity: smallint('capacity').notNull(),
		language: varchar('language', { length: 8 }),
		...lesserFields
	},
	(table) => [index('bookable_schedule_idx').on(table.bookableId, table.weekday)]
);

/** One run of a bookable on a date, with its capacity counter and its guide. */
export const bookingSession = mysqlTable(
	'booking_session',
	{
		id: id(),
		bookableId: int('bookable_id')
			.notNull()
			.references(() => bookable.id, { onDelete: 'restrict' }),
		startsAt: datetime('starts_at').notNull(),
		endsAt: datetime('ends_at').notNull(),
		language: varchar('language', { length: 8 }),
		capacity: smallint('capacity').notNull(),
		booked: smallint('booked').default(0).notNull(),
		isCancelled: boolean('is_cancelled').default(false).notNull(),
		notes: varchar('notes', { length: 255 }),
		...secureFields
	},
	(table) => [
		index('booking_session_starts_idx').on(table.bookableId, table.startsAt),
		check('booking_session_capacity_chk', sql`${table.booked} <= ${table.capacity}`)
	]
);

/**
 * A booking. Status follows the shared inbox workflow (8.5). Session bookings fill a session;
 * enquiries (private hire, schools) carry the requested dates and a quote until staff confirm.
 * A confirmed group holds capacity on a visit slot until paid, then gets one group ticket (6.6).
 */
export const booking = mysqlTable(
	'booking',
	{
		id: id(),
		number: varchar('number', { length: 20 }).notNull().unique(),
		bookableId: int('bookable_id')
			.notNull()
			.references(() => bookable.id, { onDelete: 'restrict' }),
		sessionId: int('session_id').references(() => bookingSession.id, { onDelete: 'restrict' }),
		visitSlotId: int('visit_slot_id').references(() => visitSlot.id, { onDelete: 'restrict' }),
		customerId: int('customer_id').references(() => customer.id, { onDelete: 'set null' }),
		submissionId: int('submission_id').references((): AnyMySqlColumn => formSubmission.id, {
			onDelete: 'set null'
		}),
		status: status('status', WORKFLOW_STATUSES).notNull().default('new'),
		contactName: varchar('contact_name', { length: 150 }).notNull(),
		contactPhone: varchar('contact_phone', { length: 20 }).notNull(),
		contactEmail: varchar('contact_email', { length: 255 }),
		organisationName: varchar('organisation_name', { length: 150 }),
		tin: varchar('tin', { length: 20 }),
		partySize: smallint('party_size').notNull(),
		audienceId: int('audience_id').references(() => audience.id, { onDelete: 'restrict' }),
		language: varchar('language', { length: 8 }),
		ageRange: varchar('age_range', { length: 32 }),
		eventType: varchar('event_type', { length: 64 }),
		preferredDates: json('preferred_dates').$type<string[]>(),
		confirmedStartsAt: datetime('confirmed_starts_at'),
		specialRequests: text('special_requests'),
		accessibilityNeeds: varchar('accessibility_needs', { length: 500 }),
		/** Places held on the visit slot / session while unpaid, released at `holdExpiresAt`. */
		heldPlaces: smallint('held_places').default(0).notNull(),
		holdExpiresAt: datetime('hold_expires_at'),
		quotedAmount: money('quoted_amount'),
		depositAmount: money('deposit_amount'),
		currency: currency(),
		orderId: int('order_id').references((): AnyMySqlColumn => order.id, {
			onDelete: 'set null'
		}),
		invoiceId: int('invoice_id').references((): AnyMySqlColumn => invoice.id, {
			onDelete: 'set null'
		}),
		/** The single group QR (6.6). */
		groupTicketId: int('group_ticket_id').references((): AnyMySqlColumn => ticket.id, {
			onDelete: 'set null'
		}),
		eventId: int('event_id').references((): AnyMySqlColumn => event.id, {
			onDelete: 'set null'
		}),
		assignedTo: userRef('assigned_to'),
		confirmedAt: datetime('confirmed_at'),
		cancelledAt: datetime('cancelled_at'),
		cancelReason: varchar('cancel_reason', { length: 255 }),
		extra: extra(),
		...secureFields
	},
	(table) => [
		index('booking_status_idx').on(table.status, table.createdAt),
		index('booking_session_idx').on(table.sessionId),
		index('booking_slot_idx').on(table.visitSlotId),
		index('booking_customer_idx').on(table.customerId),
		index('booking_hold_idx').on(table.holdExpiresAt)
	]
);

/**
 * Who runs what, when (8.2). Times are copied from the session or booking so "is this guide free?"
 * is one indexed overlap query; the double-booking warning reads it.
 */
export const staffAssignment = mysqlTable(
	'staff_assignment',
	{
		id: id(),
		userId: varchar('user_id', { length: 255 })
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		sessionId: int('session_id').references(() => bookingSession.id, { onDelete: 'cascade' }),
		bookingId: int('booking_id').references(() => booking.id, { onDelete: 'cascade' }),
		eventId: int('event_id').references((): AnyMySqlColumn => event.id, { onDelete: 'cascade' }),
		/** guide, host, barista… */
		role: varchar('role', { length: 32 }).notNull().default('guide'),
		startsAt: datetime('starts_at').notNull(),
		endsAt: datetime('ends_at').notNull(),
		assignedBy: userRef('assigned_by'),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		index('staff_assignment_user_idx').on(table.userId, table.startsAt),
		index('staff_assignment_session_idx').on(table.sessionId),
		index('staff_assignment_booking_idx').on(table.bookingId)
	]
);

/**
 * Every public form post in one inbox (8.4, 8.5): bookings, group requests, private-event
 * enquiries, feedback, general enquiries, green-coffee quotes. The common fields are columns for
 * the inbox; the rest of the form is `data`, so a field added to a form needs no migration.
 * Kept 2 years (9.4).
 */
export const formSubmission = mysqlTable(
	'form_submission',
	{
		id: id(),
		formType: status('form_type', FORM_TYPES).notNull(),
		status: status('status', WORKFLOW_STATUSES).notNull().default('new'),
		customerId: int('customer_id').references(() => customer.id, { onDelete: 'set null' }),
		name: varchar('name', { length: 150 }),
		phone: varchar('phone', { length: 20 }),
		email: varchar('email', { length: 255 }),
		subject: varchar('subject', { length: 255 }),
		message: text('message'),
		rating: tinyint('rating'),
		visitDate: date('visit_date', { mode: 'string' }),
		data: json('data').$type<Record<string, unknown>>(),
		locale: varchar('locale', { length: 8 }).notNull().default('am'),
		marketingConsent: boolean('marketing_consent').default(false).notNull(),
		assignedTo: userRef('assigned_to'),
		spamScore: tinyint('spam_score'),
		ipAddress: varchar('ip_address', { length: 45 }),
		userAgent: varchar('user_agent', { length: 255 }),
		firstHandledAt: datetime('first_handled_at'),
		submittedAt: datetime('submitted_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		...secureFields
	},
	(table) => [
		index('form_submission_inbox_idx').on(table.status, table.submittedAt),
		index('form_submission_type_idx').on(table.formType, table.submittedAt),
		index('form_submission_customer_idx').on(table.customerId)
	]
);

/**
 * Every status change on a submission or booking, with who and when (8.5). One table for both, so
 * the inbox's activity feed is one query.
 */
export const workflowHistory = mysqlTable(
	'workflow_history',
	{
		id: bigId(),
		submissionId: int('submission_id').references(() => formSubmission.id, {
			onDelete: 'cascade'
		}),
		bookingId: int('booking_id').references(() => booking.id, { onDelete: 'cascade' }),
		fromStatus: status('from_status', WORKFLOW_STATUSES),
		toStatus: status('to_status', WORKFLOW_STATUSES).notNull(),
		note: varchar('note', { length: 500 }),
		changedBy: userRef('changed_by'),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		index('workflow_history_submission_idx').on(table.submissionId),
		index('workflow_history_booking_idx').on(table.bookingId)
	]
);

export const bookableRelations = relations(bookable, ({ one, many }) => ({
	location: one(location, { fields: [bookable.locationId], references: [location.id] }),
	prices: many(bookablePrice),
	schedules: many(bookableSchedule),
	sessions: many(bookingSession)
}));

export const bookablePriceRelations = relations(bookablePrice, ({ one }) => ({
	bookable: one(bookable, { fields: [bookablePrice.bookableId], references: [bookable.id] }),
	audience: one(audience, { fields: [bookablePrice.audienceId], references: [audience.id] })
}));

export const bookableScheduleRelations = relations(bookableSchedule, ({ one }) => ({
	bookable: one(bookable, { fields: [bookableSchedule.bookableId], references: [bookable.id] })
}));

export const bookingSessionRelations = relations(bookingSession, ({ one, many }) => ({
	bookable: one(bookable, { fields: [bookingSession.bookableId], references: [bookable.id] }),
	bookings: many(booking),
	staff: many(staffAssignment)
}));

export const bookingRelations = relations(booking, ({ one, many }) => ({
	bookable: one(bookable, { fields: [booking.bookableId], references: [bookable.id] }),
	session: one(bookingSession, { fields: [booking.sessionId], references: [bookingSession.id] }),
	customer: one(customer, { fields: [booking.customerId], references: [customer.id] }),
	submission: one(formSubmission, {
		fields: [booking.submissionId],
		references: [formSubmission.id]
	}),
	order: one(order, { fields: [booking.orderId], references: [order.id] }),
	staff: many(staffAssignment),
	history: many(workflowHistory)
}));

export const staffAssignmentRelations = relations(staffAssignment, ({ one }) => ({
	session: one(bookingSession, {
		fields: [staffAssignment.sessionId],
		references: [bookingSession.id]
	}),
	booking: one(booking, { fields: [staffAssignment.bookingId], references: [booking.id] })
}));

export const formSubmissionRelations = relations(formSubmission, ({ one, many }) => ({
	customer: one(customer, { fields: [formSubmission.customerId], references: [customer.id] }),
	history: many(workflowHistory)
}));

export const workflowHistoryRelations = relations(workflowHistory, ({ one }) => ({
	submission: one(formSubmission, {
		fields: [workflowHistory.submissionId],
		references: [formSubmission.id]
	}),
	booking: one(booking, { fields: [workflowHistory.bookingId], references: [booking.id] })
}));
