/**
 * How the dashboard writes dates, money, weights and translated names — client-safe, used by
 * columns and pages alike, so a figure reads the same everywhere.
 */
import { formatDateIn } from '@nahu/admin-kit/calendars';
import { formatETB } from '@nahu/admin-kit/global';
import { localClock, localDate } from '@nahu/admin-kit/time';
import { FALLBACK_LANGS, LANG_NAMES } from '#lib/languages.ts';

/** Text kept per language (`{ en, am, om, ar, it, fr }`), as the `localized` columns store it. */
export type Localized = Record<string, string> | null | undefined;

/**
 * One language's text from a `localized` value: the asked language, else English, Amharic, Afaan
 * Oromo, Arabic in turn, else whatever is there. Never throws on a plain string (a column read raw).
 */
export function tr(value: Localized | string, locale = 'en'): string {
	if (!value) return '';
	if (typeof value === 'string') return value;
	return (
		value[locale] ||
		FALLBACK_LANGS.map((lang) => value[lang]).find(Boolean) ||
		Object.values(value).find(Boolean) ||
		''
	);
}

/** "ETB 1,500.00". */
export const money = (amount: number | string | null | undefined) => formatETB(Number(amount ?? 0));

/** "1,500.00" — an amount in a column already headed in birr. */
export const amount = (value: number | string | null | undefined) =>
	Number(value ?? 0).toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

/** A quantity: up to three places, no trailing zeros — "12", "1.375". */
export const qty = (value: number | string | null | undefined, unit?: string | null) => {
	const n = Number(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
	return unit ? `${n} ${unit}` : n;
};

/** Kilograms of coffee: "12.5 kg". */
export const kg = (value: number | string | null | undefined) =>
	value === null || value === undefined ? '—' : qty(value, 'kg');

/** "12.5%". */
export const pct = (value: number | string | null | undefined) =>
	value === null || value === undefined
		? '—'
		: `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;

/** A `YYYY-MM-DD` (or a Date) as "12 Oct 2026". Empty gives "—". */
export function formatDate(value: string | Date | null | undefined): string {
	if (!value) return '—';
	const iso = value instanceof Date ? localDate(value) : String(value).slice(0, 10);
	return formatDateIn(iso, 'gregorian', 'en-GB', 'short') || '—';
}

/** An instant as "12 Oct 2026 · 14:05", in Addis Ababa time. */
export function formatDateTime(value: string | Date | null | undefined): string {
	if (!value) return '—';
	return `${formatDate(localDate(value))} · ${localClock(value)}`;
}

/** A `HH:MM:SS` time column as "14:05". */
export const clock = (value: string | null | undefined) => (value ? value.slice(0, 5) : '—');

const LANGUAGES: Record<string, string> = LANG_NAMES;

/** A language code as its name: `am` → "Amharic". An unknown code is shown as it is. */
export const languageName = (code: string | null | undefined) =>
	code ? (LANGUAGES[code] ?? code) : '—';

/**
 * How an order leaves, in the words staff use: `none` is a sale handed over at the counter,
 * which "None" made read like a missing value.
 */
export const deliveryName = (method: string | null | undefined) =>
	method === 'none' ? 'At the counter' : humanize(method);

/** An enum value as words: `out_for_delivery` → "Out for delivery". */
export function humanize(value: string | null | undefined): string {
	if (!value) return '—';
	const words = value.replaceAll('_', ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** `{ value, name }` choices for a select, from one of the lists in `#lib/constants`. */
export const choicesOf = (values: readonly string[]) =>
	values.map((value) => ({ value, name: humanize(value) }));

/** "Yes" / "No". */
export const yesNo = (value: boolean | null | undefined) => (value ? 'Yes' : 'No');

export const WEEKDAYS = [
	'',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
	'Sunday'
];

/** ISO weekday choices, 1 Monday … 7 Sunday. */
export const WEEKDAY_CHOICES = WEEKDAYS.slice(1).map((name, i) => ({ value: String(i + 1), name }));
