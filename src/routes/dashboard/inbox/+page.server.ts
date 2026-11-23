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
import { formSubmission } from '#lib/server/db/schema.ts';
import { userAlias } from '#lib/server/people.ts';
import { FORM_TYPES, WORKFLOW_STATUSES } from '#lib/constants.ts';

const assignee = userAlias('assignee');
const FILTERS = ['formType', 'status', 'assignedTo'] as const;
const SORTS = {
	submittedAt: formSubmission.submittedAt,
	spamScore: formSubmission.spamScore,
	rating: formSubmission.rating
};

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	base: [isNull(formSubmission.deletedAt)],
	search: (term) =>
		or(
			like(formSubmission.name, `%${term}%`),
			like(formSubmission.phone, `%${term.replace(/^0/, '')}%`),
			like(formSubmission.email, `%${term}%`),
			like(formSubmission.subject, `%${term}%`),
			like(formSubmission.message, `%${term}%`)
		),
	dateColumn: formSubmission.submittedAt,
	filters: {
		formType: (v) =>
			(FORM_TYPES as readonly string[]).includes(v)
				? eq(formSubmission.formType, v as (typeof FORM_TYPES)[number])
				: undefined,
		status: (v) =>
			(WORKFLOW_STATUSES as readonly string[]).includes(v)
				? eq(formSubmission.status, v as (typeof WORKFLOW_STATUSES)[number])
				: undefined,
		assignedTo: (v) => eq(formSubmission.assignedTo, v)
	}
};

const joined = <T extends MySqlSelect>(q: T) =>
	q.leftJoin(assignee, eq(formSubmission.assignedTo, assignee.id));

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: formSubmission.id,
					formType: formSubmission.formType,
					status: formSubmission.status,
					customerId: formSubmission.customerId,
					name: formSubmission.name,
					phone: formSubmission.phone,
					subject: formSubmission.subject,
					rating: formSubmission.rating,
					spamScore: formSubmission.spamScore,
					assignedTo: formSubmission.assignedTo,
					assignee: assignee.name,
					submittedAt: formSubmission.submittedAt
				})
				.from(formSubmission)
				.$dynamic()
		)
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(formSubmission.submittedAt)]))
			.limit(query.limit)
			.offset(query.offset),
		db.select({ total: count() }).from(formSubmission).where(where),
		facetCounts({
			formType: () =>
				db
					.select({ value: formSubmission.formType, count: count() })
					.from(formSubmission)
					.where(buildWhere(query, spec, { except: 'formType' }))
					.groupBy(formSubmission.formType),
			status: () =>
				db
					.select({ value: formSubmission.status, count: count() })
					.from(formSubmission)
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(formSubmission.status),
			assignedTo: () =>
				joined(
					db
						.select({ value: assignee.id, label: assignee.name, count: count() })
						.from(formSubmission)
						.$dynamic()
				)
					.where(buildWhere(query, spec, { except: 'assignedTo' }))
					.groupBy(assignee.id, assignee.name)
		})
	]);
	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
