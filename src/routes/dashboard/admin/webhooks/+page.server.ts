import { count, desc, eq, isNotNull, isNull, like, or } from 'drizzle-orm';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	pagination,
	parseTableQuery,
	type WhereSpec
} from '@nahu/admin-kit/server/queryFilters';
import { db } from '#lib/server/db/index.ts';
import { webhookEvent } from '#lib/server/db/schema.ts';

const FILTERS = ['provider', 'eventType', 'state'] as const;
const spec: WhereSpec<(typeof FILTERS)[number]> = {
	search: (term) => or(like(webhookEvent.eventId, `%${term}%`), like(webhookEvent.payload, `%${term}%`)),
	dateColumn: webhookEvent.receivedAt,
	filters: {
		provider: (v) => eq(webhookEvent.provider, v),
		eventType: (v) => eq(webhookEvent.eventType, v),
		state: (v) =>
			v === 'processed'
				? isNotNull(webhookEvent.processedAt)
				: v === 'failed'
					? isNotNull(webhookEvent.error)
					: v === 'pending'
						? isNull(webhookEvent.processedAt)
						: undefined
	}
};

/** Each payment-gateway callback as received; a duplicate is stored once and every one can be replayed. */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 25);
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: webhookEvent.id,
				provider: webhookEvent.provider,
				eventId: webhookEvent.eventId,
				eventType: webhookEvent.eventType,
				signatureValid: webhookEvent.signatureValid,
				processedAt: webhookEvent.processedAt,
				error: webhookEvent.error,
				receivedAt: webhookEvent.receivedAt
			})
			.from(webhookEvent)
			.where(where)
			.orderBy(desc(webhookEvent.id))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(webhookEvent).where(where),
		facetCounts({
			provider: () =>
				db.select({ value: webhookEvent.provider, count: count() }).from(webhookEvent).where(buildWhere(query, spec, { except: 'provider' })).groupBy(webhookEvent.provider),
			eventType: () =>
				db.select({ value: webhookEvent.eventType, count: count() }).from(webhookEvent).where(buildWhere(query, spec, { except: 'eventType' })).groupBy(webhookEvent.eventType)
		})
	]);
	return { rows, server: { pagination: pagination(query, total), facets, filters: currentQuery(query) } };
};
