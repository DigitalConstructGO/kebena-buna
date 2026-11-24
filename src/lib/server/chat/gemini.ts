/**
 * A minimal client for Gemini's streaming REST endpoint. `fetch` is all it needs, so there is no
 * SDK to bundle (the server has no node_modules — see scripts/verify-build.ts).
 */

/** A part of a Gemini message. Model parts are replayed verbatim, thought signatures and all. */
export type Part = {
	text?: string;
	thought?: boolean;
	thoughtSignature?: string;
	functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
	functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
};

export type Content = { role: 'user' | 'model'; parts: Part[] };

export type FunctionDeclaration = {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
};

type Chunk = {
	candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
	promptFeedback?: { blockReason?: string };
	error?: { message?: string };
};

export class GeminiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

/**
 * Sends the conversation to Gemini and yields the model's parts as they arrive — text in
 * pieces, a function call whole. Throws a {@link GeminiError} if the request is refused.
 */
export async function* streamParts(opts: {
	key: string;
	model: string;
	system: string;
	contents: Content[];
	tools?: FunctionDeclaration[];
	/** `false` forbids function calls, so the model has to answer in words. */
	allowCalls?: boolean;
	signal?: AbortSignal;
}): AsyncGenerator<Part> {
	const res = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:streamGenerateContent?alt=sse`,
		{
			method: 'POST',
			signal: opts.signal,
			headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.key },
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: opts.system }] },
				contents: opts.contents,
				...(opts.tools?.length && {
					tools: [{ functionDeclarations: opts.tools }],
					toolConfig: {
						functionCallingConfig: { mode: opts.allowCalls === false ? 'NONE' : 'AUTO' }
					}
				}),
				generationConfig: {
					temperature: 0.6,
					maxOutputTokens: 1200,
					// a website chat wants a quick first word more than deep deliberation
					thinkingConfig: { thinkingLevel: 'low' }
				}
			})
		}
	);

	if (!res.ok || !res.body) {
		const detail = await res.text().catch(() => '');
		throw new GeminiError(`Gemini answered ${res.status}: ${detail.slice(0, 500)}`, res.status);
	}

	const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += value;
		// server-sent events are separated by a blank line
		let end;
		while ((end = buffer.search(/\r?\n\r?\n/)) !== -1) {
			const event = buffer.slice(0, end);
			buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, '');
			const data = event
				.split(/\r?\n/)
				.filter((line) => line.startsWith('data:'))
				.map((line) => line.slice(5).trimStart())
				.join('\n');
			if (!data) continue;

			const chunk = JSON.parse(data) as Chunk;
			if (chunk.error) throw new GeminiError(chunk.error.message ?? 'Gemini error', 502);
			if (chunk.promptFeedback?.blockReason)
				throw new GeminiError(`Blocked: ${chunk.promptFeedback.blockReason}`, 400);
			yield* chunk.candidates?.[0]?.content?.parts ?? [];
		}
	}
}
