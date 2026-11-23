import { loadFlash } from 'sveltekit-flash-message/server';
import { siteTextEdits } from '#lib/server/siteText.ts';

/**
 * The flash message a redirect carried (`redirect(…, { type, message }, cookies)`), and the
 * dashboard's edits to the site's words, for the browser's copy of `#lib/i18n.ts`.
 */
export const load = loadFlash(async () => ({ siteText: await siteTextEdits() }));
