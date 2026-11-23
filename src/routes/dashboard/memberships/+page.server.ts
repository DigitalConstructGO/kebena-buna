import { count, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import type { MySqlSelect } from 'drizzle-orm/mysql-core';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { localToday } from '@nahu/admin-kit/time';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
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
import { customer, membership, membershipMember, membershipPlan } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { creator } from '#lib/server/people.ts';
import { customerOptions, membershipPlanOptions } from '#lib/server/options.ts';
import { createMembership } from '#lib/server/memberships.ts';
import { MEMBERSHIP_STATUSES } from '#lib/constants.ts';
import { newMembershipSchema } from '#lib/schemas/memberships.ts';

const FILTERS = ['status', 'planId'] as const;
const SORTS = {
	number: membership.number,
	customer: customer.name,
	startsOn: membership.startsOn,
	endsOn: membership.endsOn,
	createdAt: membership.createdAt
};

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [isNull(membership.deletedAt)],
	search: (term) =>
		or(
			like(membership.number, `%${term}%`),
			like(customer.name, `%${term}%`),
			like(customer.phone, `%${term.replace(/^0/, '')}%`),
			sql`exists (select 1 from membership_member mm where mm.membership_id = ${membership.id} and (mm.name like ${`%${term}%`} or mm.card_code like ${`%${term}%`}))`
		),
	dateColumn: membership.endsOn,
	filters: {
		status: (v) =>
			(MEMBERSHIP_STATUSES as readonly string[]).includes(v)
				? eq(membership.status, v as (typeof MEMBERSHIP_STATUSES)[number])
				: undefined,
		planId: (v) => eq(membership.planId, Number(v))
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q
		.innerJoin(customer, eq(membership.customerId, customer.id))
		.innerJoin(membershipPlan, eq(membership.planId, membershipPlan.id))
		.leftJoin(creator, eq(membership.createdBy, creator.id));

export const load = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: membership.id,
					number: membership.number,
					customerId: membership.customerId,
					customer: customer.name,
					planId: membership.planId,
					plan: enOf(membershipPlan.name),
					status: membership.status,
					startsOn: membership.startsOn,
					endsOn: membership.endsOn,
					renewalMethod: membership.renewalMethod,
					members:
						sql<number>`(select count(*) from ${membershipMember} mm where mm.membership_id = ${membership.id} and mm.deleted_at is null)`.mapWith(
							Number
						),
					createdById: membership.createdBy,
					createdBy: creator.name
				})
				.from(membership)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(membership.id)]))
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(membership).$dynamic()).where(where),
		facetCounts({
			status: () =>
				joined(db.select({ value: membership.status, count: count() }).from(membership).$dynamic())
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(membership.status),
			planId: () =>
				joined(
					db
						.select({ value: membershipPlan.id, label: enOf(membershipPlan.name), count: count() })
						.from(membership)
						.$dynamic()
				)
					.where(buildWhere(query, spec, { except: 'planId' }))
					.groupBy(membershipPlan.id)
		})
	]);

	const canManage = hasPermission(locals, 'memberships.manage');
	return {
		rows,
		today: localToday(),
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) },
		canManage,
		newForm: await superValidate({ startsOn: localToday() }, zod4(newMembershipSchema), {
			errors: false
		}),
		customers: canManage ? await customerOptions() : [],
		plans: canManage ? await membershipPlanOptions() : []
	};
};

export const actions = {
	add: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const form = await superValidate(event.request, zod4(newMembershipSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { id, number } = await db.transaction((tx) =>
			createMembership(tx, form.data, event.locals.user?.id)
		);
		redirect(
			`/dashboard/memberships/${id}`,
			{ type: 'success', message: `${number} created — awaiting payment` },
			event.cookies
		);
	}
};
