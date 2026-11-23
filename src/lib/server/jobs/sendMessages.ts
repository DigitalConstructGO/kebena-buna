/**
 * The outbox sender: takes queued messages that are due, renders each from its template and
 * hands it to the provider — GeezSMS for texts (`SMS_KEY`), SMTP for email (`SMTP_URL`,
 * `SMTP_FROM`). `NOTIFY_DRY_RUN=true` renders and marks them sent without sending; the dev server
 * does that unless it is set to `false`, since the seed holds made-up phone numbers.
 *
 * A message is claimed (`queued` → `sending`) by a conditional update before it is sent, so two
 * servers never send the same one. A failure goes back in the queue with a growing wait, and is
 * `failed` after `MAX_ATTEMPTS`; staff can queue it again from Admin › Messages.
 */
import { and, asc, desc, eq, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import nodemailer, { type Transporter } from 'nodemailer';
import { dev } from '$app/env';
import { NOTIFY_DRY_RUN, SMS_KEY, SMTP_FROM, SMTP_URL } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { marketingConsent, notification, notificationTemplate } from '#lib/server/db/schema.ts';
import { renderTemplate, type Payload } from '#lib/server/notify.ts';

const DRY_RUN = NOTIFY_DRY_RUN ?? dev;
const BATCH = 25;
const MAX_ATTEMPTS = 5;
/** A message left `sending` this long was cut off mid-send (a restart) and is queued again. */
const STALE_MINUTES = 10;

type Message = typeof notification.$inferSelect;
type Outcome = { status: 'sent'; providerRef?: string } | { status: 'skipped' | 'retry'; error: string };

/** Sends what is due. Returns how many messages it handled. */
export async function sendDueMessages(): Promise<number> {
	await db
		.update(notification)
		.set({ status: 'queued' })
		.where(
			and(
				eq(notification.status, 'sending'),
				lt(notification.scheduledFor, sql`NOW() - INTERVAL ${STALE_MINUTES} MINUTE`)
			)
		);

	const due = await db
		.select({ id: notification.id })
		.from(notification)
		.where(and(eq(notification.status, 'queued'), lte(notification.scheduledFor, sql`NOW()`)))
		.orderBy(asc(notification.scheduledFor), asc(notification.id))
		.limit(BATCH);

	let handled = 0;
	for (const { id } of due) {
		// Claimed here or by another server; `scheduledFor` now marks when sending started.
		const [claim] = await db
			.update(notification)
			.set({ status: 'sending', attempts: sql`${notification.attempts} + 1`, scheduledFor: sql`NOW()` })
			.where(and(eq(notification.id, id), eq(notification.status, 'queued')));
		if (!claim.affectedRows) continue;
		const [m] = await db.select().from(notification).where(eq(notification.id, id));
		const outcome = await sendOne(m).catch(
			(err: unknown): Outcome => ({ status: 'retry', error: err instanceof Error ? err.message : String(err) })
		);
		await settle(m, outcome);
		handled++;
	}
	return handled;
}

async function settle(m: Message, outcome: Outcome) {
	if (outcome.status === 'sent') {
		await db
			.update(notification)
			.set({ status: 'sent', sentAt: new Date(), lastError: null, providerRef: outcome.providerRef ?? null })
			.where(eq(notification.id, m.id));
		return;
	}
	if (outcome.status === 'skipped') {
		await db.update(notification).set({ status: 'skipped', lastError: outcome.error.slice(0, 500) }).where(eq(notification.id, m.id));
		return;
	}
	const attempts = m.attempts; // already counted at the claim
	const giveUp = attempts >= MAX_ATTEMPTS;
	if (!giveUp) console.warn(`[messages] #${m.id} ${m.channel} failed (try ${attempts}): ${outcome.error}`);
	else console.error(`[messages] #${m.id} ${m.channel} failed for good: ${outcome.error}`);
	await db
		.update(notification)
		.set({
			status: giveUp ? 'failed' : 'queued',
			lastError: outcome.error.slice(0, 500),
			// 1, 4, 9, 16 minutes between tries.
			scheduledFor: giveUp ? m.scheduledFor : sql`NOW() + INTERVAL ${attempts * attempts} MINUTE`
		})
		.where(eq(notification.id, m.id));
}

async function sendOne(m: Message): Promise<Outcome> {
	if (m.isMarketing && !(await consented(m))) {
		return { status: 'skipped', error: `No ${m.channel} marketing consent on record` };
	}
	const template = await findTemplate(m.templateKey, m.channel, m.locale);
	if (!template) return { status: 'skipped', error: `No ${m.channel} template “${m.templateKey}”` };
	const payload = (m.payload ?? {}) as Payload;

	if (m.channel === 'sms') {
		const text = renderTemplate(template.body, payload).trim();
		if (DRY_RUN) return dryRun(m, text);
		return sendSms(m.recipient, text);
	}
	if (m.channel === 'email') {
		const subject = renderTemplate(template.subject ?? '', payload).trim() || 'Kebena Coffee';
		const html = renderTemplate(template.body, payload, true);
		if (DRY_RUN) return dryRun(m, subject);
		return sendEmail(m.recipient, subject, html);
	}
	return { status: 'skipped', error: `${m.channel} sending is not set up` };
}

/**
 * The template in the message's language, else Amharic, else English — so a language added later
 * still gets a message before its wording is written.
 */
async function findTemplate(key: string, channel: Message['channel'], locale: string) {
	const locales = [...new Set([locale, 'am', 'en'])];
	const rows = await db
		.select({ locale: notificationTemplate.locale, subject: notificationTemplate.subject, body: notificationTemplate.body })
		.from(notificationTemplate)
		.where(
			and(
				eq(notificationTemplate.key, key),
				eq(notificationTemplate.channel, channel),
				inArray(notificationTemplate.locale, locales),
				eq(notificationTemplate.isActive, true),
				isNull(notificationTemplate.deletedAt)
			)
		);
	return locales.map((l) => rows.find((r) => r.locale === l)).find(Boolean) ?? null;
}

/** The latest consent row for the customer and channel says yes. */
async function consented(m: Message) {
	if (!m.customerId) return false;
	const [latest] = await db
		.select({ granted: marketingConsent.granted })
		.from(marketingConsent)
		.where(and(eq(marketingConsent.customerId, m.customerId), eq(marketingConsent.channel, m.channel)))
		.orderBy(desc(marketingConsent.id))
		.limit(1);
	return Boolean(latest?.granted);
}

function dryRun(m: Message, summary: string): Outcome {
	console.log(`[messages] dry run #${m.id} ${m.channel} → ${m.recipient}: ${summary.slice(0, 120)}`);
	return { status: 'sent', providerRef: 'dry-run' };
}

const SMS_API_URL = 'https://api.geezsms.com/api/v1/sms/send';

/** GeezSMS wants `2519…` and answers `{ error: false }` on success. */
async function sendSms(phone: string, text: string): Promise<Outcome> {
	if (!SMS_KEY) return { status: 'retry', error: 'SMS_KEY is not set on the server' };
	const res = await fetch(SMS_API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-GeezSMS-Key': SMS_KEY },
		body: JSON.stringify({ token: SMS_KEY, phone: phone.replace(/^\+/, ''), msg: text }),
		signal: AbortSignal.timeout(15_000)
	});
	const data = (await res.json().catch(() => null)) as { error?: boolean; msg?: string; data?: { id?: string } } | null;
	if (res.status >= 400 || !data || data.error === true) {
		return { status: 'retry', error: String(data?.msg ?? `The SMS provider answered ${res.status}`) };
	}
	return { status: 'sent', providerRef: data.data?.id ? String(data.data.id) : undefined };
}

let transport: Transporter | undefined;

async function sendEmail(to: string, subject: string, html: string): Promise<Outcome> {
	if (!SMTP_URL || !SMTP_FROM) return { status: 'retry', error: 'SMTP_URL and SMTP_FROM must be set on the server' };
	transport ??= nodemailer.createTransport(SMTP_URL);
	const info = await transport.sendMail({ from: SMTP_FROM, to, subject, html });
	return { status: 'sent', providerRef: info.messageId?.slice(0, 100) };
}
