/**
 * The site's words: Paraglide's messages, with the dashboard's edits laid over them.
 *
 * Every message is written in `messages/{locale}.json` and compiled by Paraglide. Staff can change
 * any of them from Website › Site text without a rebuild; those edits live in the `site_text` table
 * and reach this module through `setSiteText` (the server hook on every request, the root layout in
 * the browser). Import `m` from here, not from `#lib/paraglide/messages.js`, or an edit won't show.
 *
 * An edit is a pattern in Paraglide's own syntax, so `{name}` is filled the same way.
 */
import { m as compiled } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';

/** `{ key: { en: '…', am: '…' } }` — only the keys and languages someone edited. */
export type SiteText = Record<string, Record<string, string>>;

let edits: SiteText = {};

/** Replaces the edits in force. Cheap; the same object for every visitor in a language. */
export function setSiteText(next: SiteText | null | undefined) {
	edits = next ?? {};
}

/** `{name}` in a pattern filled from the message's inputs; an unknown name is left as written. */
export function fill(pattern: string, inputs?: Record<string, unknown>): string {
	return pattern.replace(/\{\s*([A-Za-z_][\w]*)\s*\}/g, (whole, name: string) => {
		const value = inputs?.[name];
		return typeof value === 'string' || typeof value === 'number' ? String(value) : whole;
	});
}

type Fn = (inputs?: Record<string, unknown>, options?: { locale?: string }) => string;
const registry = compiled as unknown as Record<string, Fn>;
const wrapped = new Map<string, Fn>();

function wrap(key: string): Fn | undefined {
	const base = registry[key];
	if (typeof base !== 'function') return undefined;
	let fn = wrapped.get(key);
	if (!fn) {
		fn = (inputs, options) => {
			const edit = edits[key]?.[options?.locale ?? getLocale()];
			return edit ? fill(edit, inputs) : base(inputs ?? {}, options);
		};
		wrapped.set(key, fn);
	}
	return fn;
}

/** Paraglide's `m`, each message checking the dashboard's edits first. */
export const m = new Proxy({} as typeof compiled, {
	get: (_, key) => (typeof key === 'string' ? wrap(key) : undefined),
	has: (_, key) => typeof key === 'string' && key in registry,
	ownKeys: () => Reflect.ownKeys(registry),
	getOwnPropertyDescriptor: (_, key) =>
		typeof key === 'string' && key in registry
			? { enumerable: true, configurable: true, value: wrap(key) }
			: undefined
});
