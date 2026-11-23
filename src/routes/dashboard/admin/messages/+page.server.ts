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
import { customer, notification, user } from '#lib/server/db/schema.ts';
import { CONTACT_CHANNELS, NOTIFICATION_STATUSES } from '#lib/constants.ts';

const FILTERS = ['status', 'channel', 'templateKey'] as const;
const SORTS = { scheduledFor: notification.scheduledFor, sentAt: notification.sentAt, attempts: notification.attempts };

const inList = <T extends readonly string[]>(list: T, v: string): v is T[number] => (list as readonly string[]).includes(v);

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	search: (term) =>
		or(
			like(notification.recipient, `%${term}%`),
			like(notification.templateKey, `%${term}%`),
			like(notification.refId, `${term}%`),
			like(customer.name, `%${term}%`)
		),
	dateColumn: notification.scheduledFor,
	filters: {
		status: (v) => (inList(NOTIFICATION_STATUSES, v) ? eq(notification.status, v) : undefined),
		channel: (v) => (inList(CONTACT_CHANNELS, v) ? eq(notification.channel, v) : undefined),
		templateKey: (v) => eq(notification.templateKey, v)
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q.leftJoin(customer, eq(notification.customerId, customer.id)).leftJoin(user, eq(notification.userId, user.id));

/** The outbox: every SMS, email and Telegram message, queued, sent or failed. */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 25, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const tally = (column: typeof notification.status | typeof notification.channel | typeof notification.templateKey, key: (typeof FILTERS)[number]) =>
		joined(db.select({ value: column, count: count() }).from(notification).$dynamic())
			.where(buildWhere(query, spec, { except: key }))
			.groupBy(column);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: notification.id,
					channel: notification.channel,
					templateKey: notification.templateKey,
					locale: notification.locale,
					recipient: notification.recipient,
					customerId: notification.customerId,
					customer: customer.name,
					userId: notification.userId,
					userName: user.name,
					isMarketing: notification.isMarketing,
					status: notification.status,
					attempts: notification.attempts,
					lastError: notification.lastError,
					refType: notification.refType,
					refId: notification.refId,
					scheduledFor: notification.scheduledFor,
					sentAt: notification.sentAt
				})
				.from(notification)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(notification.id)]))
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(notification).$dynamic()).where(where),
		facetCounts({
			status: () => tally(notification.status, 'status'),
			channel: () => tally(notification.channel, 'channel'),
			templateKey: () => tally(notification.templateKey, 'templateKey')
		})
	]);
	return { rows, server: { pagination: pagination(query, total), facets, filters: currentQuery(query) } };
};
