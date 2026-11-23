import { fail } from '@sveltejs/kit';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import {
	MESSAGE_KEYS,
	resetSiteText,
	saveSiteText,
	siteTextEdits,
	writtenText
} from '#lib/server/siteText.ts';
import { LANGS, LANG_SUFFIX as suffix, type Lang } from '#lib/languages.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * What each key prefix is, in the order a visitor meets it. A prefix missing here still shows,
 * under its own name, so a new page's words are never hidden.
 */
const GROUPS: [prefix: string, label: string][] = [
	['site', 'Menu, footer and forms'],
	['museum', 'Museum: hero, doors, tour, bag, floor plan'],
	['home', 'Home page sections'],
	['history', 'History'],
	['kingdoms', 'Kingdoms'],
	['story', 'History maps'],
	['shop', 'Shop'],
	['cart', 'Cart'],
	['checkout', 'Checkout'],
	['pay', 'Payment'],
	['visit', 'Visit and tickets'],
	['events', 'Events'],
	['exp', 'Experiences'],
	['groups', 'Groups and schools'],
	['member', 'Membership'],
	['subs', 'Subscriptions'],
	['wholesale', 'Wholesale'],
	['contact', 'Contact'],
	['track', 'Order tracking'],
	['trace', 'Trace a bag']
];
const LABELS = new Map(GROUPS);
/** Keys that aren't page text. */
const HIDDEN = new Set(['hello_world']);

const prefixOf = (key: string) => key.split('_')[0];
const keys = () => MESSAGE_KEYS.filter((k) => !HIDDEN.has(k));

/** The public site's words, a group (or a search) at a time, with each language's edit. */
export const load: PageServerLoad = async ({ url }) => {
	const edits = await siteTextEdits();
	const all = keys();

	const counts = new Map<string, { total: number; edited: number }>();
	for (const key of all) {
		const c = counts.get(prefixOf(key)) ?? { total: 0, edited: 0 };
		c.total++;
		if (edits[key]) c.edited++;
		counts.set(prefixOf(key), c);
	}
	const order = GROUPS.map(([p]) => p);
	const groups = [...counts.entries()]
		.sort(([a], [b]) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999))
		.map(([prefix, c]) => ({ prefix, label: LABELS.get(prefix) ?? prefix, ...c }));

	const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
	const edited = url.searchParams.get('edited') === '1';
	const group = q || edited ? '' : (url.searchParams.get('group') ?? groups[0]?.prefix ?? '');

	const matches = (key: string) =>
		key.includes(q) ||
		LANGS.some((lang) => (edits[key]?.[lang] ?? writtenText(key, lang)).toLowerCase().includes(q));
	const shown = all.filter((key) =>
		q ? matches(key) : edited ? Boolean(edits[key]) : prefixOf(key) === group
	);

	return {
		groups,
		group,
		q,
		edited,
		editedTotal: Object.keys(edits).length,
		/** Capped so a one-letter search can't send the whole site. */
		more: Math.max(0, shown.length - 200),
		entries: shown.slice(0, 200).map((key) => ({
			key,
			written: Object.fromEntries(LANGS.map((l) => [l, writtenText(key, l)])) as Record<
				Lang,
				string
			>,
			edit: edits[key] ?? {}
		}))
	};
};

const text = (data: FormData, name: string) => {
	const v = data.get(name);
	return typeof v === 'string' ? v : '';
};

function keyOf(data: FormData) {
	const key = text(data, 'key');
	return MESSAGE_KEYS.includes(key) && !HIDDEN.has(key) ? key : null;
}

export const actions: Actions = {
	save: async (event) => {
		requirePermission(event.locals, 'content.manage');
		const data = await event.request.formData();
		const key = keyOf(data);
		if (!key) return fail(400, { message: { type: 'error', text: 'That line no longer exists.' } });

		const values = Object.fromEntries(
			LANGS.map((lang) => [lang, text(data, `text${suffix[lang]}`)])
		) as Record<Lang, string>;
		const tooLong = LANGS.find((lang) => values[lang].length > 20_000);
		if (tooLong) return fail(400, { message: { type: 'error', text: 'That text is too long.' } });

		const before = (await siteTextEdits())[key] ?? {};
		const after = await saveSiteText(key, values, event.locals.user?.id);
		await recordAudit(db, event, {
			table: 'site_text',
			recordId: key,
			action: 'update',
			before,
			after
		});
		return {
			message: {
				type: 'success',
				text: Object.keys(after).length
					? 'Saved. The website shows it now.'
					: 'Same as the written wording; nothing to keep.'
			}
		};
	},

	reset: async (event) => {
		requirePermission(event.locals, 'content.manage');
		const key = keyOf(await event.request.formData());
		if (!key) return fail(400, { message: { type: 'error', text: 'That line no longer exists.' } });
		const before = (await siteTextEdits())[key];
		if (!before) return { message: { type: 'success', text: 'Already the written wording.' } };
		await resetSiteText(key);
		await recordAudit(db, event, {
			table: 'site_text',
			recordId: key,
			action: 'delete',
			detail: { before }
		});
		return { message: { type: 'success', text: 'Back to the written wording.' } };
	}
};
