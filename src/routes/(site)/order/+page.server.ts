import { redirect } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { siteHref } from '#lib/site/locale.ts';

/** The design's "Order" links (`/order`) lead to the shop. */
export const load = () => redirect(308, siteHref('/shop', getLocale()));
