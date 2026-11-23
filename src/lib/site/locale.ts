/**
 * The public site keeps its language in the address: English at `/shop`, every other language
 * under its code (`/am/shop`, `/fr/shop`). Paraglide's `url` strategy reads it (`vite.config.ts`);
 * the dashboard is routed to the cookie instead. These build the site's own links.
 */
import { baseLocale, locales, type Locale } from '#lib/paraglide/runtime.js';

const PREFIXED = locales.filter((l) => l !== baseLocale);

/** The language a path is under, or `undefined` for an unprefixed (English or dashboard) path. */
export function prefixLocale(pathname: string): Locale | undefined {
	const code = pathname.split('/')[1];
	return (PREFIXED as string[]).includes(code) ? (code as Locale) : undefined;
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
