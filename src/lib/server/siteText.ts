/**
 * Website › Site text: the written wording of every public message (`messages/{locale}.json`) and
 * the staff edits laid over it (`site_text`). The edits are held in memory and read once per
 * process; a save or reset here refreshes them, so the next page shows the change. See `#lib/i18n.ts`.
 */
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { siteText } from '#lib/server/db/schema.ts';
import type { SiteText } from '#lib/i18n.ts';
import { LANGS, type Lang } from '#lib/languages.ts';

const files = import.meta.glob<Record<string, unknown>>('/messages/*.json', {
	eager: true,
	import: 'default'
});

/** `{ en: { key: pattern }, am: {…}, … }` as written in the message files. */
const written = Object.fromEntries(
	LANGS.map((lang) => {
		const file = files[`/messages/${lang}.json`] ?? {};
		const entries = Object.entries(file).filter(
			(e): e is [string, string] => !e[0].startsWith('$') && typeof e[1] === 'string'
		);
		return [lang, Object.fromEntries(entries)];
	})
) as Record<Lang, Record<string, string>>;

/** Every message key, in the order the English file lists them. */
export const MESSAGE_KEYS = Object.keys(written.en);

/** The written pattern of a key in a language ('' where it has no translation yet). */
export function writtenText(key: string, lang: Lang): string {
	return written[lang][key] ?? '';
}

let cache: Promise<SiteText> | undefined;

async function read(): Promise<SiteText> {
	const rows = await db.select({ key: siteText.key, value: siteText.value }).from(siteText);
	return Object.fromEntries(rows.map((r) => [r.key, r.value ?? {}]));
}

/** The edits in force. A failed read (no table yet) serves the written wording and retries later. */
export function siteTextEdits(): Promise<SiteText> {
	cache ??= read().catch((err: unknown) => {
		console.error('[site text] could not read edits:', err instanceof Error ? err.message : err);
		setTimeout(() => (cache = undefined), 60_000);
		return {};
	});
	return cache;
}

/**
 * Stores a key's wording, keeping only the languages that differ from what's written; with none
 * left, the row goes and the written wording is back.
 */
export async function saveSiteText(
	key: string,
	values: Partial<Record<Lang, string>>,
	userId?: string
) {
	const value: Record<string, string> = {};
	for (const lang of LANGS) {
		const text = values[lang]?.trim() ?? '';
		if (text && text !== writtenText(key, lang).trim()) value[lang] = text;
	}
	if (Object.keys(value).length) {
		await db
			.insert(siteText)
			.values({ key, value, updatedBy: userId ?? null })
			.onDuplicateKeyUpdate({ set: { value, updatedBy: userId ?? null, updatedAt: new Date() } });
	} else {
		await db.delete(siteText).where(eq(siteText.key, key));
	}
	cache = undefined;
	return value;
}

/** Puts a key back to the written wording in every language. */
export async function resetSiteText(key: string) {
	await db.delete(siteText).where(eq(siteText.key, key));
	cache = undefined;
}
