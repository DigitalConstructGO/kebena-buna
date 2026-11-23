/** The origins forms: lots, stations, regions. Client-safe. */
import { z } from 'zod/v4';
import { PROCESSING_METHODS, STATION_TYPES } from '#lib/constants.ts';
import {
	amText,
	boolTrue,
	enOptional,
	optionalId,
	optionalInt,
	optionalKg,
	optionalNumber,
	optionalText,
	requiredId
} from '#lib/schemas/common.ts';

/**
 * A green lot (questionnaire 4.5, 4.8): station, region, process and crop year are all it needs to
 * be entered; the rest can be filled in later. The code is given by the server from the station
 * and the year (`KGT-LIM-2026-014`).
 */
export const lotSchema = z.object({
	stationId: requiredId('Choose the station'),
	regionId: requiredId('Choose the region'),
	process: z.enum(PROCESSING_METHODS),
	cropYear: z.coerce.number().int().min(2000).max(2100),
	externalRef: optionalText(64),
	grade: optionalInt,
	altitudeM: optionalInt,
	farmerCount: optionalInt,
	cuppingScore: optionalNumber,
	lowStockKg: optionalKg,
	tastingNotesEn: enOptional(500),
	tastingNotesAm: amText(500),
	tastingNotesOm: amText(500),
	tastingNotesAr: amText(500),
	tastingNotesIt: amText(500),
	tastingNotesFr: amText(500),
	storyEn: enOptional(5000),
	storyAm: amText(5000),
	storyOm: amText(5000),
	storyAr: amText(5000),
	storyIt: amText(5000),
	storyFr: amText(5000),
	varietyIds: z.array(z.coerce.number().int()).default([]),
	certificationIds: z.array(z.coerce.number().int()).default([])
});
/** The station and crop year are part of the lot code, so they are fixed once the lot exists. */
export const lotEditSchema = lotSchema
	.omit({ stationId: true, cropYear: true })
	.extend({ id: z.coerce.number(), isActive: boolTrue });

// ── Stations, regions, varieties, certifications ─────────────────────────────────────────────

export const stationSchema = z.object({
	code: z
		.string()
		.trim()
		.min(2, 'Required')
		.max(8)
		.transform((v) => v.toUpperCase()),
	nameEn: z.string().trim().min(1, 'English text is required').max(150),
	nameAm: amText(150),
	nameOm: amText(150),
	nameAr: amText(150),
	nameIt: amText(150),
	nameFr: amText(150),
	type: z.enum(STATION_TYPES),
	regionId: requiredId('Choose the region'),
	altitudeMinM: optionalInt,
	altitudeMaxM: optionalInt,
	latitude: optionalNumber,
	longitude: optionalNumber,
	farmerCount: optionalInt,
	storyEn: enOptional(5000),
	storyAm: amText(5000),
	storyOm: amText(5000),
	storyAr: amText(5000),
	storyIt: amText(5000),
	storyFr: amText(5000),
	certificationIds: z.array(z.coerce.number().int()).default([])
});
export const stationEditSchema = stationSchema.extend({ id: z.coerce.number(), isActive: boolTrue });
export const stationPhotoSchema = z.object({ photo: z.file().optional() });

export const regionSchema = z.object({
	nameEn: z.string().trim().min(1, 'English text is required').max(100),
	nameAm: amText(100),
	nameOm: amText(100),
	nameAr: amText(100),
	nameIt: amText(100),
	nameFr: amText(100),
	level: z.string().trim().min(1, 'Required').max(20),
	parentId: optionalId,
	storyEn: enOptional(5000),
	storyAm: amText(5000),
	storyOm: amText(5000),
	storyAr: amText(5000),
	storyIt: amText(5000),
	storyFr: amText(5000),
	status: boolTrue
});
export const regionEditSchema = regionSchema.extend({ id: z.coerce.number() });

export const varietySchema = z.object({
	name: z.string().trim().min(1, 'Required').max(100),
	descriptionEn: enOptional(1000),
	descriptionAm: amText(1000),
	descriptionOm: amText(1000),
	descriptionAr: amText(1000),
	descriptionIt: amText(1000),
	descriptionFr: amText(1000),
	status: boolTrue
});
export const varietyEditSchema = varietySchema.extend({ id: z.coerce.number() });

export const certificationSchema = z.object({
	code: z
		.string()
		.trim()
		.min(1, 'Required')
		.max(20)
		.transform((v) => v.toUpperCase()),
	nameEn: z.string().trim().min(1, 'English text is required').max(100),
	nameAm: amText(100),
	nameOm: amText(100),
	nameAr: amText(100),
	nameIt: amText(100),
	nameFr: amText(100),
	url: optionalText(255),
	logo: z.file().optional(),
	status: boolTrue
});
export const certificationEditSchema = certificationSchema.extend({ id: z.coerce.number() });
