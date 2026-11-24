import { z } from 'zod/v4';
import { error } from '@sveltejs/kit';
import { takeToken } from '@nahu/admin-kit/server/rateLimit';
import { GEMINI_API_KEY, GEMINI_MODEL } from '$app/env/private';
import { systemPrompt } from '#lib/server/chat/knowledge.ts';
import { converse, isBusy } from '#lib/server/chat/agent.ts';
import type { Content } from '#lib/server/chat/gemini.ts';
import { locales, type Locale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/i18n.ts';
import type { RequestHandler } from './$types';

/**
 * The site assistant (the chat button on public pages). Answers stream back as NDJSON, one
 * `{ text }` per line. Only what a visitor can read on the site goes to the model; see
 * `#lib/server/chat/knowledge.ts`.
 */

const LANG_NAMES: Record<Locale, string> = {
	en: 'English',
	am: 'Amharic',
	om: 'Afaan Oromo',
	ar: 'Arabic',
	it: 'Italian',
	fr: 'French'
};

const Body = z.object({
	messages: z
		.array(
			z.object({
				role: z.enum(['user', 'model']),
				text: z.string().trim().max(4000)
			})
		)
		.min(1)
		.refine((t) => t.at(-1)?.role === 'user' && t.at(-1)!.text !== '', 'last_turn')
		.refine((t) => t.at(-1)!.text.length <= 1000, 'too_long'),
	/** The page the visitor is on, so "this coffee" can be understood. */
	page: z.string().max(200).optional(),
	locale: z.enum(locales).optional()
});

/** Only the most recent turns go to the model — enough for context, bounded in cost. */
const HISTORY = 16;

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	const locale: Locale = (parsed.success && parsed.data.locale) || 'en';
	const t = { locale };

	if (!GEMINI_API_KEY) error(503, m.chat_err_off({}, t));

	// A browser always sends Origin on a POST; a different one is another site using our key.
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, m.chat_err_failed({}, t));

	// a burst of 10, then one question every 6 seconds; and a ceiling for everyone together
	const client = getClientAddress();
	if (
		!takeToken(`chat:${client}`, { capacity: 10, perMinute: 6 }) ||
		!takeToken(`chat:day:${client}`, { capacity: 150, perMinute: 150 / 1440 }) ||
		!takeToken('chat:all', { capacity: 120, perMinute: 15 })
	)
		error(429, m.chat_err_busy({}, t));

	if (!parsed.success) {
		const issue = parsed.error.issues[0]?.message;
		error(400, issue === 'too_long' ? m.chat_err_too_long({}, t) : m.chat_err_failed({}, t));
	}

	const { messages, page } = parsed.data;
	const contents: Content[] = messages
		.slice(-HISTORY)
		.filter((turn) => turn.text)
		.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }));
	// Gemini expects the conversation to open with the user
	while (contents[0]?.role === 'model') contents.shift();

	let system: string;
	try {
		system = await systemPrompt();
	} catch (e) {
		console.error('[chat] knowledge', e);
		error(502, m.chat_err_failed({}, t));
	}
	if (page) system += `\n\nThe visitor is on the page ${page}.`;
	if (locale !== 'en')
		system += `\nThey are reading the ${LANG_NAMES[locale]} version of the site: answer in ${LANG_NAMES[locale]} unless they write in another language. Keep link paths as the reference gives them (e.g. /shop); the site adds the language itself.`;

	const reply = converse({
		key: GEMINI_API_KEY,
		models: GEMINI_MODEL,
		system,
		contents,
		signal: request.signal
	});

	// Wait for the first words, so a refused request can still answer with a proper status.
	let first: IteratorResult<string>;
	try {
		first = await reply.next();
	} catch (e) {
		console.error('[chat]', e);
		if (isBusy(e)) error(503, m.chat_err_busy({}, t));
		error(502, m.chat_err_failed({}, t));
	}

	const encoder = new TextEncoder();
	const line = (text: string) => encoder.encode(`${JSON.stringify({ text })}\n`);
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			if (first.done) controller.close();
			else controller.enqueue(line(first.value));
		},
		async pull(controller) {
			try {
				const next = await reply.next();
				if (next.done) return controller.close();
				controller.enqueue(line(next.value));
			} catch (e) {
				if (!request.signal.aborted) console.error('[chat]', e);
				controller.enqueue(line(`\n\n_(${m.chat_err_cut_off({}, t)})_`));
				controller.close();
			}
		},
		cancel() {
			void reply.return(undefined);
		}
	});

	return new Response(body, {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'cache-control': 'no-store',
			// ask any proxy in front not to hold the stream back
			'x-accel-buffering': 'no'
		}
	});
};
