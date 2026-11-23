/** The customer and delivery forms. Client-safe, so each dialog validates with its action's schema. */
import { z } from 'zod/v4';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { CONTACT_CHANNELS, CREDIT_REASONS } from '#lib/constants.ts';
import { LANG_CHOICES, LANGS } from '#lib/languages.ts';
import {
	amText,
	bool,
	boolTrue,
	code,
	enText,
	moneyField,
	optionalDate,
	optionalEmail,
	optionalId,
	optionalMoney,
	optionalNumber,
	optionalText,
	requiredId,
	requiredText,
	sortOrder
} from '#lib/schemas/common.ts';

export const LOCALES = LANG_CHOICES;

export const CUSTOMER_SOURCES = ['web', 'desk', 'telegram', 'newsletter_import', 'wholesale', 'phone'];

/**
 * A phone stored as E.164: an Ethiopian mobile in any shape people type it (`0911 23 45 67`)
 * becomes `+251911234567`; a foreign number must already start with `+` and its country code.
 */
export const phoneField = z.preprocess(
	(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
	z
		.string()
		.trim()
		.transform((v, ctx) => {
			const local = normalizePhone(v);
			if (local) return local;
			const intl = v.replace(/[\s\-.()]/g, '');
			if (/^\+[1-9]\d{7,14}$/.test(intl)) return intl;
			ctx.addIssue({ code: 'custom', message: 'A mobile like 0911 234 567, or +44… for abroad' });
			return z.NEVER;
		})
		.nullable()
		.optional()
);

export const customerSchema = z.object({
	name: requiredText(150, 'Their name'),
	phone: phoneField,
	email: optionalEmail,
	locale: z.enum(LANGS).default('am'),
	tin: optionalText(20),
	businessName: optionalText(150),
	telegramChatId: optionalText(32),
	source: optionalText(32),
	notes: optionalText(500)
});
export const customerEditSchema = customerSchema.extend({
	id: z.coerce.number(),
	isActive: boolTrue
});

export const addressSchema = z.object({
	label: optionalText(50),
	recipientName: optionalText(150),
	phone: phoneField,
	areaId: optionalId,
	city: requiredText(64).default('Addis Ababa'),
	woreda: optionalText(64),
	line1: requiredText(255, 'House, building, street'),
	landmark: optionalText(255),
	latitude: optionalNumber,
	longitude: optionalNumber,
	isDefault: bool
});
export const addressEditSchema = addressSchema.extend({ id: z.coerce.number() });

export const consentSchema = z.object({
	channel: z.enum(CONTACT_CHANNELS),
	granted: z.enum(['granted', 'withdrawn']),
	source: requiredText(32).default('staff')
});

export const creditSchema = z.object({
	direction: z.enum(['credit', 'debit']).default('credit'),
	amount: z.coerce.number().positive('More than zero'),
	reason: z.enum(CREDIT_REASONS),
	expiresAt: optionalDate,
	note: optionalText(255)
});

// ── Delivery ──────────────────────────────────────────────────────────────────────────────────

export const zoneSchema = z.object({
	code: code(20),
	nameEn: enText(120),
	nameAm: amText(120),
	nameOm: amText(120),
	nameAr: amText(120),
	nameIt: amText(120),
	nameFr: amText(120),
	fee: moneyField,
	currency: z.string().trim().length(3).default('ETB'),
	freeAbove: optionalMoney,
	freeForMembers: boolTrue,
	isPickup: bool,
	usesCourier: bool,
	transitDays: z.coerce.number().int().min(0).default(0),
	sortOrder,
	status: boolTrue
});
export const zoneEditSchema = zoneSchema.extend({ id: z.coerce.number() });

export const areaSchema = z.object({
	nameEn: enText(120),
	nameAm: amText(120),
	nameOm: amText(120),
	nameAr: amText(120),
	nameIt: amText(120),
	nameFr: amText(120),
	zoneId: requiredId('Choose the zone'),
	sortOrder,
	status: boolTrue
});
export const areaEditSchema = areaSchema.extend({ id: z.coerce.number() });

export const courierSchema = z.object({
	name: requiredText(64),
	phone: optionalText(20),
	trackingUrlTemplate: optionalText(255),
	status: boolTrue
});
export const courierEditSchema = courierSchema.extend({ id: z.coerce.number() });
