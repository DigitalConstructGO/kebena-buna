/**
 * The public site keeps its language in the address, as the kebena-buna.vercel.app design does:
 * English at `/shop`, every other language under its code (`/am/shop`, `/fr/shop`). The dashboard
 * has no prefix, so it keeps reading the language from the cookie.
 *
 * Registered as Paraglide's `custom-prefix` strategy (`hooks.server.ts`, `hooks.client.ts`), first
 * in the list, so `m.*()` and `getLocale()` follow the address on site pages.
 */
import { baseLocale, locales, type Locale } from '#lib/paraglide/runtime.js';

const PREFIXED = locales.filter((l) => l !== baseLocale);

/** The language a path is under, or `undefined` for an unprefixed (English or dashboard) path. */
export function prefixLocale(pathname: string): Locale | undefined {
	const code = pathname.split('/')[1];
	return (PREFIXED as string[]).includes(code) ? (code as Locale) : undefined;
}

/** Staff pages, which keep the language their user chose (the cookie) rather than the address. */
const STAFF = /^\/(dashboard|login|logout|api)(\/|$)/;

/**
 * The language the `custom-prefix` strategy reports: the prefix on a site page, English on an
 * unprefixed one (`/shop` is the English shop, whatever the cookie says), and nothing on staff
 * pages, so they fall through to the cookie.
 */
export function addressLocale(pathname: string): Locale | undefined {
	if (STAFF.test(pathname)) return undefined;
	return prefixLocale(pathname) ?? baseLocale;
}

/** `path` (`/shop`, `/#visit`) under `locale`'s prefix: `/am/shop`, or `/shop` for English. */
export function siteHref(path: string, locale: Locale): string {
	if (locale === baseLocale) return path;
	return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/** The same page in another language: `/am/shop/x` → `/fr/shop/x`. */
export function switchLocale(pathname: string, locale: Locale): string {
	const current = prefixLocale(pathname);
	const bare = current ? pathname.slice(current.length + 1) || '/' : pathname;
	return siteHref(bare, locale);
}
