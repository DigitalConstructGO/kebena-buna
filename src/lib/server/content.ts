/**
 * Writes for the Website section: pages and posts with rich bodies kept as one HTML block per
 * language (`{ en: [{ type: 'html', html }], am: [...] }`), sanitised on the way in.
 */
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import { MySqlVarChar } from 'drizzle-orm/mysql-core';
import type { RequestEvent } from '@sveltejs/kit';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { storeFileFields } from '@nahu/admin-kit/server/files';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import type { Writer } from '@nahu/admin-kit/server/db';
import { htmlToText, readingMinutes, sanitizeRichHtml, summarize } from '@nahu/admin-kit/server/richText';
import { db } from '#lib/server/db/index.ts';
import { page, post, tourHotspot, tourScene } from '#lib/server/db/schema.ts';
import type { Block, LocalizedBlocks } from '#lib/server/db/content.schema.ts';
import { enOf, LANGS, packLocalized, unpackLocalized } from '#lib/server/localized.ts';
import { FALLBACK_LANGS, LANG_SUFFIX as suffix } from '#lib/languages.ts';
import type { z } from 'zod/v4';
import type {
	hotspotSchema,
	PageForm,
	PostForm,
	sceneEditSchema,
	sceneSchema
} from '#lib/schemas/content.ts';

/** The HTML of one language of a body: the `html` blocks joined (other block kinds left out). */
export function htmlOf(body: LocalizedBlocks | null | undefined, lang: string): string {
	const blocks = body?.[lang] ?? [];
	return blocks
		.filter((b: Block) => b.type === 'html' && typeof b.html === 'string')
		.map((b) => b.html as string)
		.join('\n');
}

/**
 * `bodyEn`/`bodyAm`/… from a form, sanitised, as the column's block lists. Other block kinds already
 * stored (a map, a video added by the front-end team) are kept after the HTML block.
 */
export function bodyFrom(
	values: Record<string, unknown>,
	before?: LocalizedBlocks | null
): LocalizedBlocks | null {
	const out: LocalizedBlocks = {};
	for (const lang of LANGS) {
		const raw = values[`body${suffix[lang]}`];
		const html = sanitizeRichHtml(typeof raw === 'string' ? raw : '');
		const others = (before?.[lang] ?? []).filter((b) => b.type !== 'html');
		const blocks: Block[] = [...(html ? [{ type: 'html', html }] : []), ...others];
		if (blocks.length) out[lang] = blocks;
	}
	return Object.keys(out).length ? out : null;
}

/** Plain-text reading time of a body's English (else the first translation's) HTML. */
export function minutesOf(body: LocalizedBlocks | null | undefined): number {
	const html = FALLBACK_LANGS.map((lang) => htmlOf(body, lang)).find(Boolean) ?? '';
	const text = htmlToText(html);
	return text ? readingMinutes(text) : 0;
}

/** A row's translated columns and its body, flattened for an edit form. */
export function docFormValues<T extends { body: LocalizedBlocks | null }>(
	row: T,
	localized: string[]
) {
	return {
		...unpackLocalized(row as Record<string, unknown>, localized),
		...Object.fromEntries(LANGS.map((lang) => [`body${suffix[lang]}`, htmlOf(row.body, lang)]))
	};
}

type DocTable = typeof page | typeof post;
type SlugTable = DocTable | typeof tourScene;

/**
 * A slug no other row of the table uses, or a refusal under the field. Deleted rows count too: the
 * column is unique, but a deleted row's address was suffixed when it went, so it no longer clashes.
 */
async function assertFreeSlug(table: SlugTable, slug: string, id?: number) {
	const [taken] = await db
		.select({ id: table.id })
		.from(table)
		.where(and(eq(table.slug, slug), id ? ne(table.id, id) : undefined))
		.limit(1);
	if (taken) throw new WriteRefused('slug', 'Another one already uses this address');
}

/**
 * A deleted row's address, freed for reuse: `~id` on the end, the address cut short enough that the
 * suffix always fits the column (cutting the whole thing could leave two rows the same).
 */
function freedSlug(table: SlugTable) {
	const max = (table.slug instanceof MySqlVarChar && table.slug.length) || 64;
	return sql`concat(left(${table.slug}, ${max} - char_length(concat('~', ${table.id}))), '~', ${table.id})`;
}

/** Refuses a parent that is the page itself or sits under it, which would make a loop. */
async function assertNoParentLoop(tx: Writer, id: number, parentId: number | null | undefined) {
	const seen = new Set<number>();
	for (let at = parentId ?? null; at; ) {
		if (at === id) throw new WriteRefused('parentId', 'A page cannot sit under itself or one of its own children');
		if (seen.has(at)) break;
		seen.add(at);
		const [up] = await tx.select({ parentId: page.parentId }).from(page).where(eq(page.id, at));
		at = up?.parentId ?? null;
	}
}

/** `publishedAt` follows the status: stamped the first time it is published, kept after. */
function publishedAtFor(status: string, before?: { publishedAt: Date | null }) {
	if (status !== 'published') return before?.publishedAt ?? null;
	return before?.publishedAt ?? new Date();
}

/** Adds (no id) or updates a page; returns its id. */
export async function savePage(event: RequestEvent, data: PageForm, posted: FormData, id?: number) {
	await assertFreeSlug(page, data.slug, id);
	const userId = event.locals.user?.id;
	return db.transaction(async (tx) => {
		const [before] = id ? await tx.select().from(page).where(eq(page.id, id)).for('update') : [];
		if (id) await assertNoParentLoop(tx, id, data.parentId);
		const values: Record<string, unknown> = { ...data };
		await storeFileFields(values, ['heroImage'], posted);
		values.body = bodyFrom(values, before?.body);
		for (const lang of LANGS) delete values[`body${suffix[lang]}`];
		packLocalized(values, ['title', 'seoTitle', 'seoDescription']);
		// A new one starts in the status picked; after that only the Publish / Unpublish / Archive
		// buttons move it (`setPublishStatus`), so a save from a form loaded before one of them
		// cannot put it back.
		if (before) values.publishStatus = before.publishStatus;
		values.publishedAt = publishedAtFor(values.publishStatus as string, before);
		const row = values as Partial<typeof page.$inferInsert>;
		if (before) {
			await tx.update(page).set({ ...row, updatedBy: userId }).where(eq(page.id, before.id));
			await recordAudit(tx, event, { table: 'page', recordId: before.id, action: 'update', before, after: row });
			return before.id;
		}
		const [res] = await tx.insert(page).values({ ...(row as typeof page.$inferInsert), createdBy: userId });
		await recordAudit(tx, event, { table: 'page', recordId: res.insertId, action: 'create' });
		return res.insertId;
	});
}

/** Adds (no id) or updates a post; returns its id. A missing excerpt is made from the body. */
export async function savePost(event: RequestEvent, data: PostForm, posted: FormData, id?: number) {
	await assertFreeSlug(post, data.slug, id);
	const userId = event.locals.user?.id;
	return db.transaction(async (tx) => {
		const [before] = id ? await tx.select().from(post).where(eq(post.id, id)).for('update') : [];
		const values: Record<string, unknown> = { ...data, authorId: data.authorId || userId };
		await storeFileFields(values, ['coverImage'], posted);
		values.body = bodyFrom(values, before?.body);
		for (const lang of LANGS) {
			const key = `excerpt${suffix[lang]}`;
			if (!values[key]) {
				const raw = values[`body${suffix[lang]}`];
				const text = htmlToText(sanitizeRichHtml(typeof raw === 'string' ? raw : ''));
				if (text) values[key] = summarize(text, 240);
			}
		}
		for (const lang of LANGS) delete values[`body${suffix[lang]}`];
		packLocalized(values, ['title', 'excerpt', 'seoTitle', 'seoDescription']);
		// A new one starts in the status picked; after that only the Publish / Unpublish / Archive
		// buttons move it (`setPublishStatus`), so a save from a form loaded before one of them
		// cannot put it back.
		if (before) values.publishStatus = before.publishStatus;
		values.publishedAt = publishedAtFor(values.publishStatus as string, before);
		const row = values as Partial<typeof post.$inferInsert>;
		if (before) {
			await tx.update(post).set({ ...row, updatedBy: userId }).where(eq(post.id, before.id));
			await recordAudit(tx, event, { table: 'post', recordId: before.id, action: 'update', before, after: row });
			return before.id;
		}
		const [res] = await tx.insert(post).values({ ...(row as typeof post.$inferInsert), createdBy: userId });
		await recordAudit(tx, event, { table: 'post', recordId: res.insertId, action: 'create' });
		return res.insertId;
	});
}

/** Moves a page or post to another publish status (publish, unpublish, archive). */
export async function setPublishStatus(
	event: RequestEvent,
	table: DocTable,
	audited: 'page' | 'post',
	id: number,
	status: 'draft' | 'published' | 'archived'
) {
	await db.transaction(async (tx) => {
		const [before] = await tx.select().from(table).where(eq(table.id, id)).for('update');
		const after = {
			publishStatus: status,
			publishedAt: publishedAtFor(status, before),
			updatedBy: event.locals.user?.id
		};
		await tx.update(table).set(after).where(eq(table.id, id));
		await recordAudit(tx, event, { table: audited, recordId: id, action: 'update', before, after });
	});
}

/**
 * Takes a page or post off for good (soft delete). Its address is freed — suffixed with its id — so
 * a new one can use it.
 */
export async function deleteDoc(event: RequestEvent, table: DocTable, audited: 'page' | 'post', id: number) {
	await db.transaction(async (tx) => {
		await tx
			.update(table)
			.set({
				deletedAt: new Date(),
				deletedBy: event.locals.user?.id ?? null,
				publishStatus: 'archived',
				slug: freedSlug(table)
			})
			.where(and(eq(table.id, id), isNull(table.deletedAt)));
		await recordAudit(tx, event, { table: audited, recordId: id, action: 'delete' });
	});
}

/** A refusal from a save, under its field, as a superforms message. */
export function refusal(err: unknown): { field?: string; text: string } | null {
	if (err instanceof WriteRefused) return { field: err.field ?? undefined, text: err.message };
	if (err && typeof err === 'object' && 'field' in err && err instanceof Error)
		return { field: (err as { field?: string }).field, text: err.message };
	return null;
}

/**
 * Pages as parent-picker options. `except` leaves out the page being edited and every page under
 * it, which the save would refuse as a loop.
 */
export async function pageOptions(except?: number) {
	const rows = await db
		.select({ value: page.id, name: enOf(page.title), parentId: page.parentId })
		.from(page)
		.where(isNull(page.deletedAt))
		.orderBy(asc(page.sortOrder));
	const under = new Set(except ? [except] : []);
	for (let grew = true; grew; ) {
		grew = false;
		for (const r of rows) {
			if (r.parentId && under.has(r.parentId) && !under.has(r.value)) {
				under.add(r.value);
				grew = true;
			}
		}
	}
	return rows.filter((r) => !under.has(r.value)).map(({ value, name }) => ({ value, name }));
}

/**
 * Adds (no id) or updates a 360° scene; returns its id. One start scene per site: marking this one
 * the start unmarks the others there.
 */
export async function saveScene(
	event: RequestEvent,
	data: z.infer<typeof sceneSchema> | z.infer<typeof sceneEditSchema>,
	posted: FormData,
	id?: number
) {
	await assertFreeSlug(tourScene, data.slug, id);
	const userId = event.locals.user?.id;
	const values: Record<string, unknown> = { ...data };
	delete values.id;
	await storeFileFields(values, ['panorama', 'preview'], posted);
	packLocalized(values, ['title', 'description']);
	const row = values as Partial<typeof tourScene.$inferInsert>;
	return db.transaction(async (tx) => {
		const [before] = id ? await tx.select().from(tourScene).where(eq(tourScene.id, id)).for('update') : [];
		if (data.isStart) {
			await tx
				.update(tourScene)
				.set({ isStart: false })
				.where(and(eq(tourScene.locationId, data.locationId), id ? ne(tourScene.id, id) : undefined));
		}
		if (before) {
			await tx.update(tourScene).set({ ...row, updatedBy: userId }).where(eq(tourScene.id, before.id));
			await recordAudit(tx, event, { table: 'tour_scene', recordId: before.id, action: 'update', before, after: row });
			return before.id;
		}
		const [res] = await tx.insert(tourScene).values({ ...(row as typeof tourScene.$inferInsert), createdBy: userId });
		await recordAudit(tx, event, { table: 'tour_scene', recordId: res.insertId, action: 'create' });
		return res.insertId;
	});
}

/** Takes a scene off the tour (soft delete), freeing its address — suffixed with its id. */
export async function deleteScene(event: RequestEvent, id: number) {
	await db.transaction(async (tx) => {
		await tx
			.update(tourScene)
			.set({ ...deletionStamp(event.locals.user?.id), isStart: false, slug: freedSlug(tourScene) })
			.where(and(eq(tourScene.id, id), isNull(tourScene.deletedAt)));
		await recordAudit(tx, event, { table: 'tour_scene', recordId: id, action: 'delete' });
	});
}

/** The target columns of a hotspot: only the one its kind uses is kept, the rest cleared. */
const TARGET_OF: Record<string, string | null> = {
	product: 'productId',
	lot: 'lotId',
	origin_map: 'stationId',
	booking: 'bookableId',
	scene: 'targetSceneId',
	link: 'url',
	info: null
};
const TARGETS = ['productId', 'lotId', 'stationId', 'bookableId', 'eventId', 'targetSceneId', 'url'];

/** Adds (no id) or updates a hotspot of a scene. */
export async function saveHotspot(
	event: RequestEvent,
	data: z.infer<typeof hotspotSchema> & { id?: number },
	id?: number
) {
	const values: Record<string, unknown> = { ...data };
	delete values.id;
	const keep = TARGET_OF[data.kind];
	for (const key of TARGETS) {
		// An event hotspot is an `info` one that names an event.
		if (key !== keep && !(key === 'eventId' && data.kind === 'info')) values[key] = null;
	}
	if (keep && !values[keep]) throw new WriteRefused(keep, 'Choose what this hotspot opens');
	packLocalized(values, ['title', 'body']);
	const userId = event.locals.user?.id;
	const row = values as Partial<typeof tourHotspot.$inferInsert>;
	await db.transaction(async (tx) => {
		if (id) {
			const [before] = await tx.select().from(tourHotspot).where(eq(tourHotspot.id, id));
			await tx
				.update(tourHotspot)
				.set({ ...row, updatedBy: userId })
				.where(and(eq(tourHotspot.id, id), eq(tourHotspot.sceneId, data.sceneId)));
			await recordAudit(tx, event, { table: 'tour_hotspot', recordId: id, action: 'update', before, after: row });
		} else {
			const [res] = await tx.insert(tourHotspot).values({ ...(row as typeof tourHotspot.$inferInsert), createdBy: userId });
			await recordAudit(tx, event, { table: 'tour_hotspot', recordId: res.insertId, action: 'create' });
		}
	});
}
