/** Membership and subscription forms. Client-safe, so each dialog validates as its action does. */
import { z } from 'zod/v4';
import {
	MEMBERSHIP_STATUSES,
	PUBLISH_STATUSES,
	RENEWAL_METHODS,
	SUBSCRIPTION_FREQUENCIES
} from '#lib/constants.ts';
import {
	amText,
	bool,
	boolTrue,
	code,
	enOptional,
	enText,
	isoDate,
	moneyField,
	optionalDate,
	optionalId,
	optionalInt,
	optionalText,
	percentField,
	requiredId,
	requiredText,
	sortOrder
} from '#lib/schemas/common.ts';

// ── Plans ────────────────────────────────────────────────────────────────────────────────────

export const membershipPlanSchema = z.object({
	code: code(24),
	nameEn: enText(100),
	nameAm: amText(100),
	nameOm: amText(100),
	nameAr: amText(100),
	nameIt: amText(100),
	nameFr: amText(100),
	descriptionEn: enOptional(2000),
	descriptionAm: amText(2000),
	descriptionOm: amText(2000),
	descriptionAr: amText(2000),
	descriptionIt: amText(2000),
	descriptionFr: amText(2000),
	benefitsEn: enOptional(2000),
	benefitsAm: amText(2000),
	benefitsOm: amText(2000),
	benefitsAr: amText(2000),
	benefitsIt: amText(2000),
	benefitsFr: amText(2000),
	requiresProofEn: enOptional(255),
	requiresProofAm: amText(255),
	requiresProofOm: amText(255),
	requiresProofAr: amText(255),
	requiresProofIt: amText(255),
	requiresProofFr: amText(255),
	price: moneyField,
	taxRateId: optionalId,
	durationMonths: z.coerce.number().int().min(1).max(60).default(12),
	graceDays: z.coerce.number().int().min(0).max(90).default(7),
	maxAdults: z.coerce.number().int().min(0).max(50).default(1),
	maxChildren: z.coerce.number().int().min(0).max(50).default(0),
	sharedCardAdmits: optionalInt,
	freeEntry: boolTrue,
	shopDiscountPct: percentField,
	freeDelivery: boolTrue,
	membersOnlyEvents: boolTrue,
	monthlyCoffeeVariantId: optionalId,
	publishStatus: z.enum(PUBLISH_STATUSES).default('draft'),
	sortOrder,
	isActive: boolTrue,
	image: z.file().optional()
});
export const membershipPlanEditSchema = membershipPlanSchema.extend({ id: z.coerce.number() });

export const subscriptionPlanSchema = z.object({
	nameEn: enText(100),
	nameAm: amText(100),
	nameOm: amText(100),
	nameAr: amText(100),
	nameIt: amText(100),
	nameFr: amText(100),
	deliveries: z.coerce.number().int().min(1).max(52),
	discountPct: percentField,
	sortOrder,
	status: boolTrue
});
export const subscriptionPlanEditSchema = subscriptionPlanSchema.extend({ id: z.coerce.number() });

// ── Memberships ──────────────────────────────────────────────────────────────────────────────

export const newMembershipSchema = z.object({
	customerId: requiredId('Choose the customer'),
	planId: requiredId('Choose the plan'),
	startsOn: isoDate,
	renewalMethod: z.enum(RENEWAL_METHODS).default('manual_link')
});

export const membershipTermSchema = z
	.object({
		planId: requiredId('Choose the plan'),
		status: z.enum(MEMBERSHIP_STATUSES),
		startsOn: optionalDate,
		endsOn: optionalDate,
		graceEndsOn: optionalDate,
		renewalMethod: z.enum(RENEWAL_METHODS)
	})
	.refine((v) => !v.startsOn || !v.endsOn || v.endsOn > v.startsOn, {
		path: ['endsOn'],
		message: 'The term must end after it starts'
	})
	.refine((v) => !v.endsOn || !v.graceEndsOn || v.graceEndsOn >= v.endsOn, {
		path: ['graceEndsOn'],
		message: 'Grace cannot end before the term does'
	});

export const cancelSchema = z.object({ reason: requiredText(255, 'Say why') });

export const memberSchema = z.object({
	name: requiredText(150, 'The member’s name'),
	isChild: bool,
	birthYear: optionalInt,
	photo: z.file().optional()
});
export const memberEditSchema = memberSchema.extend({ id: z.coerce.number(), status: boolTrue });

// ── Subscriptions ────────────────────────────────────────────────────────────────────────────

export const subscriptionEditSchema = z.object({
	frequency: z.enum(SUBSCRIPTION_FREQUENCIES),
	variantId: requiredId('Choose the coffee'),
	roastLevelId: requiredId('Choose the roast'),
	grindId: optionalId,
	quantity: z.coerce.number().int().min(1).max(20),
	addressId: optionalId,
	deliveryZoneId: optionalId,
	nextRoastDate: optionalDate
});

export const pauseSchema = z.object({ pausedUntil: isoDate });

export const subscriptionCancelSchema = z.object({
	unusedSettlement: z.enum(['refund', 'store_credit']),
	note: optionalText(255)
});
