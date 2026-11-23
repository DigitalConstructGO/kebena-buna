/** The Visits forms: ticket types, slots, the slot pattern, devices, events, ticket actions. */
import { z } from 'zod/v4';
import { EVENT_VISIBILITIES, PUBLISH_STATUSES } from '#lib/constants.ts';
import {
	amText,
	bool,
	boolTrue,
	clockTime,
	enOptional,
	enText,
	isoDate,
	optionalDate,
	optionalId,
	optionalInt,
	optionalText,
	optionalTime,
	requiredId,
	slug,
	sortOrder
} from '#lib/schemas/common.ts';

export const ticketTypeSchema = z.object({
	code: z.string().trim().min(1, 'Required').max(24).transform((v) => v.toUpperCase()),
	nameEn: enText(100),
	nameAm: amText(100),
	nameOm: amText(100),
	nameAr: amText(100),
	nameIt: amText(100),
	nameFr: amText(100),
	descriptionEn: enOptional(1000),
	descriptionAm: amText(1000),
	descriptionOm: amText(1000),
	descriptionAr: amText(1000),
	descriptionIt: amText(1000),
	descriptionFr: amText(1000),
	requiresProofEn: enOptional(150),
	requiresProofAm: amText(150),
	requiresProofOm: amText(150),
	requiresProofAr: amText(150),
	requiresProofIt: amText(150),
	requiresProofFr: amText(150),
	eventId: optionalId,
	minQuantity: z.coerce.number().int().min(1).default(1),
	maxQuantity: optionalInt,
	admitsPerTicket: z.coerce.number().int().min(1).default(1),
	countsTowardCapacity: boolTrue,
	isStaffOnly: bool,
	isMemberOnly: bool,
	taxRateId: optionalId,
	sortOrder,
	isActive: boolTrue
});
export const ticketTypeEditSchema = ticketTypeSchema.extend({ id: z.coerce.number() });

/** The weekly slot pattern (`slot_template`), on the kit's LookupPage. */
const slotTemplateFields = z.object({
	locationId: requiredId('Choose the location'),
	weekday: z.coerce.number().int().min(1).max(7),
	startsAt: clockTime,
	endsAt: clockTime,
	capacity: z.coerce.number().int().min(1),
	status: boolTrue
});
/** `HH:mm` and `HH:mm:ss` compare as text once both are cut to five characters. */
const endsAfterStart = (v: { startsAt: string; endsAt: string }) => v.endsAt.slice(0, 5) > v.startsAt.slice(0, 5);
const endsAfterStartError = { path: ['endsAt'], message: 'It must end after it starts' };
export const slotTemplateSchema = slotTemplateFields.refine(endsAfterStart, endsAfterStartError);
export const slotTemplateEditSchema = slotTemplateFields
	.extend({ id: z.coerce.number() })
	.refine(endsAfterStart, endsAfterStartError);

export const generateDaysSchema = z.object({
	from: isoDate,
	days: z.coerce.number().int().min(1).max(120).default(30),
	dayCapacity: z.coerce.number().int().min(1).default(400)
});

export const dayEditSchema = z.object({
	id: z.coerce.number(),
	capacity: z.coerce.number().int().min(0),
	isClosed: bool,
	closedReasonEn: enOptional(255),
	closedReasonAm: amText(255),
	closedReasonOm: amText(255),
	closedReasonAr: amText(255),
	closedReasonIt: amText(255),
	closedReasonFr: amText(255)
});

export const slotEditSchema = z.object({
	slotId: z.coerce.number(),
	capacity: z.coerce.number().int().min(0),
	isClosed: bool
});

export const rescheduleSchema = z.object({
	toSlotId: requiredId('Choose the new slot'),
	reason: optionalText(255)
});
export const reasonSchema = z.object({ reason: optionalText(255) });

export const deviceSchema = z.object({
	name: z.string().trim().min(1, 'Required').max(64),
	locationId: optionalId,
	isActive: boolTrue
});
export const deviceEditSchema = deviceSchema.extend({ id: z.coerce.number() });

/** An event: its words, where and when (the kit's date input with a time beside it), places. */
export const eventSchema = z.object({
	slug,
	titleEn: enText(200),
	titleAm: amText(200),
	titleOm: amText(200),
	titleAr: amText(200),
	titleIt: amText(200),
	titleFr: amText(200),
	summaryEn: enOptional(500),
	summaryAm: amText(500),
	summaryOm: amText(500),
	summaryAr: amText(500),
	summaryIt: amText(500),
	summaryFr: amText(500),
	descriptionEn: z.string().max(200_000).default(''),
	descriptionAm: z.string().max(200_000).default(''),
	descriptionOm: z.string().max(200_000).default(''),
	descriptionAr: z.string().max(200_000).default(''),
	descriptionIt: z.string().max(200_000).default(''),
	descriptionFr: z.string().max(200_000).default(''),
	image: z.file().optional(),
	locationId: requiredId('Choose where it is held'),
	startDate: isoDate,
	startTime: clockTime,
	endDate: isoDate,
	endTime: clockTime,
	capacity: z.coerce.number().int().min(1),
	visibility: z.enum(EVENT_VISIBILITIES).default('public'),
	isFree: boolTrue,
	includesEntry: bool,
	closesDate: optionalDate,
	closesTime: optionalTime,
	publishStatus: z.enum(PUBLISH_STATUSES).default('draft')
});
export const eventEditSchema = eventSchema.extend({ isActive: boolTrue });

export const assignmentSchema = z.object({
	userId: z.string().min(1, 'Choose who'),
	role: z.string().trim().min(1).max(32).default('guide')
});
