/**
 * Building blocks for the public site's forms. Client-safe, so a form checks itself before posting
 * with the same rules its action applies.
 *
 * Messages are functions (`{ error: () => m.… }`), read when a check fails, so they come out in the
 * language of the page that shows them.
 */
import { z } from 'zod/v4';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { m } from '#lib/i18n.ts';

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const siteText = (max = 255) =>
	z
		.string()
		.trim()
		.min(1, { error: () => m.site_err_required() })
		.max(max, { error: () => m.site_err_long() });

export const siteOptionalText = (max = 255) =>
	z.preprocess(
		blankToNull,
		z
			.string()
			.trim()
			.max(max, { error: () => m.site_err_long() })
			.nullable()
			.optional()
	);

/** A phone stored as E.164: `0911 23 45 67` becomes `+251911234567`; abroad needs its `+code`. */
const toPhone = (v: string, ctx: z.RefinementCtx) => {
	const local = normalizePhone(v);
	if (local) return local;
	const intl = v.replace(/[\s\-.()]/g, '');
	if (/^\+[1-9]\d{7,14}$/.test(intl)) return intl;
	ctx.addIssue({ code: 'custom', message: m.site_err_phone() });
	return z.NEVER;
};
export const sitePhone = z
	.string()
	.trim()
	.min(1, { error: () => m.site_err_required() })
	.transform(toPhone);
export const siteOptionalPhone = z.preprocess(
	blankToNull,
	z.string().trim().transform(toPhone).nullable().optional()
);

export const siteEmail = z.email({ error: () => m.site_err_email() });
export const siteOptionalEmail = z.preprocess(blankToNull, siteEmail.nullable().optional());

export const siteDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: () => m.site_err_date() });
export const siteOptionalDate = z.preprocess(blankToNull, siteDate.nullable().optional());

export const siteCount = (min = 1, max = 500) =>
	z.coerce
		.number({ error: () => m.site_err_number() })
		.int({ error: () => m.site_err_number() })
		.min(min, { error: () => m.site_err_min({ min }) })
		.max(max, { error: () => m.site_err_max({ max }) });

/**
 * Fields every public form carries: the invisible spam check (`website`, left empty by people,
 * 8.4) and the marketing tick box, never pre-ticked.
 */
export const siteFormBase = {
	website: z.string().default(''),
	marketingConsent: z.boolean().default(false)
};

/** The buyer of an order: name and phone required (the phone is how the order finds them). */
export const buyerFields = {
	name: siteText(150),
	phone: sitePhone,
	email: siteOptionalEmail,
	/**
	 * Set once per form render, so a double submit makes one order. A UUID only: a resubmit with the
	 * same key lands on that order's private page, so the key must be unguessable.
	 */
	idempotencyKey: z
		.uuid()
		.optional()
		.or(z.literal('').transform(() => undefined))
};

/**
 * How a buyer means to pay, chosen at checkout when both ways are open: Chapa now, or a bank
 * transfer whose receipt they upload on the order's page next.
 */
export const payWithField = {
	payWith: z.enum(['online', 'transfer']).default('online'),
	/** A discount code, checked when the order is written (`claimDiscount`). */
	discountCode: siteOptionalText(32)
};
