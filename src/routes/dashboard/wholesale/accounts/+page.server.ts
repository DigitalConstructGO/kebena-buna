import { count, desc, eq, isNull, like, or } from 'drizzle-orm';
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
import { businessAccount } from '#lib/server/db/schema.ts';
import { userAlias } from '#lib/server/people.ts';
import { memberCountOf, orderCountOf } from '#lib/server/wholesale.ts';
import { BUSINESS_TYPES } from '#lib/constants.ts';

const FILTERS = ['approvalStatus', 'type', 'credit'] as const;
const SORTS = {
	name: businessAccount.name,
	expectedMonthlyKg: businessAccount.expectedMonthlyKg,
	discountPct: businessAccount.discountPct,
	creditLimit: businessAccount.creditLimit,
	orders: orderCountOf,
	createdAt: businessAccount.createdAt
};
const APPROVAL = ['pending', 'approved', 'rejected'] as const;

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [isNull(businessAccount.deletedAt)],
	search: (term) =>
		or(
			like(businessAccount.name, `%${term}%`),
			like(businessAccount.tin, `%${term}%`),
			like(businessAccount.contactName, `%${term}%`),
			like(businessAccount.contactPhone, `%${term.replace(/^0/, '')}%`),
			like(businessAccount.tradeLicenceNumber, `%${term}%`)
		),
	dateColumn: businessAccount.createdAt,
	filters: {
		approvalStatus: (v) =>
			(APPROVAL as readonly string[]).includes(v)
				? eq(businessAccount.approvalStatus, v as (typeof APPROVAL)[number])
				: undefined,
		type: (v) =>
			(BUSINESS_TYPES as readonly string[]).includes(v)
				? eq(businessAccount.type, v as (typeof BUSINESS_TYPES)[number])
				: undefined,
		credit: (v) => eq(businessAccount.creditApproved, v === 'yes')
	}
};

const requester = userAlias('requester');

export const load = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: businessAccount.id,
				name: businessAccount.name,
				type: businessAccount.type,
				tin: businessAccount.tin,
				contactName: businessAccount.contactName,
				contactPhone: businessAccount.contactPhone,
				approvalStatus: businessAccount.approvalStatus,
				expectedMonthlyKg: businessAccount.expectedMonthlyKg,
				discountPct: businessAccount.discountPct,
				creditApproved: businessAccount.creditApproved,
				creditLimit: businessAccount.creditLimit,
				paymentTermsDays: businessAccount.paymentTermsDays,
				members: memberCountOf,
				orders: orderCountOf,
				isActive: businessAccount.isActive,
				requestedById: businessAccount.requestedBy,
				requestedBy: requester.name,
				createdAt: businessAccount.createdAt
			})
			.from(businessAccount)
			.leftJoin(requester, eq(businessAccount.requestedBy, requester.id))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(businessAccount.id)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(businessAccount).where(where),
		facetCounts({
			approvalStatus: () =>
				db
					.select({ value: businessAccount.approvalStatus, count: count() })
					.from(businessAccount)
					.where(buildWhere(query, spec, { except: 'approvalStatus' }))
					.groupBy(businessAccount.approvalStatus),
			type: () =>
				db
					.select({ value: businessAccount.type, count: count() })
					.from(businessAccount)
					.where(buildWhere(query, spec, { except: 'type' }))
					.groupBy(businessAccount.type),
			credit: async () =>
				(
					await db
						.select({ value: businessAccount.creditApproved, count: count() })
						.from(businessAccount)
						.where(buildWhere(query, spec, { except: 'credit' }))
						.groupBy(businessAccount.creditApproved)
				).map((r) => ({ value: r.value ? 'yes' : 'no', count: r.count }))
		})
	]);

	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) },
		canManage: hasPermission(locals, 'wholesale.manage')
	};
};
