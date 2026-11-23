/**
 * Customers and how to reach them (questionnaire 9): one customer record per person, with or
 * without a sign-in, covering orders, tickets, memberships, subscriptions and bookings.
 *
 * A guest checkout creates a `customer` with no `userId`. When the same phone or email later
 * signs up, the user is attached to that row, which links the guest history automatically (9.1).
 */
import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	datetime,
	decimal,
	index,
	int,
	mysqlTable,
	smallint,
	varchar
} from 'drizzle-orm/mysql-core';
import { user } from './auth.schema';
import {
	bigId,
	currency,
	extra,
	id,
	lesserFields,
	localized,
	money,
	secureFields,
	status,
	userRef
} from './fields';
import { CONTACT_CHANNELS, CREDIT_REASONS } from '../../constants';

export const customer = mysqlTable(
	'customer',
	{
		id: id(),
		/** The sign-in, once they have one. Unique: one customer per account. */
		userId: varchar('user_id', { length: 255 })
			.unique()
			.references(() => user.id, { onDelete: 'set null' }),
		name: varchar('name', { length: 150 }),
		/** E.164 (`+251912605824`). The main identity (9.1). */
		phone: varchar('phone', { length: 20 }).unique(),
		email: varchar('email', { length: 255 }),
		locale: varchar('locale', { length: 8 }).notNull().default('am'),
		/** For VAT invoices (2.6). */
		tin: varchar('tin', { length: 20 }),
		businessName: varchar('business_name', { length: 150 }),
		telegramChatId: varchar('telegram_chat_id', { length: 32 }),
		/** newsletter_import, web, desk, telegram… */
		source: varchar('source', { length: 32 }),
		notes: varchar('notes', { length: 500 }),
		lastActivityAt: datetime('last_activity_at'),
		/**
		 * Set when personal data is wiped — on request or after 3 years idle (9.4). Orders stay, with
		 * no name attached.
		 */
		anonymizedAt: datetime('anonymized_at'),
		extra: extra(),
		...secureFields
	},
	(table) => [
		index('customer_email_idx').on(table.email),
		index('customer_name_idx').on(table.name),
		index('customer_activity_idx').on(table.lastActivityAt)
	]
);

/**
 * Delivery zones by sub-city (3.5). Fee and free-delivery threshold are per zone; a zone may be
 * pickup (free) or courier (outside Addis).
 */
export const deliveryZone = mysqlTable('delivery_zone', {
	id: id(),
	code: varchar('code', { length: 20 }).notNull().unique(),
	name: localized('name').notNull(),
	fee: money('fee'),
	currency: currency(),
	/** Free above this order total; null → never free (3.5). */
	freeAbove: decimal('free_above', { precision: 14, scale: 2, mode: 'number' }),
	/** Members ride free here (7.2). */
	freeForMembers: boolean('free_for_members').default(true).notNull(),
	isPickup: boolean('is_pickup').default(false).notNull(),
	usesCourier: boolean('uses_courier').default(false).notNull(),
	/** Extra working days on top of dispatch. */
	transitDays: smallint('transit_days').default(0).notNull(),
	sortOrder: smallint('sort_order').default(0).notNull(),
	...lesserFields
});

/** The sub-cities and towns a zone covers, for the address picker. */
export const deliveryArea = mysqlTable(
	'delivery_area',
	{
		id: id(),
		zoneId: int('zone_id')
			.notNull()
			.references(() => deliveryZone.id, { onDelete: 'restrict' }),
		name: localized('name').notNull(),
		sortOrder: smallint('sort_order').default(0).notNull(),
		...lesserFields
	},
	(table) => [index('delivery_area_zone_idx').on(table.zoneId)]
);

/** EMS or a private courier, for orders outside Addis (3.6). A courier API slots in later. */
export const courier = mysqlTable('courier', {
	id: id(),
	name: varchar('name', { length: 64 }).notNull().unique(),
	phone: varchar('phone', { length: 20 }),
	/** `https://…/track?n={tracking}` */
	trackingUrlTemplate: varchar('tracking_url_template', { length: 255 }),
	...lesserFields
});

export const customerAddress = mysqlTable(
	'customer_address',
	{
		id: id(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'cascade' }),
		label: varchar('label', { length: 50 }),
		recipientName: varchar('recipient_name', { length: 150 }),
		phone: varchar('phone', { length: 20 }),
		areaId: int('area_id').references(() => deliveryArea.id, { onDelete: 'restrict' }),
		city: varchar('city', { length: 64 }).notNull().default('Addis Ababa'),
		woreda: varchar('woreda', { length: 64 }),
		/** House, building, street — and the landmark everyone in Addis actually navigates by. */
		line1: varchar('line1', { length: 255 }).notNull(),
		landmark: varchar('landmark', { length: 255 }),
		latitude: decimal('latitude', { precision: 9, scale: 6, mode: 'number' }),
		longitude: decimal('longitude', { precision: 9, scale: 6, mode: 'number' }),
		isDefault: boolean('is_default').default(false).notNull(),
		...secureFields
	},
	(table) => [index('customer_address_customer_idx').on(table.customerId)]
);

/**
 * Marketing consent, append-only, per channel (9.3): every grant and withdrawal is a row with its
 * time and source, so the current state is the latest row and the history is the proof.
 * Imported contacts with no row are not messaged.
 */
export const marketingConsent = mysqlTable(
	'marketing_consent',
	{
		id: bigId(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'cascade' }),
		channel: status('channel', CONTACT_CHANNELS).notNull(),
		granted: boolean('granted').notNull(),
		/** checkout, booking_form, newsletter_import, sms_stop, unsubscribe_link… */
		source: varchar('source', { length: 32 }).notNull(),
		ipAddress: varchar('ip_address', { length: 45 }),
		recordedBy: userRef('recorded_by'),
		recordedAt: datetime('recorded_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [index('marketing_consent_latest_idx').on(table.customerId, table.channel, table.id)]
);

/**
 * Store credit as a ledger (7.5: unused subscription deliveries may become credit). The balance is
 * the sum; redeeming is a negative row tied to the order.
 */
export const storeCredit = mysqlTable(
	'store_credit',
	{
		id: id(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		amount: money('amount'),
		currency: currency(),
		reason: status('reason', CREDIT_REASONS).notNull(),
		refType: varchar('ref_type', { length: 32 }),
		refId: varchar('ref_id', { length: 64 }),
		expiresAt: datetime('expires_at'),
		note: varchar('note', { length: 255 }),
		createdBy: userRef('created_by'),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [index('store_credit_customer_idx').on(table.customerId)]
);

export const customerRelations = relations(customer, ({ one, many }) => ({
	user: one(user, { fields: [customer.userId], references: [user.id] }),
	addresses: many(customerAddress),
	consents: many(marketingConsent),
	credits: many(storeCredit)
}));

export const customerAddressRelations = relations(customerAddress, ({ one }) => ({
	customer: one(customer, { fields: [customerAddress.customerId], references: [customer.id] }),
	area: one(deliveryArea, { fields: [customerAddress.areaId], references: [deliveryArea.id] })
}));

export const deliveryAreaRelations = relations(deliveryArea, ({ one }) => ({
	zone: one(deliveryZone, { fields: [deliveryArea.zoneId], references: [deliveryZone.id] })
}));

export const marketingConsentRelations = relations(marketingConsent, ({ one }) => ({
	customer: one(customer, { fields: [marketingConsent.customerId], references: [customer.id] })
}));

export const storeCreditRelations = relations(storeCredit, ({ one }) => ({
	customer: one(customer, { fields: [storeCredit.customerId], references: [customer.id] })
}));
