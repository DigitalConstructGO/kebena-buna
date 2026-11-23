import { count, desc, eq, like, or } from 'drizzle-orm';
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
import { auditLog, user } from '#lib/server/db/schema.ts';
import { AUDIT_ENTITY, summarise } from '#lib/server/admin.ts';

const FILTERS = ['tableName', 'action', 'userId'] as const;
const SORTS = { createdAt: auditLog.createdAt, tableName: auditLog.tableName };

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	search: (term) =>
		or(
			eq(auditLog.recordId, term),
			like(user.name, `%${term}%`),
			like(auditLog.ipAddress, `${term}%`),
			like(auditLog.changes, `%${term}%`)
		),
	dateColumn: auditLog.createdAt,
	filters: {
		tableName: (v) => eq(auditLog.tableName, v),
		action: (v) => eq(auditLog.action, v),
		userId: (v) => eq(auditLog.userId, v)
	}
};

// An attribution join, not filtered for deleted accounts: a deleted user still made the change.
const withUser = <T extends MySqlSelect>(q: T) => q.leftJoin(user, eq(auditLog.userId, user.id));

/** Who changed what and when: prices, refunds, stock, users and settings (questionnaire 5.1). */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 25, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		withUser(
			db
				.select({
					id: auditLog.id,
					createdAt: auditLog.createdAt,
					userId: auditLog.userId,
					userName: user.name,
					action: auditLog.action,
					tableName: auditLog.tableName,
					recordId: auditLog.recordId,
					changes: auditLog.changes,
					ipAddress: auditLog.ipAddress
				})
				.from(auditLog)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(auditLog.id)]))
			.limit(query.limit)
			.offset(query.offset),
		withUser(db.select({ total: count() }).from(auditLog).$dynamic()).where(where),
		facetCounts({
			tableName: () =>
				withUser(db.select({ value: auditLog.tableName, count: count() }).from(auditLog).$dynamic())
					.where(buildWhere(query, spec, { except: 'tableName' }))
					.groupBy(auditLog.tableName),
			action: () =>
				withUser(db.select({ value: auditLog.action, count: count() }).from(auditLog).$dynamic())
					.where(buildWhere(query, spec, { except: 'action' }))
					.groupBy(auditLog.action),
			userId: () =>
				withUser(db.select({ value: auditLog.userId, label: user.name, count: count() }).from(auditLog).$dynamic())
					.where(buildWhere(query, spec, { except: 'userId' }))
					.groupBy(auditLog.userId, user.name)
		})
	]);
	return {
		rows: rows.map(({ changes, ...r }) => ({
			...r,
			recordEntity: AUDIT_ENTITY[r.tableName] ?? null,
			summary: summarise(changes)
		})),
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
