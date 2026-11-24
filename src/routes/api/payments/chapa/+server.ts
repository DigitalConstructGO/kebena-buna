import { json } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { webhookSignatureOk } from '@nahu/admin-kit/server/chapa';
import { db } from '#lib/server/db/index.ts';
import { payment, webhookEvent } from '#lib/server/db/schema.ts';
import { floodRefused, settleByTxRef } from '#lib/server/site.ts';
import type { RequestHandler } from './$types';

/**
 * Chapa's webhook. The body is only a hint: it is kept (`webhook_event`, replayable from the
 * dashboard), and the payment is then settled from Chapa's own `verify` answer, the same way as a
 * buyer's return. A repeat of an event already processed is acknowledged and skipped.
 *
 * Kept small and cheap for strangers: a body over 64 KB, a flood, or a `tx_ref` that is not one of
 * our payments is answered without writing anything.
 */
const MAX_BODY = 64 * 1024;

export const POST: RequestHandler = async (event) => {
	if (floodRefused(event, 'chapa-hook', 60)) return json({ ok: false }, { status: 429 });
	if (Number(event.request.headers.get('content-length') ?? 0) > MAX_BODY)
		return json({ ok: false }, { status: 413 });
	const raw = await event.request.text();
	if (raw.length > MAX_BODY) return json({ ok: false }, { status: 413 });
	const signed = webhookSignatureOk(
		raw,
		event.request.headers.get('x-chapa-signature') ?? event.request.headers.get('chapa-signature')
	);
	if (!signed) return json({ ok: false }, { status: 401 });

	let body: { tx_ref?: string; reference?: string; status?: string; event?: string };
	try {
		body = JSON.parse(raw);
	} catch {
		return json({ ok: false }, { status: 400 });
	}
	const txRef = body.tx_ref;
	if (typeof txRef !== 'string' || !txRef) return json({ ok: true });
	const [ours] = await db
		.select({ id: payment.id })
		.from(payment)
		.where(eq(payment.txRef, txRef))
		.limit(1);
	if (!ours) return json({ ok: true });
	const eventId = `${body.reference ?? txRef}:${body.status ?? body.event ?? 'event'}`.slice(
		0,
		128
	);

	const [seen] = await db
		.select({ id: webhookEvent.id, processedAt: webhookEvent.processedAt })
		.from(webhookEvent)
		.where(and(eq(webhookEvent.provider, 'chapa'), eq(webhookEvent.eventId, eventId)))
		.limit(1);
	if (seen?.processedAt) return json({ ok: true });
	const id =
		seen?.id ??
		(
			await db.insert(webhookEvent).values({
				provider: 'chapa',
				eventId,
				eventType: body.event ?? body.status ?? null,
				payload: body,
				signatureValid: signed
			})
		)[0].insertId;

	try {
		await settleByTxRef(event, txRef);
		await db
			.update(webhookEvent)
			.set({ processedAt: new Date(), error: null })
			.where(eq(webhookEvent.id, id));
	} catch (err) {
		await db
			.update(webhookEvent)
			.set({ error: String(err instanceof Error ? err.message : err).slice(0, 500) })
			.where(eq(webhookEvent.id, id));
		return json({ ok: false }, { status: 500 });
	}
	return json({ ok: true });
};
