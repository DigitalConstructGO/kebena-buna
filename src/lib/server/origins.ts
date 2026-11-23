/** Writes for lots: the code, and the variety and certification links. */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import type { Writer } from '@nahu/admin-kit/server/db';
import {
	lot,
	lotCertification,
	lotVariety,
	station,
	stationCertification
} from '#lib/server/db/schema.ts';
import { nextNumber } from '#lib/server/records.ts';

/** `KGT-LIM-2026-014`: the station's code and the crop year, numbered per station and year. */
export async function nextLotCode(tx: Writer, stationId: number, cropYear: number) {
	const [st] = await tx
		.select({ code: station.code })
		.from(station)
		.where(and(eq(station.id, stationId), isNull(station.deletedAt)));
	if (!st) throw new WriteRefused('stationId', 'That station no longer exists: choose another.');
	const n = await nextNumber(tx, `lot:${st.code}:${cropYear}`);
	return `KGT-${st.code}-${cropYear}-${String(n).padStart(3, '0')}`;
}

/** Replaces a lot's varieties and certifications with the ticked ones. */
export async function setLotLinks(
	tx: Writer,
	lotId: number,
	varietyIds: number[],
	certificationIds: number[]
) {
	await tx.delete(lotVariety).where(eq(lotVariety.lotId, lotId));
	if (varietyIds.length)
		await tx.insert(lotVariety).values(varietyIds.map((varietyId) => ({ lotId, varietyId })));
	// Certificate numbers already recorded are kept for the certifications still ticked.
	const kept = await tx.select().from(lotCertification).where(eq(lotCertification.lotId, lotId));
	await tx.delete(lotCertification).where(eq(lotCertification.lotId, lotId));
	if (certificationIds.length)
		await tx.insert(lotCertification).values(
			certificationIds.map((certificationId) => ({
				lotId,
				certificationId,
				certificateNumber:
					kept.find((k) => k.certificationId === certificationId)?.certificateNumber ?? null
			}))
		);
}

/** Live lots of a station. */
export const lotCountOfStation = sql<number>`(select count(*) from lot l where l.station_id = \`station\`.\`id\` and l.deleted_at is null)`.mapWith(
	Number
);

/** Green kg on hand across a station's lots. */
export const greenKgOfStation = sql<number>`(select coalesce(sum(gs.kg), 0) from green_stock gs join lot l on l.id = gs.lot_id where l.station_id = \`station\`.\`id\`)`.mapWith(
	Number
);

/** Replaces a station's certifications with the ticked ones. */
export async function setStationCertifications(tx: Writer, stationId: number, ids: number[]) {
	await tx.delete(stationCertification).where(eq(stationCertification.stationId, stationId));
	if (ids.length)
		await tx
			.insert(stationCertification)
			.values(ids.map((certificationId) => ({ stationId, certificationId })));
}

/**
 * Green kg on hand per lot, qualified by table name: drizzle leaves `${lot.id}` bare in a
 * single-table select, which inside this subquery would read `green_stock.id`.
 */
export const greenKgOfLot = sql<number>`(select coalesce(sum(gs.kg), 0) from green_stock gs where gs.lot_id = \`lot\`.\`id\`)`.mapWith(
	Number
);
