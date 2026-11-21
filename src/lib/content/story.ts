/**
 * The coffee-history and Gibe-kingdoms sections. Content is stored per locale
 * so the dashboard can edit every language separately. Today it is read from
 * the JSON files in ./data; when the dashboard lands, only `loadStory` changes
 * to read the database. The components never import the data directly.
 */
import historyData from './data/history.json';
import kingdomsData from './data/kingdoms.json';
import { baseLocale, type Locale } from '#lib/paraglide/runtime.js';

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
	/** The kingdom's name in other languages, shown when the visitor reads in one of them. */
	names: Partial<Record<Locale, string>>;
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

/** A section plus the language its text is actually in (it falls back to English). */
export type Localized<T> = { content: T; lang: Locale };

export type StoryContent = {
	history: Localized<HistoryContent> | null;
	kingdoms: Localized<KingdomsContent> | null;
};

type PerLocale<T> = Partial<Record<Locale, T>>;
const history = historyData as PerLocale<HistoryContent>;
const kingdoms = kingdomsData as unknown as PerLocale<KingdomsContent>;

function pick<T>(all: PerLocale<T>, locale: Locale): Localized<T> | null {
	const own = all[locale];
	if (own) return { content: own, lang: locale };
	const base = all[baseLocale];
	return base ? { content: base, lang: baseLocale } : null;
}

export type StoryMode = 'demo' | 'worst' | 'empty' | 'one';

/** The single read the page makes. Swap the body for a database query later. */
export function loadStory(locale: Locale, mode: StoryMode = 'demo'): Promise<StoryContent> {
	const story = { history: pick(history, locale), kingdoms: pick(kingdoms, locale) };
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
						? { ...c, title: 'የቡና ተክል ተፈጥሯዊ መገኛ፣ የማነቃቃት ባህሪው መታወቅ እና ወደ ዓለም መስፋፋቱ', image: { ...c.image, src: '/history/missing.jpg' } }
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
					...k.content.kingdoms.map((g, i) => (i === 4 ? { ...g, rulers: [], borders: [], capital: undefined } : g)),
					{ id: 'garo', name: 'Garo', names: {}, borders: [], summary: 'A small kingdom to the southeast of Jimma, conquered by Abba Gommol.', body: [], rulers: [] }
				]
			}
		}
	};
}
