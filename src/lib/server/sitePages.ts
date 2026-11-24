/**
 * The Website section's content on the public site: pages at their own address (a child under its
 * parent's, `/visit/coffee-ceremony`), posts in the journal, and the knowledge base's public
 * questions as the FAQ. Only what is published, and published by now.
 *
 * A body is stored per language; a page in a language it was not written in shows the first
 * translation there is, as `tr` does for short text. Bodies were sanitised when saved and are
 * sanitised again here, so a row written another way never reaches the page unchecked.
 */
import { and, asc, count, desc, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { publicFileUrl } from '@nahu/admin-kit/files';
import { sanitizeRichHtml } from '@nahu/admin-kit/server/richText';
import { db } from '#lib/server/db/index.ts';
import { knowledgeEntry, page, post, postCategory, user } from '#lib/server/db/schema.ts';
import type { LocalizedBlocks } from '#lib/server/db/content.schema.ts';
import { htmlOf, minutesOf } from '#lib/server/content.ts';
import { FALLBACK_LANGS } from '#lib/languages.ts';

/**
 * Top-level slugs the site's own routes answer: a page with one of these is shown by that route
 * (or is the home page), never by the catch-all.
 */
const ROUTED = new Set([
	'home',
	'visit',
	'contact',
	'wholesale',
	'shop',
	'events',
	'experiences',
	'groups',
	'membership',
	'subscriptions',
	'history',
	'kingdoms',
	'journal',
	'faq',
	'cart',
	'checkout',
	'track',
	'trace',
	'pay',
	'order',
	'discount'
]);

const live = (
	status: typeof page.publishStatus | typeof post.publishStatus,
	at: typeof page.publishedAt | typeof post.publishedAt
) => and(eq(status, 'published'), or(isNull(at), lte(at, new Date())));

/** A body's HTML in `locale`, else in the first language it was written in. */
export function bodyIn(body: LocalizedBlocks | null | undefined, locale: string) {
	const html = [locale, ...FALLBACK_LANGS].map((l) => htmlOf(body, l)).find(Boolean) ?? '';
	return sanitizeRichHtml(html);
}

const picture = (file: string | null) => (file ? publicFileUrl(file) : null);

type PageRow = Pick<typeof page.$inferSelect, 'id' | 'slug' | 'parentId'>;

/** Every published page, for addresses: a page's path is its parents' slugs, then its own. */
async function livePages() {
	return db
		.select({
			id: page.id,
			slug: page.slug,
			parentId: page.parentId,
			title: page.title,
			showInMenu: page.showInMenu,
			sortOrder: page.sortOrder
		})
		.from(page)
		.where(
			and(
				isNull(page.deletedAt),
				eq(page.isActive, true),
				live(page.publishStatus, page.publishedAt)
			)
		)
		.orderBy(asc(page.sortOrder), asc(page.id));
}

function pathOf(p: PageRow, all: PageRow[]): string | null {
	const parts = [p.slug];
	let at = p;
	for (let guard = 0; at.parentId !== null; guard++) {
		const parent = all.find((x) => x.id === at.parentId);
		// An unpublished parent hides its children: their address runs through it.
		if (!parent || guard > 8) return null;
		parts.unshift(parent.slug);
		at = parent;
	}
	return parts.join('/');
}

/** The page at `/{path}`, with its children, or null. */
export async function pageAt(path: string, locale: string) {
	const all = await livePages();
	const found = all.find((p) => pathOf(p, all) === path);
	if (!found || path === 'home') return null;
	const [row] = await db.select().from(page).where(eq(page.id, found.id));
	const parent = found.parentId ? all.find((p) => p.id === found.parentId) : null;
	return {
		title: row.title,
		seoTitle: row.seoTitle,
		seoDescription: row.seoDescription,
		template: row.template,
		hero: picture(row.heroImage),
		html: bodyIn(row.body, locale),
		parent: parent ? { title: parent.title, href: `/${pathOf(parent, all)}` } : null,
		children: all
			.filter((p) => p.parentId === found.id)
			.map((p) => ({ title: p.title, href: `/${pathOf(p, all)}` }))
	};
}

/**
 * The pages staff put in the menu, as footer links: their own address, or the site's route for one
 * that has a route of its own (`/visit`). The home page is the logo.
 */
export async function menuPages() {
	const all = await livePages();
	return all
		.filter((p) => p.showInMenu && p.slug !== 'home')
		.map((p) => ({ title: p.title, path: pathOf(p, all) }))
		.filter((p): p is { title: typeof p.title; path: string } => p.path !== null)
		.map((p) => ({ title: p.title, href: `/${p.path}` }));
}

/**
 * True for a path the catch-all route may answer: not a top-level address a route of the site's own
 * owns. A child under one (`/visit/coffee-ceremony`) is fine: a real route there would win first.
 */
export const servedByCms = (path: string) => path.includes('/') || !ROUTED.has(path);

/* ── The journal ─────────────────────────────────────────────────────────────────────────── */

export const POSTS_PER_PAGE = 9;

const livePost = () =>
	and(isNull(post.deletedAt), eq(post.isActive, true), live(post.publishStatus, post.publishedAt));

/** Published posts, newest first, a page at a time; in one category when its slug is given. */
export async function journal(opts: { category?: string | null; page?: number }) {
	const [categories, cat] = await Promise.all([
		db
			.select({
				id: postCategory.id,
				slug: postCategory.slug,
				name: postCategory.name,
				posts: count(post.id)
			})
			.from(postCategory)
			.innerJoin(post, and(eq(post.categoryId, postCategory.id), livePost()))
			.where(isNull(postCategory.deletedAt))
			.groupBy(postCategory.id, postCategory.slug, postCategory.name)
			.orderBy(asc(postCategory.id)),
		opts.category
			? db
					.select({ id: postCategory.id })
					.from(postCategory)
					.where(eq(postCategory.slug, opts.category))
			: Promise.resolve([])
	]);
	const where = and(livePost(), cat[0] ? eq(post.categoryId, cat[0].id) : undefined);
	const n = Math.max(1, Math.trunc(opts.page ?? 1));
	const [rows, [{ total }]] = await Promise.all([
		db
			.select({
				slug: post.slug,
				title: post.title,
				excerpt: post.excerpt,
				cover: post.coverImage,
				publishedAt: post.publishedAt,
				categoryId: post.categoryId,
				body: post.body
			})
			.from(post)
			.where(where)
			.orderBy(desc(post.publishedAt), desc(post.id))
			.limit(POSTS_PER_PAGE)
			.offset((n - 1) * POSTS_PER_PAGE),
		db.select({ total: count() }).from(post).where(where)
	]);
	return {
		categories: categories.map(({ posts: _, ...c }) => c),
		category: cat[0] ? (categories.find((c) => c.id === cat[0].id) ?? null) : null,
		page: n,
		pages: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)),
		posts: rows.map(({ body, cover, ...p }) => ({
			...p,
			cover: picture(cover),
			minutes: minutesOf(body),
			category: categories.find((c) => c.id === p.categoryId)?.name ?? null
		}))
	};
}

/** One published post, with the next and previous ones for reading on. */
export async function postBySlug(slug: string, locale: string) {
	const [row] = await db
		.select({ post, category: postCategory, author: user.name })
		.from(post)
		.leftJoin(postCategory, eq(post.categoryId, postCategory.id))
		.leftJoin(user, eq(post.authorId, user.id))
		.where(and(eq(post.slug, slug), livePost()));
	if (!row) return null;
	const p = row.post;
	const related = await db
		.select({
			slug: post.slug,
			title: post.title,
			cover: post.coverImage,
			publishedAt: post.publishedAt
		})
		.from(post)
		.where(
			and(
				livePost(),
				p.categoryId ? eq(post.categoryId, p.categoryId) : undefined,
				inArray(post.publishStatus, ['published'])
			)
		)
		.orderBy(desc(post.publishedAt))
		.limit(4);
	return {
		title: p.title,
		excerpt: p.excerpt,
		seoTitle: p.seoTitle,
		seoDescription: p.seoDescription,
		cover: picture(p.coverImage),
		publishedAt: p.publishedAt,
		author: row.author,
		category: row.category ? { slug: row.category.slug, name: row.category.name } : null,
		minutes: minutesOf(p.body),
		html: bodyIn(p.body, locale),
		related: related
			.filter((r) => r.slug !== p.slug)
			.slice(0, 3)
			.map((r) => ({ ...r, cover: picture(r.cover) }))
	};
}

/* ── The FAQ ─────────────────────────────────────────────────────────────────────────────── */

/** The knowledge base's public questions, by topic in the order staff sorted them. */
export async function publicFaq() {
	const rows = await db
		.select({
			id: knowledgeEntry.id,
			topic: knowledgeEntry.topic,
			question: knowledgeEntry.question,
			answer: knowledgeEntry.answer
		})
		.from(knowledgeEntry)
		.where(
			and(
				eq(knowledgeEntry.isPublicFaq, true),
				eq(knowledgeEntry.isActive, true),
				isNull(knowledgeEntry.deletedAt)
			)
		)
		.orderBy(asc(knowledgeEntry.sortOrder), asc(knowledgeEntry.id));
	const topics: { topic: string; entries: typeof rows }[] = [];
	for (const r of rows) {
		const t = topics.find((x) => x.topic === r.topic);
		if (t) t.entries.push(r);
		else topics.push({ topic: r.topic, entries: [r] });
	}
	return topics;
}

/** Where a page is on the site now, for the editor's "View on site": null while it is not live. */
export async function livePagePath(id: number) {
	const all = await livePages();
	const p = all.find((x) => x.id === id);
	if (!p) return null;
	return p.slug === 'home' ? '/' : `/${pathOf(p, all) ?? ''}`;
}
