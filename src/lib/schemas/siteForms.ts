/**
 * The public site's enquiry forms (questionnaire 8.4, 11): contact, feedback, group and school
 * visits, private events, wholesale accounts and green-coffee quotes. Client-safe; messages come
 * out in the page's language (see `#lib/schemas/site`).
 */
import { z } from 'zod/v4';
import { BUSINESS_TYPES } from '#lib/constants.ts';
import { m } from '#lib/i18n.ts';
import {
	siteCount,
	siteDate,
	siteEmail,
	siteFormBase,
	siteOptionalDate,
	siteOptionalEmail,
	siteOptionalPhone,
	siteOptionalText,
	sitePhone,
	siteText
} from '#lib/schemas/site.ts';

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** General enquiry: a way to answer is required, email or phone (8.4). */
export const enquirySchema = z
	.object({
		name: siteText(150),
		email: siteOptionalEmail,
		phone: siteOptionalPhone,
		subject: siteText(255),
		message: siteText(5000),
		...siteFormBase
	})
	.superRefine((v, ctx) => {
		if (!v.email && !v.phone)
			ctx.addIssue({ code: 'custom', path: ['email'], message: m.contact_err_reach() });
	});

export const feedbackSchema = z.object({
	rating: z.coerce
		.number()
		.int()
		.min(1, { error: () => m.contact_err_rating() })
		.max(5, { error: () => m.contact_err_rating() })
		.default(0),
	message: siteText(5000),
	name: siteOptionalText(150),
	email: siteOptionalEmail,
	visitDate: siteOptionalDate,
	...siteFormBase
});

export const GROUP_KINDS = ['school', 'group'] as const;

/** Schools and groups of 10+ ask; staff confirm a date, hold the places and invoice (6.6). */
export const groupSchema = z.object({
	kind: z.enum(GROUP_KINDS).default('group'),
	organisationName: siteText(150),
	contactName: siteText(150),
	phone: sitePhone,
	email: siteEmail,
	preferredDate1: siteDate,
	preferredDate2: siteOptionalDate,
	preferredDate3: siteOptionalDate,
	partySize: siteCount(10, 500),
	ageRange: siteText(60),
	tin: siteOptionalText(20),
	specialRequests: siteOptionalText(2000),
	...siteFormBase
});

/** Private hire, by quote (8.1). */
export const privateEventSchema = z.object({
	name: siteText(150),
	phone: sitePhone,
	email: siteEmail,
	eventType: siteText(100),
	preferredDate: siteDate,
	guestCount: siteCount(1, 2000),
	budget: siteOptionalText(60),
	catering: siteOptionalText(500),
	message: siteOptionalText(3000),
	...siteFormBase
});

/** A business account application (11.1); staff approve it before prices show (11.2). */
export const wholesaleSchema = z.object({
	name: siteText(150),
	type: z.enum(BUSINESS_TYPES).default('cafe'),
	tradeLicenceNumber: siteText(64),
	tradeLicenceFile: z.file().optional(),
	tin: siteText(20),
	vatNumber: siteOptionalText(32),
	contactName: siteText(150),
	contactPhone: sitePhone,
	contactEmail: siteOptionalEmail,
	expectedMonthlyKg: z.preprocess(
		blankToNull,
		z.coerce
			.number({ error: () => m.site_err_number() })
			.min(0, { error: () => m.site_err_min({ min: 0 }) })
			.nullable()
			.optional()
	),
	city: siteOptionalText(64),
	address: siteOptionalText(255),
	notes: siteOptionalText(500),
	...siteFormBase
});

export const INCOTERMS = ['FOB', 'CIF', 'EXW', 'DAP', 'other'] as const;

/** Green coffee for export stays offline; this only reaches the export team (11, scope). */
export const greenQuoteSchema = z.object({
	name: siteText(150),
	company: siteOptionalText(150),
	email: siteEmail,
	phone: siteOptionalPhone,
	country: siteText(80),
	origin: siteOptionalText(80),
	grade: siteOptionalText(40),
	bags: siteCount(1, 100000),
	incoterm: z.enum(INCOTERMS).default('FOB'),
	message: siteOptionalText(2000),
	...siteFormBase
});
