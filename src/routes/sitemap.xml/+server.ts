import { locales, localizeHref } from '#lib/paraglide/runtime.js';
import { SITE_URL as SITE } from '#lib/site/seo.ts';

export const prerender = true;

/** The museum's pages and the site's public ones; product and event pages come and go, so they are left to links. */
const PAGES = [
	'/',
	'/history',
	'/kingdoms',
	'/visit',
	'/experiences',
	'/events',
	'/shop',
	'/membership',
	'/subscriptions',
	'/groups',
	'/wholesale',
	'/contact'
];

/** Every page in every language, each listing its translations. */
export const GET = () => {
	const urls = PAGES.map((path) => {
		const alts = locales
			.map(
				(l) =>
					`<xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${localizeHref(path, { locale: l })}"/>`
			)
			.join('');
		return locales
			.map((l) => `<url><loc>${SITE}${localizeHref(path, { locale: l })}</loc>${alts}</url>`)
			.join('');
	}).join('');
	const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`;
	return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
