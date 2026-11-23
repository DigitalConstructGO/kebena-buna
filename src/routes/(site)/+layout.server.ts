import { readChoices } from '#lib/server/cart.ts';
import type { LayoutServerLoad } from './$types';

/** Bags in the cart, for the header. Counted off the cookie, not priced: the cart page prices it. */
export const load: LayoutServerLoad = ({ cookies }) => ({
	cartCount: readChoices(cookies).reduce((sum, l) => sum + l.quantity, 0)
});
