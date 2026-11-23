/**
 * The writer behind changes nobody clicked: a background job settling a Chapa payment, expiring
 * an order. Order writes (`moveOrder`, `recordAudit`) take a request event for who did it and
 * from where; this one says "the system" — no user, the server's own address.
 */
import type { RequestEvent } from '@sveltejs/kit';
import { ORIGIN } from '$app/env/private';

export function systemEvent(): RequestEvent {
	return {
		locals: { user: null, session: null },
		url: new URL(ORIGIN),
		getClientAddress: () => '127.0.0.1'
	} as unknown as RequestEvent;
}
