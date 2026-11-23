import { and, count, desc, eq, like, or, sql } from 'drizzle-orm';
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
	location,
	lot,
	order,
	orderLine,
	packingRun,
	productVariant,
	roastBatch,
	stockMovement
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { userAlias } from '#lib/server/people.ts';
import { STOCK_REASONS, STOCK_STAGES } from '#lib/constants.ts';

const mover = userAlias('mover');
const FILTERS = ['stage', 'reason', 'locationId'] as const;
const SORTS = { occurredAt: stockMovement.occurredAt, quantity: stockMovement.quantity, unitCost: stockMovement.unitCost };
const oneOf = <T extends readonly string[]>(list: T, v: string) =>
	(list as readonly string[]).includes(v) ? (v as T[number]) : undefined;

const spec: WhereSpec<(typeof FILTERS)[number]> = {
	search: (term) =>
		or(
			like(lot.code, `%${term}%`),
			like(roastBatch.code, `%${term}%`),
			like(packingRun.code, `%${term}%`),
			like(productVariant.sku, `%${term}%`),
			like(stockMovement.note, `%${term}%`)
		),
	dateColumn: stockMovement.occurredAt,
	filters: {
		stage: (v) => {
			const s = oneOf(STOCK_STAGES, v);
			return s ? eq(stockMovement.stage, s) : undefined;
		},
		reason: (v) => {
			const r = oneOf(STOCK_REASONS, v);
			return r ? eq(stockMovement.reason, r) : undefined;
		},
		locationId: (v) => eq(stockMovement.locationId, Number(v))
	}
};

/** Every query joins what search reads: the lot, batch, run and bag codes. */
const joined = <T extends MySqlSelect>(q: T) =>
	q
		.leftJoin(lot, eq(stockMovement.lotId, lot.id))
		.leftJoin(roastBatch, eq(stockMovement.roastBatchId, roastBatch.id))
		.leftJoin(packingRun, eq(stockMovement.packingRunId, packingRun.id))
		.leftJoin(productVariant, eq(stockMovement.variantId, productVariant.id));

export const load = async ({ url }) => {
	const query = parseTableQuery(url, FILTERS, 50, Object.keys(SORTS));
	const where = buildWhere(query, spec);
	const facet = (key: (typeof FILTERS)[number]) => buildWhere(query, spec, { except: key });
	const [rows, [{ total }], facets] = await Promise.all([
		joined(
			db
				.select({
					id: stockMovement.id,
					occurredAt: stockMovement.occurredAt,
					stage: stockMovement.stage,
					reason: stockMovement.reason,
					locationId: stockMovement.locationId,
					location: enOf(location.name),
					lotId: stockMovement.lotId,
					lot: lot.code,
					roastBatchId: stockMovement.roastBatchId,
					batch: roastBatch.code,
					packingRunId: stockMovement.packingRunId,
					run: packingRun.code,
					variantId: stockMovement.variantId,
					sku: productVariant.sku,
					quantity: stockMovement.quantity,
					unitCost: stockMovement.unitCost,
					refType: stockMovement.refType,
					refId: stockMovement.refId,
					orderId: order.id,
					orderNumber: order.number,
					transferKey: stockMovement.transferKey,
					note: stockMovement.note,
					byId: stockMovement.createdBy,
					by: mover.name
				})
				.from(stockMovement)
				.$dynamic()
		)
			.innerJoin(location, eq(stockMovement.locationId, location.id))
			.leftJoin(
				orderLine,
				and(eq(stockMovement.refType, 'order_line'), eq(orderLine.id, sql`cast(${stockMovement.refId} as unsigned)`))
			)
			.leftJoin(order, eq(order.id, orderLine.orderId))
			.leftJoin(mover, eq(stockMovement.createdBy, mover.id))
			.where(where)
			.orderBy(...(orderBy(query, SORTS) ?? [desc(stockMovement.occurredAt), desc(stockMovement.id)]))
			.limit(query.limit)
			.offset(query.offset),
		joined(db.select({ total: count() }).from(stockMovement).$dynamic()).where(where),
		facetCounts({
			stage: () =>
				joined(db.select({ value: stockMovement.stage, count: count() }).from(stockMovement).$dynamic())
					.where(facet('stage'))
					.groupBy(stockMovement.stage),
			reason: () =>
				joined(db.select({ value: stockMovement.reason, count: count() }).from(stockMovement).$dynamic())
					.where(facet('reason'))
					.groupBy(stockMovement.reason),
			locationId: () =>
				joined(db.select({ value: location.id, label: enOf(location.name), count: count() }).from(stockMovement).$dynamic())
					.innerJoin(location, eq(stockMovement.locationId, location.id))
					.where(facet('locationId'))
					.groupBy(location.id, location.name)
		})
	]);
	return { rows, server: { pagination: pagination(query, total), facets, filters: currentQuery(query) } };
};
