import { count, desc, eq, like, or } from 'drizzle-orm';
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
import { location, membershipMember, scannerDevice, ticket, ticketScan } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { userAlias } from '#lib/server/people.ts';
import { SCAN_RESULTS } from '#lib/constants.ts';

const FILTERS = ['result', 'deviceId', 'locationId'] as const;
const SORTS = { scannedAt: ticketScan.scannedAt, headcount: ticketScan.headcount, syncedAt: ticketScan.syncedAt };
const scanner = userAlias('scanner');

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	dateColumn: ticketScan.scannedAt,
	search: (term) => or(like(ticketScan.scannedCode, `%${term}%`), like(ticket.code, `%${term}%`)),
	filters: {
		result: (v) =>
			(SCAN_RESULTS as readonly string[]).includes(v)
				? eq(ticketScan.result, v as (typeof SCAN_RESULTS)[number])
				: undefined,
		deviceId: (v) => eq(ticketScan.deviceId, Number(v)),
		locationId: (v) => eq(ticketScan.locationId, Number(v))
	}
};

/** The scanners' log, as synced: every admission, re-entry and refusal. */
export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 50, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const base = () => db.select({ total: count() }).from(ticketScan).leftJoin(ticket, eq(ticketScan.ticketId, ticket.id));
	const [rows, [{ total }], facets] = await Promise.all([
		db
			.select({
				id: ticketScan.id,
				scannedAt: ticketScan.scannedAt,
				syncedAt: ticketScan.syncedAt,
				scannedCode: ticketScan.scannedCode,
				ticketId: ticketScan.ticketId,
				ticketCode: ticket.code,
				memberId: ticketScan.membershipMemberId,
				membershipId: membershipMember.membershipId,
				memberName: membershipMember.name,
				result: ticketScan.result,
				headcount: ticketScan.headcount,
				wasOffline: ticketScan.wasOffline,
				device: scannerDevice.name,
				locationId: ticketScan.locationId,
				location: enOf(location.name),
				byId: ticketScan.scannedBy,
				by: scanner.name
			})
			.from(ticketScan)
			.leftJoin(ticket, eq(ticketScan.ticketId, ticket.id))
			.leftJoin(membershipMember, eq(ticketScan.membershipMemberId, membershipMember.id))
			.leftJoin(scannerDevice, eq(ticketScan.deviceId, scannerDevice.id))
			.leftJoin(location, eq(ticketScan.locationId, location.id))
			.leftJoin(scanner, eq(ticketScan.scannedBy, scanner.id))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(ticketScan.scannedAt)]))
			.limit(query.limit)
			.offset(query.offset),
		base().where(where),
		facetCounts({
			result: () =>
				db
					.select({ value: ticketScan.result, count: count() })
					.from(ticketScan)
					.leftJoin(ticket, eq(ticketScan.ticketId, ticket.id))
					.where(buildWhere(query, spec, { except: 'result' }))
					.groupBy(ticketScan.result),
			deviceId: () =>
				db
					.select({ value: scannerDevice.id, label: scannerDevice.name, count: count() })
					.from(ticketScan)
					.leftJoin(ticket, eq(ticketScan.ticketId, ticket.id))
					.innerJoin(scannerDevice, eq(ticketScan.deviceId, scannerDevice.id))
					.where(buildWhere(query, spec, { except: 'deviceId' }))
					.groupBy(scannerDevice.id, scannerDevice.name),
			locationId: () =>
				db
					.select({ value: location.id, label: enOf(location.name), count: count() })
					.from(ticketScan)
					.leftJoin(ticket, eq(ticketScan.ticketId, ticket.id))
					.innerJoin(location, eq(ticketScan.locationId, location.id))
					.where(buildWhere(query, spec, { except: 'locationId' }))
					.groupBy(location.id, location.name)
		})
	]);
	return { rows, server: { pagination: pagination(query, total), facets, filters: currentQuery(query) } };
};
