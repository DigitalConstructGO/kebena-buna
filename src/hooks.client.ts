import { defineCustomClientStrategy } from '#lib/paraglide/runtime.js';
import { addressLocale } from '#lib/site/locale.ts';

// Site pages take their language from the address (`#lib/site/locale`); the setter has nothing to
// store, since switching language is a link to the other prefix.
defineCustomClientStrategy('custom-prefix', {
	getLocale: () => addressLocale(window.location.pathname),
	setLocale: () => {}
});
