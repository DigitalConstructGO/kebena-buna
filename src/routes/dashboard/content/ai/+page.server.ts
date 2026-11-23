import { count, desc, eq, like, or, sql } from 'drizzle-orm';
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
import { aiConversation, aiMessage, customer } from '#lib/server/db/schema.ts';
import { userAlias } from '#lib/server/people.ts';
import { AI_CHANNELS } from '#lib/constants.ts';

const staff = userAlias('staff');
const FILTERS = ['channel', 'locale', 'handedOff'] as const;

const messages =
	sql<number>`(select count(*) from ai_message m where m.conversation_id = ${aiConversation.id})`.mapWith(
		Number
	);
const lastText = sql<
	string | null
>`(select m.content from ai_message m where m.conversation_id = ${aiConversation.id} order by m.id desc limit 1)`;
const SORTS = {
	startedAt: aiConversation.startedAt,
	lastMessageAt: aiConversation.lastMessageAt,
	messages
};

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	search: (term) =>
		or(
			like(aiConversation.externalId, `%${term}%`),
			like(customer.name, `%${term}%`),
			sql`exists (select 1 from ${aiMessage} m where m.conversation_id = ${aiConversation.id} and m.content like ${`%${term}%`})`
		),
	dateColumn: aiConversation.startedAt,
	filters: {
		channel: (v) =>
			(AI_CHANNELS as readonly string[]).includes(v)
				? eq(aiConversation.channel, v as (typeof AI_CHANNELS)[number])
				: undefined,
		locale: (v) => eq(aiConversation.locale, v),
		handedOff: (v) =>
			v === 'staff'
				? sql`${aiConversation.handedOffTo} is not null`
				: sql`${aiConversation.handedOffTo} is null`
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.leftJoin(customer, eq(aiConversation.customerId, customer.id))
		.leftJoin(staff, eq(aiConversation.handedOffTo, staff.id));

/** Website › AI conversations: every chat with the agent, on the website and in Telegram. */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const handled = sql<string>`if(${aiConversation.handedOffTo} is null, 'bot', 'staff')`;
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: aiConversation.id,
					channel: aiConversation.channel,
					externalId: aiConversation.externalId,
					locale: aiConversation.locale,
					customerId: aiConversation.customerId,
					customer: customer.name,
					handedOffToId: aiConversation.handedOffTo,
					handedOffTo: staff.name,
					startedAt: aiConversation.startedAt,
					lastMessageAt: aiConversation.lastMessageAt,
					messages,
					lastText
				})
				.from(aiConversation)
				.$dynamic()
		)
			.where(where)
			.orderBy(
				...(orderBy(query, SORTS) ?? [desc(aiConversation.lastMessageAt), desc(aiConversation.id)])
			)
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(aiConversation).$dynamic()).where(where),
		facetCounts({
			channel: () =>
				joined(
					db
						.select({ value: aiConversation.channel, count: count() })
						.from(aiConversation)
						.$dynamic()
				)
					.where(buildWhere(query, spec, { except: 'channel' }))
					.groupBy(aiConversation.channel),
			locale: () =>
				joined(
					db
						.select({ value: aiConversation.locale, count: count() })
						.from(aiConversation)
						.$dynamic()
				)
					.where(buildWhere(query, spec, { except: 'locale' }))
					.groupBy(aiConversation.locale),
			handedOff: () =>
				joined(db.select({ value: handled, count: count() }).from(aiConversation).$dynamic())
					.where(buildWhere(query, spec, { except: 'handedOff' }))
					.groupBy(handled)
		})
	]);
	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
