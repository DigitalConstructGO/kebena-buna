import { loadFlash } from 'sveltekit-flash-message/server';

/** The flash message a redirect carried (`redirect(…, { type, message }, cookies)`). */
export const load = loadFlash(() => ({}));
