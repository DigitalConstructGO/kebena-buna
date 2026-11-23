/**
 * Translated columns (`localized` in `db/fields.ts`, stored as `{ en, am, om, ar, it, fr }`) in forms and
 * queries.
 *
 * Forms carry one flat field per language (`nameEn`, `nameAm`, `nameOm`, `nameAr`, …); `packLocalized`
 * folds them into the column on write, `unpackLocalized` spreads a row back out for an edit form. `enOf` reads the
 * English text in SQL, for list columns, sorting, search and pickers.
 */
import { sql, type SQL } from 'drizzle-orm';
import { sanitizeRichHtml } from '@nahu/admin-kit/server/richText';
import type { AnyMySqlColumn } from 'drizzle-orm/mysql-core';
import type { Localized } from '#lib/server/db/fields.ts';
import { FALLBACK_LANGS, LANGS, LANG_SUFFIX as suffix } from '#lib/languages.ts';

export { LANGS };

/** `{ en, am, … }` from `nameEn`/`nameAm`/…, empty languages left out; null when every one is empty. */
export function toLocalized(values: Record<string, unknown>, field: string): Localized | null {
	const out: Localized = {};
	for (const lang of LANGS) {
		const v = values[`${field}${suffix[lang]}`];
		if (typeof v === 'string' && v.trim()) out[lang] = v.trim();
	}
	return Object.keys(out).length ? out : null;
}

/** Folds each field's per-language keys into the column, in place, and returns the values. */
export function packLocalized<T extends Record<string, unknown>>(values: T, fields: string[]): T {
	const v = values as Record<string, unknown>;
	for (const field of fields) {
		v[field] = toLocalized(v, field);
		for (const lang of LANGS) delete v[`${field}${suffix[lang]}`];
	}
	return values;
}

/** A row with `nameEn`/`nameAm`/… beside each translated column, for seeding an edit form. */
export function unpackLocalized<T extends Record<string, unknown>>(
	row: T,
	fields: string[]
): T & Record<string, string> {
	const out: Record<string, unknown> = { ...row };
	for (const field of fields) {
		const value = (row[field] ?? {}) as Localized;
		for (const lang of LANGS) out[`${field}${suffix[lang]}`] = value?.[lang] ?? '';
	}
	return out as T & Record<string, string>;
}

/** Only the per-language fields of `fields` (`nameEn`, `nameAm`, …), empty where a language is. */
export function flatLocalized(
	row: Record<string, unknown>,
	fields: string[]
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const field of fields) {
		const value = (row[field] ?? {}) as Localized;
		for (const lang of LANGS) out[`${field}${suffix[lang]}`] = value?.[lang] ?? '';
	}
	return out;
}

/** Like `toLocalized`, for rich text: each language's HTML sanitised first. */
export function toRichLocalized(values: Record<string, unknown>, field: string): Localized | null {
	const clean: Record<string, string> = {};
	for (const lang of LANGS) {
		const key = `${field}${suffix[lang]}`;
		const raw = values[key];
		clean[key] = sanitizeRichHtml(typeof raw === 'string' ? raw : '');
	}
	return toLocalized(clean, field);
}

/** The English text of a translated column, falling back through the other languages — as SQL. */
export const enOf = (column: AnyMySqlColumn | SQL): SQL<string> =>
	sql<string>`coalesce(${sql.join(
		FALLBACK_LANGS.map((l) => sql`json_unquote(json_extract(${column}, ${sql.raw(`'$.${l}'`)}))`),
		sql`, `
	)}, '')`;
