/** The wholesale portal's forms (questionnaire 11). Client-safe. */
import { z } from 'zod/v4';
import { BUSINESS_TYPES } from '#lib/constants.ts';
import {
	amText,
	bool,
	boolTrue,
	enText,
	kgField,
	optionalEmail,
	optionalId,
	optionalKg,
	optionalNumber,
	optionalText,
	percentField,
	requiredId,
	requiredText,
	sortOrder
} from '#lib/schemas/common.ts';
import { phoneField } from '#lib/schemas/customers.ts';

export const accountSchema = z.object({
	name: requiredText(150, 'The business name'),
	type: z.enum(BUSINESS_TYPES),
	tradeLicenceNumber: requiredText(64, 'The trade licence number'),
	tradeLicenceFile: z.file().optional(),
	tin: requiredText(20, 'The TIN'),
	vatNumber: optionalText(32),
	contactName: requiredText(150, 'Who to talk to'),
	contactPhone: phoneField.refine((v) => Boolean(v), 'A phone to reach them'),
	contactEmail: optionalEmail,
	expectedMonthlyKg: optionalKg,
	notes: optionalText(500)
});
export const accountEditSchema = accountSchema.extend({
	id: z.coerce.number(),
	isActive: boolTrue
});

/** Terms the Owner sets per account (11.3–11.5). */
export const termsSchema = z.object({
	discountPct: percentField,
	creditApproved: bool,
	creditLimit: z.coerce.number().min(0).default(0),
	paymentTermsDays: z.coerce.number().int().min(0).max(180).default(0),
	minOrderKg: optionalKg
});

export const decisionSchema = z.object({
	decision: z.enum(['approve', 'reject']),
	reason: optionalText(255)
});

export const memberSchema = z.object({
	customerId: requiredId('Choose the customer'),
	isAdmin: bool
});

export const businessAddressSchema = z.object({
	label: optionalText(50),
	areaId: optionalId,
	city: requiredText(64).default('Addis Ababa'),
	line1: requiredText(255, 'House, building, street'),
	landmark: optionalText(255),
	latitude: optionalNumber,
	longitude: optionalNumber,
	isBilling: bool,
	isDefaultDelivery: bool
});
export const businessAddressEditSchema = businessAddressSchema.extend({ id: z.coerce.number() });

export const tierSchema = z.object({
	nameEn: enText(80),
	nameAm: amText(80),
	nameOm: amText(80),
	nameAr: amText(80),
	nameIt: amText(80),
	nameFr: amText(80),
	minKg: kgField,
	maxKg: optionalKg,
	discountPct: percentField,
	sortOrder,
	status: boolTrue
});
export const tierEditSchema = tierSchema.extend({ id: z.coerce.number() });
