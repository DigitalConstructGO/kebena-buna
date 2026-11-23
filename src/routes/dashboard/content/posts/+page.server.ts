import { count, desc, eq, isNull, like, or } from 'drizzle-orm';
import type { MySqlSelect } from 'drizzle-orm/mysql-core';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	orderBy,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '@nahu/admin-kit/server/queryFilters';
import { db } from '#lib/server/db/index.ts';
import { post, postCategory } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { userAlias } from '#lib/server/people.ts';
import { minutesOf } from '#lib/server/content.ts';
import { PUBLISH_STATUSES } from '#lib/constants.ts';

const author = userAlias('author');
const FILTERS = ['categoryId', 'publishStatus'] as const;
const SORTS = { title: enOf(post.title), publishedAt: post.publishedAt, updatedAt: post.updatedAt };

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [isNull(post.deletedAt)],
	search: (term) => or(like(post.title, `%${term}%`), like(post.slug, `%${term}%`), like(post.excerpt, `%${term}%`)),
	dateColumn: post.publishedAt,
	filters: {
		categoryId: (v) => eq(post.categoryId, Number(v)),
		publishStatus: (v) =>
			(PUBLISH_STATUSES as readonly string[]).includes(v)
				? eq(post.publishStatus, v as (typeof PUBLISH_STATUSES)[number])
				: undefined
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q.leftJoin(postCategory, eq(post.categoryId, postCategory.id)).leftJoin(author, eq(post.authorId, author.id));

/** Website › Posts: the blog, newest first, filtered by category and status. */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: post.id,
					slug: post.slug,
					title: enOf(post.title),
					categoryId: post.categoryId,
					category: enOf(postCategory.name),
					authorId: post.authorId,
					author: author.name,
					publishStatus: post.publishStatus,
					publishedAt: post.publishedAt,
					updatedAt: post.updatedAt,
					coverImage: post.coverImage,
					body: post.body
				})
				.from(post)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(post.id)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(post).where(where),
		facetCounts({
			categoryId: () =>
				db
					.select({ value: postCategory.id, label: enOf(postCategory.name), count: count() })
					.from(post)
					.innerJoin(postCategory, eq(post.categoryId, postCategory.id))
					.where(buildWhere(query, spec, { except: 'categoryId' }))
					.groupBy(postCategory.id, postCategory.name),
			publishStatus: () =>
				db
					.select({ value: post.publishStatus, count: count() })
					.from(post)
					.where(buildWhere(query, spec, { except: 'publishStatus' }))
					.groupBy(post.publishStatus)
		})
	]);
	return {
		rows: rows.map(({ body, ...r }) => ({ ...r, minutes: minutesOf(body) })),
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
