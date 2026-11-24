import { readBundles, readChoices } from '#lib/server/cart.ts';
import { menuPages } from '#lib/server/sitePages.ts';
import type { LayoutServerLoad } from './$types';

/**
 * Bags in the cart, for the header — loose and in bundles, counted off the cookies, not priced: the
 * cart page prices them — and the Website section's menu pages, for the footer.
 */
export const load: LayoutServerLoad = async ({ cookies }) => ({
	cartCount:
		readChoices(cookies).reduce((sum, l) => sum + l.quantity, 0) +
		readBundles(cookies).reduce((sum, b) => sum + b.bags * b.quantity, 0),
	menuPages: await menuPages()
});
