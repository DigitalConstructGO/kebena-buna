import { error, redirect } from '@sveltejs/kit';
import { settleByTxRef, trackHref } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

/**
 * Where Chapa sends the buyer back. Nothing is trusted from the redirect itself: Chapa is asked
 * what happened, and the buyer lands on their order with the outcome.
 */
export const load: PageServerLoad = async (event) => {
	const result = await settleByTxRef(event, event.params.txRef);
	if (!result?.order) error(404, 'Payment not found');
	redirect(303, `${trackHref(result.order)}&pay=${result.outcome}`);
};
