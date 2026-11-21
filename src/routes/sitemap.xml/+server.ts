import { locales, localizeHref } from '#lib/paraglide/runtime.js';

export const prerender = true;

const SITE = 'https://kebena-buna.vercel.app';
const PAGES = ['/', '/history', '/kingdoms'];

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
