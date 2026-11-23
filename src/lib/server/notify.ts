/**
 * Putting customer messages in the outbox (questionnaire 3.3, 8.5). Callers name a template key
 * and fill its placeholders; one row is written per channel the person can be reached on (a text
 * to a phone, an email to an address), in the caller's transaction, so a message exists exactly
 * when the change it reports does. The sender (`#lib/server/jobs/sendMessages.ts`) delivers them.
 *
 *     await queueMessage(tx, 'order.paid', { phone, email, locale, customerId }, { order_number }, {
 *       refType: 'order', refId: o.id, dedupe: `order:${o.id}:paid`
 *     });
 */
import { sql } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { normalizePhone } from '@nahu/admin-kit/phone';
import { notification } from '#lib/server/db/schema.ts';

export type Recipient = {
	phone?: string | null;
	email?: string | null;
	locale?: string | null;
	customerId?: number | null;
	userId?: string | null;
};

export type QueueOptions = {
	/** What the message is about, for "messages sent for this order". */
	refType?: string;
	refId?: number | string;
	/**
	 * Names the occasion (`order:42:paid`): a second queue for the same one writes nothing, so a
	 * status set twice or a job run twice never sends twice. The channel is added per row.
	 */
	dedupe?: string;
	/** Not before this time (reminders); now when left out. */
	scheduledFor?: Date;
	/** Marketing goes out only to a granted consent; the sender checks it (9.3). */
	isMarketing?: boolean;
};

/** Placeholder values; anything left out renders as nothing. */
export type Payload = Record<string, string | number | null | undefined>;

/**
 * Queues `key` to every channel the recipient has. Returns how many rows were written: 0 when
 * there is no phone or email, or the occasion was queued before.
 */
export async function queueMessage(
	tx: Writer,
	key: string,
	to: Recipient,
	payload: Payload,
	opts: QueueOptions = {}
): Promise<number> {
	const phone = normalizePhone(to.phone);
	const email = to.email?.trim() || null;
	const targets: { channel: 'sms' | 'email'; recipient: string }[] = [];
	if (phone) targets.push({ channel: 'sms', recipient: phone });
	if (email) targets.push({ channel: 'email', recipient: email });

	let written = 0;
	for (const t of targets) {
		const [res] = await tx
			.insert(notification)
			.values({
				channel: t.channel,
				templateKey: key,
				locale: to.locale || 'am',
				recipient: t.recipient,
				customerId: to.customerId ?? null,
				userId: to.userId ?? null,
				payload,
				isMarketing: opts.isMarketing ?? false,
				dedupeKey: opts.dedupe ? `${opts.dedupe}:${t.channel}`.slice(0, 150) : null,
				refType: opts.refType ?? null,
				refId: opts.refId == null ? null : String(opts.refId),
				...(opts.scheduledFor ? { scheduledFor: opts.scheduledFor } : {})
			})
			// Already queued for this occasion: keep the first, write nothing.
			.onDuplicateKeyUpdate({ set: { dedupeKey: sql`${notification.dedupeKey}` } });
		written += res.affectedRows === 1 ? 1 : 0;
	}
	return written;
}

/** `{{name}}` filled from the payload; an unknown placeholder renders as nothing. */
export function renderTemplate(template: string, payload: Payload, escape = false): string {
	return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, name: string) => {
		const value = payload[name];
		const text = value == null ? '' : String(value);
		return escape ? escapeHtml(text) : text;
	});
}

function escapeHtml(text: string) {
	return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
