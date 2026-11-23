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
import {
	audience,
	customer,
	event,
	order,
	ticket,
	ticketType,
	visitSlot
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { TICKET_STATUSES } from '#lib/constants.ts';

const FILTERS = ['status', 'ticketTypeId', 'audienceId'] as const;
const SORTS = {
	code: ticket.code,
	visitDate: ticket.visitDate,
	issuedAt: ticket.issuedAt,
	admits: ticket.admits
};

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	dateColumn: ticket.visitDate,
	search: (term) =>
		or(
			like(ticket.code, `%${term}%`),
			like(ticket.holderName, `%${term}%`),
			like(customer.name, `%${term}%`),
			like(customer.phone, `%${term.replace(/^0/, '')}%`)
		),
	filters: {
		status: (v) =>
			(TICKET_STATUSES as readonly string[]).includes(v)
				? eq(ticket.status, v as (typeof TICKET_STATUSES)[number])
				: undefined,
		ticketTypeId: (v) => eq(ticket.ticketTypeId, Number(v)),
		audienceId: (v) => eq(ticket.audienceId, Number(v))
	}
};

/** Search reaches the customer's name and phone, so every count joins them too. */
const joined = <T extends MySqlSelect>(q: T) =>
	q.leftJoin(customer, eq(ticket.customerId, customer.id));

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: ticket.id,
					code: ticket.code,
					visitDate: ticket.visitDate,
					slotStart: visitSlot.startsAt,
					dayId: visitSlot.visitDayId,
					eventId: ticket.eventId,
					event: enOf(event.title),
					ticketTypeId: ticket.ticketTypeId,
					ticketType: enOf(ticketType.name),
					audienceId: ticket.audienceId,
					audience: enOf(audience.name),
					customerId: ticket.customerId,
					customer: customer.name,
					holderName: ticket.holderName,
					orderId: ticket.orderId,
					orderNumber: order.number,
					admits: ticket.admits,
					checkedIn: ticket.checkedIn,
					status: ticket.status,
					issuedAt: ticket.issuedAt
				})
				.from(ticket)
				.$dynamic()
		)
			.innerJoin(ticketType, eq(ticket.ticketTypeId, ticketType.id))
			.innerJoin(audience, eq(ticket.audienceId, audience.id))
			.leftJoin(visitSlot, eq(ticket.visitSlotId, visitSlot.id))
			.leftJoin(event, eq(ticket.eventId, event.id))
			.leftJoin(order, eq(ticket.orderId, order.id))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(ticket.visitDate), desc(ticket.id)]))
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(ticket).$dynamic()).where(where),
		facetCounts({
			status: () =>
				joined(db.select({ value: ticket.status, count: count() }).from(ticket).$dynamic())
					.where(buildWhere(query, spec, { except: 'status' }))
					.groupBy(ticket.status),
			ticketTypeId: () =>
				joined(
					db
						.select({ value: ticketType.id, label: enOf(ticketType.name), count: count() })
						.from(ticket)
						.innerJoin(ticketType, eq(ticket.ticketTypeId, ticketType.id))
						.$dynamic()
				)
					.where(buildWhere(query, spec, { except: 'ticketTypeId' }))
					.groupBy(ticketType.id, ticketType.name),
			audienceId: () =>
				joined(
					db
						.select({ value: audience.id, label: enOf(audience.name), count: count() })
						.from(ticket)
						.innerJoin(audience, eq(ticket.audienceId, audience.id))
						.$dynamic()
				)
					.where(buildWhere(query, spec, { except: 'audienceId' }))
					.groupBy(audience.id, audience.name)
		})
	]);
	return {
		rows,
		server: { pagination: pagination(query, total), facets, filters: currentQuery(query) }
	};
};
