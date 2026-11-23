import { desc, eq, sql } from 'drizzle-orm';
import { hasPermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import { location, stockCount } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { creator } from '#lib/server/people.ts';

/** Counts are a few a month: one list, filtered and sorted in the browser. */
export const load = async ({ locals }) => ({
	rows: await db
		.select({
			id: stockCount.id,
			countedAt: stockCount.countedAt,
			locationId: stockCount.locationId,
			location: enOf(location.name),
			stage: stockCount.stage,
			isOpening: stockCount.isOpening,
			lineCount: stockCount.lineCount,
			adjusted: sql<number>`(select count(*) from stock_movement m where m.ref_type = 'stock_count' and m.ref_id = cast(${stockCount.id} as char))`.mapWith(Number),
			postedAt: stockCount.postedAt,
			note: stockCount.note,
			createdById: stockCount.createdBy,
			createdBy: creator.name
		})
		.from(stockCount)
		.innerJoin(location, eq(stockCount.locationId, location.id))
		.leftJoin(creator, eq(stockCount.createdBy, creator.id))
		.orderBy(desc(stockCount.countedAt)),
	canManage: hasPermission(locals, 'stock.manage')
});
