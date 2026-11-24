/**
 * The assistant's turn: stream the answer as it comes. It has no tools — it talks, and points to
 * the page that does the rest — so one model call is one answer.
 */
import { GeminiError, streamParts, type Content, type Part } from './gemini.ts';

export async function* converse(opts: {
	key: string;
	/** Tried in order: a model that is out of quota or overloaded before it has said anything hands over to the next. */
	models: string[];
	system: string;
	contents: Content[];
	signal?: AbortSignal;
}): AsyncGenerator<string> {
	const models = [...opts.models];
	const stream = () =>
		streamParts({
			key: opts.key,
			model: models[0],
			system: opts.system,
			contents: opts.contents,
			signal: opts.signal
		});
	for await (const part of withFallback(stream, models)) {
		if (part.text && !part.thought) yield part.text;
	}
}

/** Out of quota (429), unknown (404) or overloaded (5xx): another model may still answer. */
export const isBusy = (e: unknown) =>
	e instanceof GeminiError && (e.status === 429 || e.status === 404 || e.status >= 500);

/**
 * Streams from `models[0]`, moving down the list while the current one is busy (see `isBusy`)
 * before yielding anything. When every model is busy at once — a demand spike on Google's side —
 * the list is tried once more after a short pause.
 */
async function* withFallback(stream: () => AsyncGenerator<Part>, models: string[]) {
	const all = [...models];
	let retried = false;
	for (;;) {
		const parts = stream();
		let first: IteratorResult<Part>;
		try {
			first = await parts.next();
		} catch (e) {
			if (isBusy(e) && models.length > 1) {
				console.warn(
					`[chat] ${models[0]} answered ${(e as GeminiError).status}, trying ${models[1]}`
				);
				models.shift();
				continue;
			}
			if (isBusy(e) && !retried) {
				retried = true;
				console.warn('[chat] every model is busy, trying again shortly');
				await new Promise((r) => setTimeout(r, 1500));
				models.splice(0, models.length, ...all);
				continue;
			}
			throw e;
		}
		if (!first.done) {
			yield first.value;
			yield* parts;
		}
		return;
	}
}
