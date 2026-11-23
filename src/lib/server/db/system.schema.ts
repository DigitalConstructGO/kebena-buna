/**
 * What every other module leans on: the audit trail, languages, settings, document numbers, the
 * places the business operates from, opening hours, tax rates and the outgoing-message queue.
 */
import { sql } from 'drizzle-orm';
import {
	boolean,
	date,
	datetime,
	decimal,
	index,
	int,
	json,
	mysqlTable,
	smallint,
	text,
	time,
	timestamp,
	tinyint,
	uniqueIndex,
	varchar,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { user } from './auth.schema';
import {
	bigId,
	file,
	id,
	lesserFields,
	localized,
	percent,
	secureFields,
	status,
	userRef
} from './fields';
import { CONTACT_CHANNELS, LOCATION_TYPES, NOTIFICATION_STATUSES } from '../../constants';

/**
 * The kit's audit trail (`recordAudit`), handed to `configureKit({ auditLog })`. The columns are
 * the ones the kit writes; `branchId` carries the location when one applies. Price changes,
 * refunds and stock adjustments are audited (questionnaire 5.1); kept 5 years (9.4).
 */
export const auditLog = mysqlTable(
	'audit_log',
	{
		id: int('id').autoincrement().primaryKey(),
		userId: varchar('user_id', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		action: varchar('action', { length: 20 }).notNull(),
		tableName: varchar('table_name', { length: 64 }).notNull(),
		recordId: varchar('record_id', { length: 64 }).notNull(),
		changes: json('changes'),
		ipAddress: varchar('ip_address', { length: 45 }),
		branchId: int('branch_id'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('audit_log_record_idx').on(table.tableName, table.recordId, table.id),
		index('audit_log_created_idx').on(table.createdAt)
	]
);

/**
 * The languages content is written in: Amharic, English, Afaan Oromo, Arabic. Adding one is a row
 * here, an entry in `#lib/languages` and a paraglide message file; every `localized` column picks it
 * up without a migration.
 */
export const language = mysqlTable('language', {
	code: varchar('code', { length: 8 }).primaryKey(),
	name: varchar('name', { length: 50 }).notNull(),
	nativeName: varchar('native_name', { length: 50 }).notNull(),
	/** Must every customer-facing record be filled in this language before it is published? */
	isRequired: boolean('is_required').default(true).notNull(),
	isDefault: boolean('is_default').default(false).notNull(),
	sortOrder: smallint('sort_order').default(0).notNull(),
	...lesserFields
});

/**
 * Every number the business may change without a deploy (questionnaire: "anything the client might
 * change later is a setting"): free-delivery threshold, roast weekdays, hold expiry days, low-stock
 * defaults, refund windows, receipt TIN. Typed defaults live in code; a row here overrides one.
 */
export const setting = mysqlTable('setting', {
	key: varchar('key', { length: 100 }).primaryKey(),
	value: json('value').notNull(),
	description: varchar('description', { length: 255 }),
	updatedBy: userRef('updated_by'),
	updatedAt: timestamp('updated_at')
		.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
		.notNull()
});

/**
 * Gap-free document numbers: `order:2026` → KC-26-000123, `roast_batch:261120` → RB-261120-02,
 * `lot:LIM:2026` → KGT-LIM-2026-014. Taken with `SELECT … FOR UPDATE` inside the write's own
 * transaction, so two checkouts never share a number and a rolled-back one never burns one.
 */
export const documentSequence = mysqlTable('document_sequence', {
	key: varchar('key', { length: 64 }).primaryKey(),
	nextValue: int('next_value').notNull().default(1),
	updatedAt: timestamp('updated_at')
		.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
		.notNull()
});

/**
 * Every place that sells, holds stock, admits visitors or hosts bookings (questionnaire 1.2, 1.3):
 * Site A, Site B, the museum shop inside Site A, the café, the roastery, the warehouse.
 * Splitting tickets per site later, or opening a second shop, is new rows, not new tables.
 */
export const location = mysqlTable(
	'location',
	{
		id: id(),
		code: varchar('code', { length: 20 }).notNull().unique(),
		name: localized('name').notNull(),
		type: status('type', LOCATION_TYPES).notNull(),
		/** The shop inside Site A, the ceremony area inside Site B. */
		parentId: int('parent_id').references((): AnyMySqlColumn => location.id, {
			onDelete: 'restrict'
		}),
		address: varchar('address', { length: 255 }),
		latitude: decimal('latitude', { precision: 9, scale: 6, mode: 'number' }),
		longitude: decimal('longitude', { precision: 9, scale: 6, mode: 'number' }),
		phone: varchar('phone', { length: 20 }),
		holdsStock: boolean('holds_stock').default(false).notNull(),
		sellsAtDesk: boolean('sells_at_desk').default(false).notNull(),
		/** Ships online orders from here. */
		fulfilsOnline: boolean('fulfils_online').default(false).notNull(),
		/** Customers may collect orders here (questionnaire 3.7). */
		isPickupPoint: boolean('is_pickup_point').default(false).notNull(),
		/** Visitor capacity is counted here (Site A; questionnaire 1.2). */
		controlsCapacity: boolean('controls_capacity').default(false).notNull(),
		admitsVisitors: boolean('admits_visitors').default(false).notNull(),
		sortOrder: smallint('sort_order').default(0).notNull(),
		...secureFields
	},
	(table) => [index('location_type_idx').on(table.type)]
);

/** The weekly pattern, per location, so Site B can close earlier (questionnaire 1.2, 6.3). */
export const openingHours = mysqlTable(
	'opening_hours',
	{
		id: id(),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'cascade' }),
		/** ISO weekday: 1 Monday … 7 Sunday. */
		weekday: tinyint('weekday').notNull(),
		isClosed: boolean('is_closed').default(false).notNull(),
		opensAt: time('opens_at'),
		closesAt: time('closes_at'),
		lastEntryAt: time('last_entry_at')
	},
	(table) => [uniqueIndex('opening_hours_location_day_uq').on(table.locationId, table.weekday)]
);

/**
 * Days the pattern does not hold: holidays (Meskel, Timket), closures, special hours. A null
 * location means every location. A closure cancels that day's slots and refunds tickets (6.5).
 */
export const calendarException = mysqlTable(
	'calendar_exception',
	{
		id: id(),
		date: date('date', { mode: 'string' }).notNull(),
		locationId: int('location_id').references(() => location.id, { onDelete: 'cascade' }),
		name: localized('name').notNull(),
		isHoliday: boolean('is_holiday').default(false).notNull(),
		isClosed: boolean('is_closed').default(true).notNull(),
		opensAt: time('opens_at'),
		closesAt: time('closes_at'),
		/** Also no roasting that day: pushes roast-to-order dispatch dates. */
		blocksRoasting: boolean('blocks_roasting').default(false).notNull(),
		...secureFields
	},
	(table) => [index('calendar_exception_date_idx').on(table.date, table.locationId)]
);

/**
 * VAT and any future tax, referenced by everything sellable and copied onto each order line, so a
 * rate change is one edit and never rewrites a past receipt (questionnaire 2.6).
 */
export const taxRate = mysqlTable('tax_rate', {
	id: id(),
	code: varchar('code', { length: 20 }).notNull().unique(),
	name: localized('name').notNull(),
	rate: percent('rate'),
	/** Prices include this tax (true at launch: shown prices include 15% VAT). */
	isInclusive: boolean('is_inclusive').default(true).notNull(),
	isDefault: boolean('is_default').default(false).notNull(),
	...lesserFields
});

/**
 * Who a price is for: Ethiopian resident, foreign visitor — and whatever comes later (diaspora,
 * ECOWAS). Tickets, bookings and events price per audience (questionnaire 6.1, 8.1).
 */
export const audience = mysqlTable('audience', {
	id: id(),
	code: varchar('code', { length: 20 }).notNull().unique(),
	name: localized('name').notNull(),
	/** The colour the e-ticket and scanner show it in (6.2): `#16a34a` resident, `#2563eb` foreign. */
	colour: varchar('colour', { length: 9 }),
	/** Staff ask for ID at the door. */
	requiresIdCheck: boolean('requires_id_check').default(false).notNull(),
	/** The box the buyer ticks at checkout (6.2). */
	declaration: localized('declaration'),
	isDefault: boolean('is_default').default(false).notNull(),
	sortOrder: smallint('sort_order').default(0).notNull(),
	...lesserFields
});

/** The CMS media library. Other tables store file names directly, as the kit's uploads return them. */
export const media = mysqlTable(
	'media',
	{
		id: id(),
		fileName: file('file_name').notNull().unique(),
		mimeType: varchar('mime_type', { length: 100 }).notNull(),
		sizeBytes: int('size_bytes').notNull(),
		width: int('width'),
		height: int('height'),
		alt: localized('alt'),
		caption: localized('caption'),
		folder: varchar('folder', { length: 100 }),
		...secureFields
	},
	(table) => [index('media_folder_idx').on(table.folder)]
);

/**
 * Message wording per event, channel and language, edited by staff: `order.paid`,
 * `order.roasting`, `membership.renewal_due`, `booking.confirmed` (questionnaire 3.3, 7.4, 8.5).
 */
export const notificationTemplate = mysqlTable(
	'notification_template',
	{
		id: id(),
		key: varchar('key', { length: 64 }).notNull(),
		channel: status('channel', CONTACT_CHANNELS).notNull(),
		locale: varchar('locale', { length: 8 }).notNull(),
		subject: varchar('subject', { length: 255 }),
		/** With `{{placeholders}}`. */
		body: text('body').notNull(),
		...secureFields
	},
	(table) => [uniqueIndex('notification_template_uq').on(table.key, table.channel, table.locale)]
);

/**
 * The outbox: every SMS, email and Telegram message is a row first and sent by a worker, so a
 * failed gateway retries instead of losing the message, and nothing is sent twice: `dedupeKey`
 * (`membership:42:renewal:-14d`) is unique.
 */
export const notification = mysqlTable(
	'notification',
	{
		id: bigId(),
		channel: status('channel', CONTACT_CHANNELS).notNull(),
		templateKey: varchar('template_key', { length: 64 }).notNull(),
		locale: varchar('locale', { length: 8 }).notNull(),
		recipient: varchar('recipient', { length: 255 }).notNull(),
		customerId: int('customer_id'),
		userId: userRef('user_id'),
		payload: json('payload').$type<Record<string, unknown>>(),
		/** Marketing messages are only sent with a granted consent (9.3); transactional ones always. */
		isMarketing: boolean('is_marketing').default(false).notNull(),
		status: status('status', NOTIFICATION_STATUSES).notNull().default('queued'),
		attempts: tinyint('attempts').default(0).notNull(),
		lastError: varchar('last_error', { length: 500 }),
		providerRef: varchar('provider_ref', { length: 100 }),
		dedupeKey: varchar('dedupe_key', { length: 150 }).unique(),
		/** What the message is about, for "messages sent for this order". */
		refType: varchar('ref_type', { length: 32 }),
		refId: varchar('ref_id', { length: 64 }),
		scheduledFor: datetime('scheduled_for')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		sentAt: datetime('sent_at'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('notification_queue_idx').on(table.status, table.scheduledFor),
		index('notification_ref_idx').on(table.refType, table.refId),
		index('notification_customer_idx').on(table.customerId)
	]
);

/**
 * Each payment-gateway callback as received, keyed by the provider's event id, so a webhook
 * delivered twice is processed once and every one can be replayed.
 */
export const webhookEvent = mysqlTable(
	'webhook_event',
	{
		id: bigId(),
		provider: varchar('provider', { length: 32 }).notNull(),
		eventId: varchar('event_id', { length: 128 }).notNull(),
		eventType: varchar('event_type', { length: 64 }),
		payload: json('payload').notNull(),
		signatureValid: boolean('signature_valid').notNull(),
		processedAt: datetime('processed_at'),
		error: varchar('error', { length: 500 }),
		receivedAt: timestamp('received_at').defaultNow().notNull()
	},
	(table) => [uniqueIndex('webhook_event_uq').on(table.provider, table.eventId)]
);
