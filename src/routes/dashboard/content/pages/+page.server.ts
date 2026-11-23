import { asc, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { db } from '#lib/server/db/index.ts';
import { page } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { updater } from '#lib/server/people.ts';
import { minutesOf } from '#lib/server/content.ts';

const parent = alias(page, 'parent');

/** Website › Pages: every page, grouped under its parent, in menu order. */
export const load = async () => {
	const rows = await db
		.select({
			id: page.id,
			slug: page.slug,
			title: enOf(page.title),
			parentId: page.parentId,
			parent: enOf(parent.title),
			template: page.template,
			showInMenu: page.showInMenu,
			sortOrder: page.sortOrder,
			publishStatus: page.publishStatus,
			publishedAt: page.publishedAt,
			body: page.body,
			updatedById: page.updatedBy,
			updatedBy: updater.name,
			updatedAt: page.updatedAt
		})
		.from(page)
		.leftJoin(parent, eq(page.parentId, parent.id))
		.leftJoin(updater, eq(page.updatedBy, updater.id))
		.where(isNull(page.deletedAt))
		.orderBy(asc(page.sortOrder), asc(page.id));

	// Children straight after their parent, at every depth, so the list reads as the site's tree.
	type Row = (typeof rows)[number];
	const ordered: { row: Row; depth: number }[] = [];
	const seen = new Set<number>();
	const visit = (r: Row, depth: number) => {
		if (seen.has(r.id)) return;
		seen.add(r.id);
		ordered.push({ row: r, depth });
		for (const c of rows) if (c.parentId === r.id) visit(c, depth + 1);
	};
	for (const r of rows) if (!r.parentId || !rows.some((p) => p.id === r.parentId)) visit(r, 0);
	// Pages caught in a parent loop (saved before saves refused one) still show, at the end.
	for (const r of rows) visit(r, 1);
	return {
		rows: ordered.map(({ row: { body, ...r }, depth }) => ({
			...r,
			depth,
			parent: r.parentId ? r.parent : null,
			minutes: minutesOf(body)
		}))
	};
};
