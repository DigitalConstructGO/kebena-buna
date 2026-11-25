/**
 * The coffee-history and Gibe-kingdoms sections. Every word is a Paraglide message
 * (`history_*`, `kingdoms_*`), so staff can edit any of them, in any language, from
 * Website › Site text; this module holds only the shape: ids, pictures, years and borders.
 * The content is built when the page asks for it, in the request's language.
 */
import { m } from '#lib/i18n.ts';
import { picture } from './picture.ts';
import type { Locale } from '#lib/paraglide/runtime.js';

export type StoryImage = {
	src: string;
	alt: string;
	/** A generated or drawn picture, not a photograph; the page labels it. */
	illustration?: boolean;
};

export type HistoryChapter = {
	id: string;
	title: string;
	body: string[];
	/** Marks the scene as legend or local belief, not verified history. */
	tradition: boolean;
	image: StoryImage;
};

export type HistoryContent = {
	eyebrow: string;
	title: string;
	chapters: HistoryChapter[];
};

export type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export type Ruler = {
	name: string;
	alias?: string;
	from?: number;
	to?: number;
	/** Dates given as "around" in the sources. */
	approx?: boolean;
	note: string;
};

export type Kingdom = {
	/** Matches a shape on the map: limmu | gumma | gomma | jimma | gera. */
	id: string;
	name: string;
	capital?: string;
	founded?: number;
	ended?: number;
	borders: { dir: Direction; to: string }[];
	summary: string;
	body: string[];
	rulers: Ruler[];
};

export type KingdomsContent = {
	eyebrow: string;
	title: string;
	intro: string;
	kingdoms: Kingdom[];
};

/** A section plus the language its text is in. */
export type Localized<T> = { content: T; lang: Locale };

export type StoryContent = {
	history: Localized<HistoryContent> | null;
	kingdoms: Localized<KingdomsContent> | null;
};

/* ------------------------------------------------------------------ */
/* The shape. Each id names its messages: history_ch_<id>_title, …     */
/* ------------------------------------------------------------------ */

const CHAPTERS: { id: string; tradition: boolean; src: string; illustration: boolean }[] = [
	{ id: 'origins', tradition: false, src: '/history/forest.webp', illustration: true },
	{ id: 'questions', tradition: false, src: '/hero/harvest-start.webp', illustration: false },
	{ id: 'jimma', tradition: false, src: '/halls/hall-02.webp', illustration: false },
	{ id: 'goatherd', tradition: true, src: '/history/goatherd.webp', illustration: true },
	{ id: 'monastery', tradition: true, src: '/history/monastery.webp', illustration: true },
	{ id: 'legend', tradition: false, src: '/hero/cup-start.webp', illustration: false },
	{ id: 'yemen', tradition: false, src: '/history/yemen.webp', illustration: true },
	{ id: 'ketta-muduga', tradition: false, src: '/halls/drying-beds.webp', illustration: false },
	{ id: 'footprints', tradition: true, src: '/history/footprints.webp', illustration: true },
	{ id: 'research', tradition: false, src: '/hero/museum.webp', illustration: false }
];

type RulerShape = {
	/** kingdoms_<kingdom>_ruler_<key>_name / _alias / _note */
	key: string;
	alias?: boolean;
	note?: boolean;
	from?: number;
	to?: number;
	approx?: boolean;
};

type KingdomShape = {
	id: string;
	founded?: number;
	ended?: number;
	/** Each has a kingdoms_<id>_border_<dir> message naming the neighbour. */
	borders: Direction[];
	rulers: RulerShape[];
};

const KINGDOMS: KingdomShape[] = [
	{
		id: 'limmu',
		borders: ['e', 's', 'w'],
		rulers: [
			{ key: 'bofo', alias: true, note: true },
			{ key: 'ibsa', alias: true, note: true, from: 1825, to: 1861, approx: true }
		]
	},
	{
		id: 'gumma',
		founded: 1810,
		ended: 1885,
		borders: ['ne', 's', 'n', 'w'],
		rulers: [
			{ key: 'jilcha', note: true },
			{ key: 'oncho', note: true, from: 1810, to: 1830, approx: true },
			{ key: 'abba_jubir', note: true },
			{ key: 'firisa', note: true }
		]
	},
	{
		id: 'gomma',
		ended: 1886,
		borders: ['n', 'w', 's', 'e'],
		rulers: [
			{ key: 'abba_boke', note: true },
			{ key: 'abba_manno', note: true, from: 1820, to: 1840, approx: true }
		]
	},
	{
		id: 'jimma',
		founded: 1742,
		ended: 1933,
		borders: ['w'],
		rulers: [
			{ key: 'abbaa_faro', note: true, from: 1742, to: 1787 },
			{ key: 'abbaa_magal', note: true, from: 1787, to: 1827 },
			{ key: 'abbaa_rago', from: 1827, to: 1830 },
			{ key: 'abba_jifar_i', note: true, from: 1830, to: 1855 },
			{ key: 'abba_rebu', note: true, from: 1855, to: 1858, approx: true },
			{ key: 'abba_boka', note: true, from: 1858, to: 1862, approx: true },
			{ key: 'abba_gommol', note: true, from: 1862, to: 1878, approx: true },
			{ key: 'abba_jifar_ii', note: true, from: 1878, to: 1933, approx: true }
		]
	},
	{
		id: 'gera',
		borders: ['n', 'e', 's'],
		rulers: [
			{ key: 'gunji', note: true },
			{ key: 'tullu_gunji', note: true, from: 1835, approx: true },
			{ key: 'abba_baso', note: true, to: 1838, approx: true },
			{ key: 'abba_rago', note: true, from: 1838, approx: true },
			{ key: 'abba_magal', note: true },
			{ key: 'genne_fa', note: true }
		]
	}
];

/* ------------------------------------------------------------------ */
/* Built from the messages at call time.                               */
/* ------------------------------------------------------------------ */

const messages = m as unknown as Record<string, ((inputs?: object) => string) | undefined>;

/** The message called `key`; the key itself if it is missing, so a gap shows on the page. */
const text = (key: string) => messages[key]?.() ?? key;
const paragraphs = (key: string) =>
	text(key)
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean);

function historyContent(): HistoryContent {
	return {
		eyebrow: text('history_eyebrow'),
		title: text('history_title'),
		chapters: CHAPTERS.map((c) => {
			const p = `history_ch_${c.id.replaceAll('-', '_')}`;
			return {
				id: c.id,
				title: text(`${p}_title`),
				body: paragraphs(`${p}_body`),
				tradition: c.tradition,
				image: {
					// swappable from the dashboard: history_ch_<id>_photo holds the picture's address
					src: picture(
						(inputs, options) =>
							(messages[`${p}_photo`] as Parameters<typeof picture>[0] | undefined)?.(
								inputs,
								options
							) ?? '',
						c.src
					),
					alt: text(`${p}_alt`),
					illustration: c.illustration
				}
			};
		})
	};
}

function kingdomsContent(): KingdomsContent {
	return {
		eyebrow: text('kingdoms_eyebrow'),
		title: text('kingdoms_title'),
		intro: text('kingdoms_intro'),
		kingdoms: KINGDOMS.map((k) => {
			const p = `kingdoms_${k.id}`;
			return {
				id: k.id,
				name: text(`${p}_name`),
				capital: text(`${p}_capital`),
				founded: k.founded,
				ended: k.ended,
				borders: k.borders.map((dir) => ({ dir, to: text(`${p}_border_${dir}`) })),
				summary: text(`${p}_summary`),
				body: paragraphs(`${p}_body`),
				rulers: k.rulers.map((r) => {
					const q = `${p}_ruler_${r.key}`;
					return {
						name: text(`${q}_name`),
						alias: r.alias ? text(`${q}_alias`) : undefined,
						from: r.from,
						to: r.to,
						approx: r.approx,
						note: r.note ? text(`${q}_note`) : ''
					};
				})
			};
		})
	};
}

export type StoryMode = 'demo' | 'worst' | 'empty' | 'one';

/** The single read the page makes, in the request's language. */
export function loadStory(locale: Locale, mode: StoryMode = 'demo'): Promise<StoryContent> {
	const story: StoryContent = {
		history: { content: historyContent(), lang: locale },
		kingdoms: { content: kingdomsContent(), lang: locale }
	};
	return Promise.resolve(mode === 'demo' ? story : stress(story, mode));
}

/* ------------------------------------------------------------------ */
/* Dev-only stress fixtures (?data=worst | empty | one).                */
/* ------------------------------------------------------------------ */

function stress(story: StoryContent, mode: Exclude<StoryMode, 'demo'>): StoryContent {
	const { history: h, kingdoms: k } = story;
	if (mode === 'empty') {
		return {
			history: h && { ...h, content: { ...h.content, chapters: [] } },
			kingdoms: k && { ...k, content: { ...k.content, kingdoms: [] } }
		};
	}
	if (mode === 'one') {
		return {
			history: h && { ...h, content: { ...h.content, chapters: h.content.chapters.slice(0, 1) } },
			kingdoms: k && { ...k, content: { ...k.content, kingdoms: k.content.kingdoms.slice(0, 1) } }
		};
	}
	// worst: a missing image, a chapter with no body, a long Ethiopic title, a kingdom with no dates or rulers
	return {
		history: h && {
			...h,
			content: {
				...h.content,
				chapters: h.content.chapters.map((c, i) =>
					i === 1
						? {
								...c,
								title: 'የቡና ተክል ተፈጥሯዊ መገኛ፣ የማነቃቃት ባህሪው መታወቅ እና ወደ ዓለም መስፋፋቱ',
								image: { ...c.image, src: '/history/missing.jpg' }
							}
						: i === 2
							? { ...c, body: [] }
							: c
				)
			}
		},
		kingdoms: k && {
			...k,
			content: {
				...k.content,
				kingdoms: [
					...k.content.kingdoms.map((g, i) =>
						i === 4 ? { ...g, rulers: [], borders: [], capital: undefined } : g
					),
					{
						id: 'garo',
						name: 'Garo',
						borders: [],
						summary: 'A small kingdom to the southeast of Jimma, conquered by Abba Gommol.',
						body: [],
						rulers: []
					}
				]
			}
		}
	};
}
