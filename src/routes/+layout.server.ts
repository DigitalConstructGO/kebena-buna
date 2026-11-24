import { loadFlash } from 'sveltekit-flash-message/server';
import { GEMINI_API_KEY } from '$app/env/private';
import { siteTextEdits } from '#lib/server/siteText.ts';

/**
 * The flash message a redirect carried (`redirect(…, { type, message }, cookies)`), the
 * dashboard's edits to the site's words, for the browser's copy of `#lib/i18n.ts`, and whether
 * the site assistant is set up (no key, no chat button).
 */
export const load = loadFlash(async () => ({
	siteText: await siteTextEdits(),
	chatOn: Boolean(GEMINI_API_KEY)
}));
