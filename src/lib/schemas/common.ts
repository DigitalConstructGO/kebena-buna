/**
 * Zod building blocks every dashboard form shares. Client-safe, so a dialog validates with the same
 * schema its action does.
 *
 * Translated text (`localized` columns) is entered as one field per language — `nameEn`, `nameAm`,
 * `nameOm`, `nameAr`, `nameIt`, `nameFr` — and folded into `{ en, am, om, ar, it, fr }` on the server by `packLocalized` (`#lib/server/localized`).
 */
import { z } from 'zod/v4';

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** Text that may be left empty: trimmed, and empty becomes null. */
export const optionalText = (max = 255) =>
	z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());

export const requiredText = (max = 255, message = 'Required') =>
	z.string().trim().min(1, message).max(max);

/** A picker that may be left empty: empty or 0 is null. */
export const optionalId = z.preprocess(
	(v) => (v === '' || v === undefined || v === null || v === 0 || v === '0' ? null : v),
	z.coerce.number().int().positive().nullable()
);

export const requiredId = (message = 'Choose one') => z.coerce.number().int().positive(message);

/** A user id (varchar) that may be left empty. */
export const optionalUserId = z.preprocess(blankToNull, z.string().nullable().optional());

/** Birr, never negative. */
export const moneyField = z.coerce.number().min(0, 'Cannot be negative').default(0);
export const optionalMoney = z.preprocess(
	blankToNull,
	z.coerce.number().min(0, 'Cannot be negative').nullable().optional()
);

/** Kilograms, to the gram. */
export const kgField = z.coerce.number().min(0, 'Cannot be negative').default(0);
export const optionalKg = optionalMoney;

export const percentField = z.coerce.number().min(0).max(100).default(0);

export const optionalInt = z.preprocess(blankToNull, z.coerce.number().int().nullable().optional());
export const optionalNumber = z.preprocess(blankToNull, z.coerce.number().nullable().optional());

export const sortOrder = z.coerce.number().int().min(0).default(0);
export const bool = z.boolean().default(false);
export const boolTrue = z.boolean().default(true);

/** A `YYYY-MM-DD` from the kit's date input. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');
export const optionalDate = z.preprocess(blankToNull, isoDate.nullable().optional());
/** An `HH:MM` from a time input. */
export const clockTime = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Enter a time');
export const optionalTime = z.preprocess(blankToNull, clockTime.nullable().optional());

export const optionalEmail = z.preprocess(
	blankToNull,
	z.email('Enter a valid email address').nullable().optional()
);

/** A slug: lowercase words joined by hyphens. */
export const slug = z
	.string()
	.trim()
	.min(1, 'Required')
	.max(150)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only');

export const code = (max = 20) =>
	z
		.string()
		.trim()
		.min(1, 'Required')
		.max(max)
		.transform((v) => v.toUpperCase());

/**
 * English (required) and translated (optional) text of one field; `amText` serves Amharic, Afaan
 * Oromo and Arabic alike.
 */
export const enText = (max = 255) => requiredText(max, 'English text is required');
export const amText = (max = 255) => optionalText(max);
/** Both optional: a summary, a story. */
export const enOptional = (max = 5000) => optionalText(max);
