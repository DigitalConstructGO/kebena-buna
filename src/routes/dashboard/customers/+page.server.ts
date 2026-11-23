import { count, desc, eq, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import { hasPermission } from '@nahu/admin-kit/server/permissions';
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
import { customer } from '#lib/server/db/schema.ts';
import { creator, userAlias } from '#lib/server/people.ts';
import { creditOf, ordersCountOf, spentOf } from '#lib/server/customers.ts';

const FILTERS = ['source', 'locale', 'signIn'] as const;
const SORTS = {
	name: customer.name,
	orders: ordersCountOf,
	spent: spentOf,
	credit: creditOf,
	lastActivityAt: customer.lastActivityAt,
	createdAt: customer.createdAt
};

const signedIn = sql<string>`case when ${customer.userId} is null then 'no' else 'yes' end`;

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [isNull(customer.deletedAt)],
	search: (term) =>
		or(
			like(customer.name, `%${term}%`),
			like(customer.phone, `%${term.replace(/^0/, '')}%`),
			like(customer.email, `%${term}%`),
			like(customer.tin, `%${term}%`),
			like(customer.businessName, `%${term}%`)
		),
	dateColumn: customer.createdAt,
	filters: {
		source: (v) => eq(customer.source, v),
		locale: (v) => eq(customer.locale, v),
		signIn: (v) => (v === 'yes' ? isNotNull(customer.userId) : isNull(customer.userId))
	}
};

const account = userAlias('account');

export const load = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: customer.id,
				name: customer.name,
				businessName: customer.businessName,
				phone: customer.phone,
				email: customer.email,
				locale: customer.locale,
				source: customer.source,
				orders: ordersCountOf,
				spent: spentOf,
				credit: creditOf,
				lastActivityAt: customer.lastActivityAt,
				anonymizedAt: customer.anonymizedAt,
				isActive: customer.isActive,
				userId: customer.userId,
				userName: account.name,
				createdById: customer.createdBy,
				createdBy: creator.name,
				createdAt: customer.createdAt
			})
			.from(customer)
			.leftJoin(account, eq(customer.userId, account.id))
			.leftJoin(creator, eq(customer.createdBy, creator.id))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(customer.id)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(customer).where(where),
		facetCounts({
			source: () =>
				db
					.select({ value: customer.source, count: count() })
					.from(customer)
					.where(buildWhere(query, spec, { except: 'source' }))
					.groupBy(customer.source),
			locale: () =>
				db
					.select({ value: customer.locale, count: count() })
					.from(customer)
					.where(buildWhere(query, spec, { except: 'locale' }))
					.groupBy(customer.locale),
			signIn: () =>
				db
					.select({ value: signedIn, count: count() })
					.from(customer)
					.where(buildWhere(query, spec, { except: 'signIn' }))
					.groupBy(signedIn)
		})
	]);

	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) },
		canManage: hasPermission(locals, 'customers.manage')
	};
};
