import { error } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { publicFileUrl } from '@nahu/admin-kit/files';
import { db } from '#lib/server/db/index.ts';
import {
	bagSize,
	certification,
	grind,
	lot,
	lotCertification,
	lotVariety,
	packingRun,
	packingRunSource,
	product,
	productVariant,
	region,
	roastBatch,
	roastBatchInput,
	roastLevel,
	station,
	stationCertification,
	variety
} from '#lib/server/db/schema.ts';
import { m } from '#lib/i18n.ts';
import type { PageServerLoad } from './$types';

/**
 * The public page behind a bag's QR (4.9): the packing run printed on the label, the roast
 * batches it was packed from, the green lots those were roasted from, and the stations that
 * processed them. Only what a customer should see: no costs, stock or staff.
 */
export const load: PageServerLoad = async ({ params }) => {
	const code = params.code.trim().toUpperCase();
	const [run] = await db
		.select({
			id: packingRun.id,
			code: packingRun.code,
			packedAt: packingRun.packedAt,
			bestBefore: packingRun.bestBefore,
			product: product.name,
			productSlug: product.slug,
			summary: product.summary,
			tastingNotes: product.tastingNotes,
			size: bagSize.name,
			roastLevel: roastLevel.name,
			grind: grind.name
		})
		.from(packingRun)
		.innerJoin(productVariant, eq(packingRun.variantId, productVariant.id))
		.innerJoin(product, eq(productVariant.productId, product.id))
		.innerJoin(roastLevel, eq(packingRun.roastLevelId, roastLevel.id))
		.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
		.leftJoin(grind, eq(packingRun.grindId, grind.id))
		.where(and(eq(packingRun.code, code), isNull(packingRun.deletedAt)));
	if (!run) error(404, m.trace_not_found());

	const batches = await db
		.select({
			id: roastBatch.id,
			code: roastBatch.code,
			roastedAt: roastBatch.roastedAt,
			cuppingScore: roastBatch.cuppingScore
		})
		.from(packingRunSource)
		.innerJoin(roastBatch, eq(packingRunSource.roastBatchId, roastBatch.id))
		.where(eq(packingRunSource.packingRunId, run.id))
		.orderBy(asc(roastBatch.roastedAt));

	const lots = batches.length
		? await db
				.selectDistinct({
					id: lot.id,
					code: lot.code,
					process: lot.process,
					cropYear: lot.cropYear,
					grade: lot.grade,
					altitudeM: lot.altitudeM,
					farmerCount: lot.farmerCount,
					cuppingScore: lot.cuppingScore,
					tastingNotes: lot.tastingNotes,
					story: lot.story,
					photo: lot.photo,
					stationId: lot.stationId,
					region: region.name
				})
				.from(roastBatchInput)
				.innerJoin(lot, eq(roastBatchInput.lotId, lot.id))
				.innerJoin(region, eq(lot.regionId, region.id))
				.where(
					inArray(
						roastBatchInput.roastBatchId,
						batches.map((b) => b.id)
					)
				)
		: [];

	const lotIds = lots.map((l) => l.id);
	const stationIds = [...new Set(lots.map((l) => l.stationId))];
	const [stations, varieties, lotCerts, stationCerts] = await Promise.all([
		stationIds.length
			? db
					.select({
						id: station.id,
						name: station.name,
						type: station.type,
						altitudeMinM: station.altitudeMinM,
						altitudeMaxM: station.altitudeMaxM,
						farmerCount: station.farmerCount,
						story: station.story,
						photo: station.photo,
						region: region.name
					})
					.from(station)
					.innerJoin(region, eq(station.regionId, region.id))
					.where(inArray(station.id, stationIds))
			: [],
		lotIds.length
			? db
					.select({ lotId: lotVariety.lotId, name: variety.name })
					.from(lotVariety)
					.innerJoin(variety, eq(lotVariety.varietyId, variety.id))
					.where(inArray(lotVariety.lotId, lotIds))
			: [],
		lotIds.length
			? db
					.select({
						lotId: lotCertification.lotId,
						name: certification.name,
						logo: certification.logo,
						url: certification.url
					})
					.from(lotCertification)
					.innerJoin(certification, eq(lotCertification.certificationId, certification.id))
					.where(inArray(lotCertification.lotId, lotIds))
			: [],
		stationIds.length
			? db
					.select({
						stationId: stationCertification.stationId,
						name: certification.name,
						logo: certification.logo,
						url: certification.url
					})
					.from(stationCertification)
					.innerJoin(certification, eq(stationCertification.certificationId, certification.id))
					.where(inArray(stationCertification.stationId, stationIds))
			: []
	]);

	const image = (name: string | null) => (name ? publicFileUrl(name) : null);
	const cert = <T extends { name: unknown; logo: string | null; url: string | null }>(c: T) => ({
		name: c.name as T['name'],
		logo: image(c.logo),
		url: c.url
	});

	return {
		run,
		batches,
		lots: lots.map((l) => ({
			...l,
			photo: image(l.photo),
			varieties: varieties.filter((v) => v.lotId === l.id).map((v) => v.name),
			certifications: lotCerts.filter((c) => c.lotId === l.id).map(cert)
		})),
		stations: stations.map((s) => ({
			...s,
			photo: image(s.photo),
			certifications: stationCerts.filter((c) => c.stationId === s.id).map(cert)
		}))
	};
};
