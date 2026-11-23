/**
 * The languages the shop is written in — client-safe, so forms, columns and the server agree.
 * Keep `LANGS` in step with `locales` in `project.inlang/settings.json` and the `language` table.
 *
 * Translated text lives in `localized` JSON columns (`{ en, am, om, ar, it, fr }`), so adding a language
 * here needs no migration; its form fields follow the `nameEn`/`nameAm` pattern via `LANG_SUFFIX`.
 */
export const LANGS = ['en', 'am', 'om', 'ar', 'it', 'fr'] as const;
export type Lang = (typeof LANGS)[number];

/** The form-field suffix of each language: `nameEn`, `nameAm`, `nameOm`, `nameAr`, `nameIt`, `nameFr`. */
export const LANG_SUFFIX = {
	en: 'En',
	am: 'Am',
	om: 'Om',
	ar: 'Ar',
	it: 'It',
	fr: 'Fr'
} as const satisfies Record<Lang, string>;

export const LANG_NAMES = {
	en: 'English',
	am: 'Amharic',
	om: 'Afaan Oromo',
	ar: 'Arabic',
	it: 'Italian',
	fr: 'French'
} as const satisfies Record<Lang, string>;

/** For a language picker: `{ value: 'am', name: 'Amharic' }`, Amharic first as the default. */
export const LANG_CHOICES = (['am', 'en', 'om', 'ar', 'it', 'fr'] as const).map((value) => ({
	value,
	name: LANG_NAMES[value]
}));

/** The order a translated value falls back through when the asked language is empty. */
export const FALLBACK_LANGS = ['en', 'am', 'om', 'ar', 'it', 'fr'] as const satisfies readonly Lang[];
