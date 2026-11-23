import { json } from '@sveltejs/kit';
import { discountRule, DiscountRefused } from '#lib/server/discounts.ts';
import { floodRefused } from '#lib/server/site.ts';
import { m } from '#lib/i18n.ts';
import type { RequestHandler } from './$types';

/**
 * What a discount code takes off, for the checkout's preview (`DiscountCode.svelte`). Only the
 * rule: the order's own checks — per-customer limit, minimum, what it applies to — run again when
 * it is placed. Rate-limited, so codes cannot be guessed by the thousand.
 */
export const GET: RequestHandler = async (event) => {
	if (floodRefused(event, 'discount', 10))
		return json({ ok: false, error: m.site_err_flood() }, { status: 429 });
	try {
		return json({ ok: true, rule: await discountRule(event.url.searchParams.get('code') ?? '') });
	} catch (err) {
		if (err instanceof DiscountRefused) return json({ ok: false, error: err.message });
		throw err;
	}
};
