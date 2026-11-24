/** Bookings, sessions, bookables and the inbox's forms. Client-safe. */
import { z } from 'zod/v4';
import {
	BOOKABLE_KINDS,
	BOOKING_PRICING,
	PUBLISH_STATUSES,
	WORKFLOW_STATUSES
} from '#lib/constants.ts';
import {
	amText,
	bool,
	boolTrue,
	clockTime,
	enOptional,
	enText,
	isoDate,
	moneyField,
	optionalDate,
	optionalId,
	optionalInt,
	optionalText,
	optionalTime,
	optionalUserId,
	requiredId,
	requiredText,
	slug,
	sortOrder
} from '#lib/schemas/common.ts';

export const workflowSchema = z.object({
	status: z.enum(WORKFLOW_STATUSES),
	note: optionalText(500)
});

export const assignSchema = z.object({ assignedTo: optionalUserId });

/** An answer to a website enquiry, sent to the sender's phone and email. */
export const replySchema = z.object({ message: requiredText(1000, 'Write the reply') });

/** A person put on a booking or a session for a stretch of time (8.2). */
export const staffAssignmentSchema = z.object({
	userId: requiredText(255, 'Choose who'),
	role: requiredText(32, 'Their role: guide, host…').default('guide'),
	date: isoDate,
	startsAt: clockTime,
	endsAt: clockTime
});

export const quoteSchema = z.object({
	quotedAmount: moneyField,
	depositAmount: moneyField
});

export const scheduleSchema = z.object({
	sessionId: optionalId,
	confirmedDate: optionalDate,
	confirmedTime: optionalTime,
	heldPlaces: z.coerce.number().int().min(0).default(0),
	holdExpiresDate: optionalDate
});

export const bookingDetailsSchema = z.object({
	contactName: requiredText(150, 'Who to contact'),
	contactPhone: requiredText(20, 'Their phone'),
	contactEmail: optionalText(255),
	organisationName: optionalText(150),
	tin: optionalText(20),
	partySize: z.coerce.number().int().min(1),
	audienceId: optionalId,
	language: optionalText(8),
	ageRange: optionalText(32),
	eventType: optionalText(64),
	specialRequests: optionalText(5000),
	accessibilityNeeds: optionalText(500)
});

export const cancelBookingSchema = z.object({ reason: requiredText(255, 'Say why') });

// ── Sessions ─────────────────────────────────────────────────────────────────────────────────

export const sessionEditSchema = z.object({
	date: isoDate,
	startsAt: clockTime,
	endsAt: clockTime,
	capacity: z.coerce.number().int().min(1),
	language: optionalText(8),
	notes: optionalText(255)
});

// ── Bookables ────────────────────────────────────────────────────────────────────────────────

export const bookableSchema = z.object({
	slug,
	kind: z.enum(BOOKABLE_KINDS),
	nameEn: enText(150),
	nameAm: amText(150),
	nameOm: amText(150),
	nameAr: amText(150),
	nameIt: amText(150),
	nameFr: amText(150),
	descriptionEn: enOptional(5000),
	descriptionAm: amText(5000),
	descriptionOm: amText(5000),
	descriptionAr: amText(5000),
	descriptionIt: amText(5000),
	descriptionFr: amText(5000),
	locationId: optionalId,
	durationMin: z.coerce.number().int().min(5).max(1440).default(60),
	minParty: z.coerce.number().int().min(1).default(1),
	maxParty: optionalInt,
	pricing: z.enum(BOOKING_PRICING),
	requiresPrepayment: boolTrue,
	usesVisitCapacity: bool,
	requiresStaff: boolTrue,
	isEnquiryOnly: bool,
	languages: z.array(z.string()).default([]),
	holdDays: optionalInt,
	taxRateId: optionalId,
	publishStatus: z.enum(PUBLISH_STATUSES).default('draft'),
	sortOrder,
	isActive: boolTrue
});
export const bookableEditSchema = bookableSchema.extend({ id: z.coerce.number() });

export const imageSchema = z.object({ image: z.file().optional() });

export const bookablePriceSchema = z.object({
	audienceId: requiredId('Choose the audience'),
	price: moneyField,
	status: boolTrue
});
export const bookablePriceEditSchema = bookablePriceSchema.extend({ id: z.coerce.number() });

export const bookableScheduleSchema = z.object({
	id: z.coerce.number().optional(),
	weekday: z.coerce.number().int().min(1).max(7),
	startsAt: clockTime,
	capacity: z.coerce.number().int().min(1),
	language: optionalText(8)
});

export const generateSessionsSchema = z.object({
	days: z.coerce.number().int().min(1).max(120).default(28)
});

// ── Inbox ────────────────────────────────────────────────────────────────────────────────────

export const submissionToBookingSchema = z.object({
	bookableId: requiredId('What is being booked'),
	partySize: z.coerce.number().int().min(1)
});
