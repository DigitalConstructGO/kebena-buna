/**
 * Visiting the museum (questionnaire 6, 8.3): ticket types priced per audience, timed-entry days
 * and slots with capacity, events, issued tickets with QR codes, and the offline scanner's log.
 *
 * Capacity is a counter on the slot (`sold`, `held`), incremented under a row lock in the same
 * transaction as the sale, so the website and the front desk draw from one pool and the venue never
 * oversells (6.3) — without counting tickets on every checkout.
 */
import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	datetime,
	index,
	int,
	mysqlTable,
	smallint,
	time,
	tinyint,
	uniqueIndex,
	varchar,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import {
	bigId,
	currency,
	file,
	id,
	lesserFields,
	localized,
	money,
	secureFields,
	status,
	userRef
} from './fields';
import { audience, location, taxRate } from './system.schema';
import { customer } from './customers.schema';
import { order, orderLine } from './orders.schema';
import { membershipMember, membership } from './memberships.schema';
import {
	EVENT_VISIBILITIES,
	PUBLISH_STATUSES,
	SCAN_RESULTS,
	TICKET_CHANGE_KINDS,
	TICKET_STATUSES
} from '../../constants';

/**
 * Adult, Student, Child 6–12, Child under 6, Group (10+), School group (6.1). An event's own
 * ticket types point at the event; entry types leave `eventId` null.
 */
export const ticketType = mysqlTable(
	'ticket_type',
	{
		id: id(),
		code: varchar('code', { length: 24 }).notNull(),
		name: localized('name').notNull(),
		description: localized('description'),
		eventId: int('event_id').references((): AnyMySqlColumn => event.id, { onDelete: 'restrict' }),
		/** Student ID, Kebele ID… shown on the scanner (6.2). */
		requiresProof: localized('requires_proof'),
		/** Group tickets: one QR for the whole party. */
		minQuantity: smallint('min_quantity').default(1).notNull(),
		maxQuantity: smallint('max_quantity'),
		/** People admitted per ticket: 1, or the head count for a group QR. */
		admitsPerTicket: smallint('admits_per_ticket').default(1).notNull(),
		/** Counted against slot capacity (a free under-6 still is, 6.1). */
		countsTowardCapacity: boolean('counts_toward_capacity').default(true).notNull(),
		/** Only sold by staff (school groups on invoice). */
		isStaffOnly: boolean('is_staff_only').default(false).notNull(),
		isMemberOnly: boolean('is_member_only').default(false).notNull(),
		taxRateId: int('tax_rate_id').references(() => taxRate.id, { onDelete: 'restrict' }),
		sortOrder: smallint('sort_order').default(0).notNull(),
		...secureFields
	},
	(table) => [uniqueIndex('ticket_type_code_uq').on(table.code, table.eventId)]
);

/**
 * The price grid: ticket type × audience (× currency). A missing row means "not sold to that
 * audience" (the school-group rate has no foreign price). Changing a price is an edit here,
 * audited; sold tickets keep theirs on the order line.
 */
export const ticketPrice = mysqlTable(
	'ticket_price',
	{
		id: id(),
		ticketTypeId: int('ticket_type_id')
			.notNull()
			.references(() => ticketType.id, { onDelete: 'cascade' }),
		audienceId: int('audience_id')
			.notNull()
			.references(() => audience.id, { onDelete: 'restrict' }),
		price: money('price'),
		currency: currency(),
		...lesserFields
	},
	(table) => [
		uniqueIndex('ticket_price_uq').on(table.ticketTypeId, table.audienceId, table.currency)
	]
);

/**
 * The weekly slot pattern per location: 09:00–17:00 in 1-hour slots, 50 per slot (6.3). Days and
 * slots are generated from it ahead of time and may then be edited one by one.
 */
export const slotTemplate = mysqlTable(
	'slot_template',
	{
		id: id(),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		weekday: tinyint('weekday').notNull(),
		startsAt: time('starts_at').notNull(),
		endsAt: time('ends_at').notNull(),
		capacity: smallint('capacity').notNull(),
		...lesserFields
	},
	(table) => [uniqueIndex('slot_template_uq').on(table.locationId, table.weekday, table.startsAt)]
);

/** A date's overall cap (400 a day) and whether it is open. */
export const visitDay = mysqlTable(
	'visit_day',
	{
		id: id(),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		date: date('date', { mode: 'string' }).notNull(),
		capacity: smallint('capacity').notNull(),
		sold: smallint('sold').default(0).notNull(),
		held: smallint('held').default(0).notNull(),
		isClosed: boolean('is_closed').default(false).notNull(),
		closedReason: localized('closed_reason'),
		...secureFields
	},
	(table) => [
		uniqueIndex('visit_day_uq').on(table.locationId, table.date),
		check('visit_day_capacity_chk', sql`${table.sold} + ${table.held} <= ${table.capacity}`)
	]
);

/** One timed-entry slot. `held` is capacity reserved for unpaid group bookings (6.6). */
export const visitSlot = mysqlTable(
	'visit_slot',
	{
		id: id(),
		visitDayId: int('visit_day_id')
			.notNull()
			.references(() => visitDay.id, { onDelete: 'cascade' }),
		startsAt: datetime('starts_at').notNull(),
		endsAt: datetime('ends_at').notNull(),
		capacity: smallint('capacity').notNull(),
		sold: smallint('sold').default(0).notNull(),
		held: smallint('held').default(0).notNull(),
		isClosed: boolean('is_closed').default(false).notNull()
	},
	(table) => [
		uniqueIndex('visit_slot_uq').on(table.visitDayId, table.startsAt),
		index('visit_slot_starts_idx').on(table.startsAt),
		check('visit_slot_capacity_chk', sql`${table.sold} + ${table.held} <= ${table.capacity}`)
	]
);

/**
 * Talks, tastings, exhibitions (8.3). Every event needs registration; a free one issues free
 * tickets, a paid one sells its own ticket types. Both use the entry tickets' QR and scanner.
 */
export const event = mysqlTable(
	'event',
	{
		id: id(),
		slug: varchar('slug', { length: 120 }).notNull().unique(),
		title: localized('title').notNull(),
		summary: localized('summary'),
		description: localized('description'),
		image: file('image'),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		startsAt: datetime('starts_at').notNull(),
		endsAt: datetime('ends_at').notNull(),
		capacity: smallint('capacity').notNull(),
		registered: smallint('registered').default(0).notNull(),
		visibility: status('visibility', EVENT_VISIBILITIES).notNull().default('public'),
		isFree: boolean('is_free').default(true).notNull(),
		/** Does an event ticket also admit to the museum that day? */
		includesEntry: boolean('includes_entry').default(false).notNull(),
		registrationClosesAt: datetime('registration_closes_at'),
		publishStatus: status('publish_status', PUBLISH_STATUSES).notNull().default('draft'),
		...secureFields
	},
	(table) => [
		index('event_starts_idx').on(table.startsAt),
		check('event_capacity_chk', sql`${table.registered} <= ${table.capacity}`)
	]
);

/**
 * An issued ticket: one QR. `code` is short and random; the QR carries it signed (HMAC), so the
 * offline scanner verifies it without the network (6.7). A group ticket admits `admits` people and
 * may be checked in in parts (6.6). Visit date is copied off the slot for the day's download.
 */
export const ticket = mysqlTable(
	'ticket',
	{
		id: id(),
		code: varchar('code', { length: 16 }).notNull().unique(),
		orderId: int('order_id').references((): AnyMySqlColumn => order.id, {
			onDelete: 'restrict'
		}),
		orderLineId: int('order_line_id').references((): AnyMySqlColumn => orderLine.id, {
			onDelete: 'restrict'
		}),
		customerId: int('customer_id').references(() => customer.id, { onDelete: 'set null' }),
		ticketTypeId: int('ticket_type_id')
			.notNull()
			.references(() => ticketType.id, { onDelete: 'restrict' }),
		audienceId: int('audience_id')
			.notNull()
			.references(() => audience.id, { onDelete: 'restrict' }),
		visitSlotId: int('visit_slot_id').references(() => visitSlot.id, { onDelete: 'restrict' }),
		eventId: int('event_id').references(() => event.id, { onDelete: 'restrict' }),
		/** A member's free reservation (7.2). */
		membershipId: int('membership_id').references((): AnyMySqlColumn => membership.id, {
			onDelete: 'restrict'
		}),
		visitDate: date('visit_date', { mode: 'string' }).notNull(),
		holderName: varchar('holder_name', { length: 150 }),
		admits: smallint('admits').default(1).notNull(),
		checkedIn: smallint('checked_in').default(0).notNull(),
		status: status('status', TICKET_STATUSES).notNull().default('valid'),
		firstCheckedInAt: datetime('first_checked_in_at'),
		/** The language it was bought in — the e-ticket prints in it (1.1). */
		locale: varchar('locale', { length: 8 }).notNull().default('am'),
		issuedAt: datetime('issued_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		cancelledAt: datetime('cancelled_at')
	},
	(table) => [
		index('ticket_day_idx').on(table.visitDate, table.status),
		index('ticket_slot_idx').on(table.visitSlotId),
		index('ticket_event_idx').on(table.eventId),
		index('ticket_order_idx').on(table.orderId),
		index('ticket_customer_idx').on(table.customerId)
	]
);

/** Reschedules, upgrades at the desk, refunds — each logged with who and the money moved (6.2, 6.5). */
export const ticketChange = mysqlTable(
	'ticket_change',
	{
		id: id(),
		ticketId: int('ticket_id')
			.notNull()
			.references(() => ticket.id, { onDelete: 'cascade' }),
		kind: status('kind', TICKET_CHANGE_KINDS).notNull(),
		fromSlotId: int('from_slot_id').references(() => visitSlot.id, { onDelete: 'set null' }),
		toSlotId: int('to_slot_id').references(() => visitSlot.id, { onDelete: 'set null' }),
		fromTicketTypeId: int('from_ticket_type_id').references(() => ticketType.id, {
			onDelete: 'set null'
		}),
		toTicketTypeId: int('to_ticket_type_id').references(() => ticketType.id, {
			onDelete: 'set null'
		}),
		fromAudienceId: int('from_audience_id').references(() => audience.id, {
			onDelete: 'set null'
		}),
		toAudienceId: int('to_audience_id').references(() => audience.id, { onDelete: 'set null' }),
		/** Positive: the visitor paid the difference; negative: refunded. */
		amount: money('amount'),
		orderId: int('order_id').references((): AnyMySqlColumn => order.id, {
			onDelete: 'set null'
		}),
		reason: varchar('reason', { length: 255 }),
		changedBy: userRef('changed_by'),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [index('ticket_change_ticket_idx').on(table.ticketId)]
);

/** A phone or tablet running the scanner. Its token signs its sync requests. */
export const scannerDevice = mysqlTable('scanner_device', {
	id: id(),
	name: varchar('name', { length: 64 }).notNull(),
	locationId: int('location_id').references(() => location.id, { onDelete: 'restrict' }),
	tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
	lastSyncAt: datetime('last_sync_at'),
	...secureFields
});

/**
 * Every scan, synced from the device. `clientScanId` is generated on the device, so a sync that
 * retries never doubles a check-in. Two offline devices admitting one ticket both land here; the
 * second is marked `duplicate_offline` on sync (6.7). Kept 2 years (9.4).
 */
export const ticketScan = mysqlTable(
	'ticket_scan',
	{
		id: bigId(),
		clientScanId: varchar('client_scan_id', { length: 36 }).notNull().unique(),
		scannedCode: varchar('scanned_code', { length: 64 }).notNull(),
		ticketId: int('ticket_id').references(() => ticket.id, { onDelete: 'set null' }),
		/** A member's card QR (7.3). */
		membershipMemberId: int('membership_member_id').references(
			(): AnyMySqlColumn => membershipMember.id,
			{ onDelete: 'set null' }
		),
		deviceId: int('device_id').references(() => scannerDevice.id, { onDelete: 'set null' }),
		locationId: int('location_id').references(() => location.id, { onDelete: 'set null' }),
		scannedBy: userRef('scanned_by'),
		result: status('result', SCAN_RESULTS).notNull(),
		headcount: smallint('headcount').default(1).notNull(),
		wasOffline: boolean('was_offline').default(false).notNull(),
		/** The device's clock. */
		scannedAt: datetime('scanned_at').notNull(),
		syncedAt: datetime('synced_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		index('ticket_scan_ticket_idx').on(table.ticketId),
		index('ticket_scan_time_idx').on(table.scannedAt)
	]
);

export const ticketTypeRelations = relations(ticketType, ({ one, many }) => ({
	event: one(event, { fields: [ticketType.eventId], references: [event.id] }),
	prices: many(ticketPrice)
}));

export const ticketPriceRelations = relations(ticketPrice, ({ one }) => ({
	ticketType: one(ticketType, { fields: [ticketPrice.ticketTypeId], references: [ticketType.id] }),
	audience: one(audience, { fields: [ticketPrice.audienceId], references: [audience.id] })
}));

export const visitDayRelations = relations(visitDay, ({ many }) => ({
	slots: many(visitSlot)
}));

export const visitSlotRelations = relations(visitSlot, ({ one, many }) => ({
	day: one(visitDay, { fields: [visitSlot.visitDayId], references: [visitDay.id] }),
	tickets: many(ticket)
}));

export const ticketRelations = relations(ticket, ({ one, many }) => ({
	ticketType: one(ticketType, { fields: [ticket.ticketTypeId], references: [ticketType.id] }),
	audience: one(audience, { fields: [ticket.audienceId], references: [audience.id] }),
	slot: one(visitSlot, { fields: [ticket.visitSlotId], references: [visitSlot.id] }),
	event: one(event, { fields: [ticket.eventId], references: [event.id] }),
	customer: one(customer, { fields: [ticket.customerId], references: [customer.id] }),
	order: one(order, { fields: [ticket.orderId], references: [order.id] }),
	changes: many(ticketChange),
	scans: many(ticketScan)
}));

export const ticketChangeRelations = relations(ticketChange, ({ one }) => ({
	ticket: one(ticket, { fields: [ticketChange.ticketId], references: [ticket.id] })
}));

export const ticketScanRelations = relations(ticketScan, ({ one }) => ({
	ticket: one(ticket, { fields: [ticketScan.ticketId], references: [ticket.id] })
}));
