import { error, redirect } from '@sveltejs/kit';
import { floodRefused, settleByTxRef, trackHref } from '#lib/server/site.ts';
import { m } from '#lib/i18n.ts';
import type { PageServerLoad } from './$types';

/**
 * Where Chapa sends the buyer back. Nothing is trusted from the redirect itself: Chapa is asked
 * what happened, and the buyer lands on their order with the outcome.
 */
export const load: PageServerLoad = async (event) => {
	// Each visit asks Chapa, so strangers trying references are kept to a trickle.
	if (floodRefused(event, 'pay-return', 20)) error(429, m.site_err_flood());
	const result = await settleByTxRef(event, event.params.txRef);
	if (!result?.order) error(404, m.pay_not_found());
	redirect(303, `${trackHref(result.order)}&pay=${result.outcome}`);
};
