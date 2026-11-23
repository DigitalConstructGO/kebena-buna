/**
 * Where the coffee comes from: regions, washing stations / dry mills / farms, and green lots
 * (questionnaire 4.5, 4.8). The traceability pages are reads over these tables.
 */
import { relations } from 'drizzle-orm';
import {
	decimal,
	index,
	int,
	mysqlTable,
	primaryKey,
	smallint,
	uniqueIndex,
	varchar,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { extra, file, id, kgOrNull, lesserFields, localized, secureFields, status } from './fields';
import { PROCESSING_METHODS, STATION_TYPES } from '../../constants';

/**
 * Oromia › Jimma › Limu: one self-referencing tree, so a new level (kebele) or a new origin
 * (Guji, Sidama, Harar) is rows, not columns.
 */
export const region = mysqlTable(
	'region',
	{
		id: id(),
		parentId: int('parent_id').references((): AnyMySqlColumn => region.id, {
			onDelete: 'restrict'
		}),
		/** region, zone, woreda — free text so the hierarchy is not fixed. */
		level: varchar('level', { length: 20 }).notNull(),
		name: localized('name').notNull(),
		story: localized('story'),
		...lesserFields
	},
	(table) => [index('region_parent_idx').on(table.parentId)]
);

export const certification = mysqlTable('certification', {
	id: id(),
	code: varchar('code', { length: 20 }).notNull().unique(),
	name: localized('name').notNull(),
	logo: file('logo'),
	url: varchar('url', { length: 255 }),
	...lesserFields
});

/** Ethiopian heirloom, 74110, 74112… */
export const variety = mysqlTable('variety', {
	id: id(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	description: localized('description'),
	...lesserFields
});

/**
 * A washing station, dry mill or farm (questionnaire 1, 4.5). `code` is the station part of the
 * lot id: LIM, MAN, GOM, GER, DJM.
 */
export const station = mysqlTable(
	'station',
	{
		id: id(),
		code: varchar('code', { length: 8 }).notNull().unique(),
		name: localized('name').notNull(),
		type: status('type', STATION_TYPES).notNull(),
		regionId: int('region_id')
			.notNull()
			.references(() => region.id, { onDelete: 'restrict' }),
		altitudeMinM: smallint('altitude_min_m'),
		altitudeMaxM: smallint('altitude_max_m'),
		latitude: decimal('latitude', { precision: 9, scale: 6, mode: 'number' }),
		longitude: decimal('longitude', { precision: 9, scale: 6, mode: 'number' }),
		farmerCount: int('farmer_count'),
		story: localized('story'),
		photo: file('photo'),
		extra: extra(),
		...secureFields
	},
	(table) => [index('station_region_idx').on(table.regionId)]
);

export const stationCertification = mysqlTable(
	'station_certification',
	{
		stationId: int('station_id')
			.notNull()
			.references(() => station.id, { onDelete: 'cascade' }),
		certificationId: int('certification_id')
			.notNull()
			.references(() => certification.id, { onDelete: 'restrict' })
	},
	(table) => [primaryKey({ columns: [table.stationId, table.certificationId] })]
);

/**
 * A green-coffee lot: `KGT-LIM-2026-014` (questionnaire 4.5). Only station, region, process and
 * crop year are required (4.8), so a lot can be entered in seconds and enriched later.
 * Stock is not a column here — it is the sum of `stock_movement` and cached in `green_stock`.
 */
export const lot = mysqlTable(
	'lot',
	{
		id: id(),
		code: varchar('code', { length: 32 }).notNull().unique(),
		/** ECX / ECTA / contract number, if Kebena already has one. */
		externalRef: varchar('external_ref', { length: 64 }),
		stationId: int('station_id')
			.notNull()
			.references(() => station.id, { onDelete: 'restrict' }),
		/** Usually the station's region; may be narrower (a woreda). */
		regionId: int('region_id')
			.notNull()
			.references(() => region.id, { onDelete: 'restrict' }),
		process: status('process', PROCESSING_METHODS).notNull(),
		cropYear: smallint('crop_year').notNull(),
		grade: smallint('grade'),
		altitudeM: smallint('altitude_m'),
		farmerCount: int('farmer_count'),
		cuppingScore: decimal('cupping_score', { precision: 5, scale: 2, mode: 'number' }),
		tastingNotes: localized('tasting_notes'),
		story: localized('story'),
		photo: file('photo'),
		/** Alert below this; null → the `stock.green_low_kg` setting (60 kg). */
		lowStockKg: kgOrNull('low_stock_kg'),
		extra: extra(),
		...secureFields
	},
	(table) => [
		index('lot_station_idx').on(table.stationId, table.cropYear),
		index('lot_process_idx').on(table.process)
	]
);

export const lotVariety = mysqlTable(
	'lot_variety',
	{
		lotId: int('lot_id')
			.notNull()
			.references(() => lot.id, { onDelete: 'cascade' }),
		varietyId: int('variety_id')
			.notNull()
			.references(() => variety.id, { onDelete: 'restrict' })
	},
	(table) => [primaryKey({ columns: [table.lotId, table.varietyId] })]
);

export const lotCertification = mysqlTable(
	'lot_certification',
	{
		lotId: int('lot_id')
			.notNull()
			.references(() => lot.id, { onDelete: 'cascade' }),
		certificationId: int('certification_id')
			.notNull()
			.references(() => certification.id, { onDelete: 'restrict' }),
		certificateNumber: varchar('certificate_number', { length: 64 })
	},
	(table) => [
		primaryKey({ columns: [table.lotId, table.certificationId] }),
		uniqueIndex('lot_certification_number_uq').on(table.certificateNumber)
	]
);

export const stationRelations = relations(station, ({ one, many }) => ({
	region: one(region, { fields: [station.regionId], references: [region.id] }),
	lots: many(lot)
}));

export const lotRelations = relations(lot, ({ one, many }) => ({
	station: one(station, { fields: [lot.stationId], references: [station.id] }),
	region: one(region, { fields: [lot.regionId], references: [region.id] }),
	varieties: many(lotVariety),
	certifications: many(lotCertification)
}));

export const lotVarietyRelations = relations(lotVariety, ({ one }) => ({
	lot: one(lot, { fields: [lotVariety.lotId], references: [lot.id] }),
	variety: one(variety, { fields: [lotVariety.varietyId], references: [variety.id] })
}));

export const lotCertificationRelations = relations(lotCertification, ({ one }) => ({
	lot: one(lot, { fields: [lotCertification.lotId], references: [lot.id] }),
	certification: one(certification, {
		fields: [lotCertification.certificationId],
		references: [certification.id]
	})
}));
