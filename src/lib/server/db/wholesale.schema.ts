/**
 * Phase 2 wholesale portal (questionnaire 11): business accounts that must be approved before they
 * see wholesale prices, quantity tiers, and credit terms set per account by the Owner.
 *
 * The people who sign in for a business are ordinary `customer` rows linked through
 * `business_member`, so one person can order for several businesses and the retail account keeps
 * working.
 */
import { relations } from 'drizzle-orm';
import {
	boolean,
	decimal,
	index,
	int,
	mysqlTable,
	smallint,
	uniqueIndex,
	varchar
} from 'drizzle-orm/mysql-core';
import {
	approvalFields,
	currency,
	extra,
	file,
	id,
	kg,
	kgOrNull,
	lesserFields,
	localized,
	money,
	percent,
	secureFields,
	status
} from './fields';
import { customer, deliveryArea } from './customers.schema';
import { BUSINESS_TYPES } from '../../constants';

/** Quantity tiers against the retail 1 kg price (11.3): 5–19 kg −20%, 20–49 −27%, 50+ −33%. */
export const wholesaleTier = mysqlTable('wholesale_tier', {
	id: id(),
	name: localized('name').notNull(),
	minKg: kg('min_kg'),
	/** Null: no upper bound. */
	maxKg: kgOrNull('max_kg'),
	discountPct: percent('discount_pct'),
	sortOrder: smallint('sort_order').default(0).notNull(),
	...lesserFields
});

/**
 * A café, hotel, office or retailer. `approvalFields` is the kit's maker-checker: the applicant
 * requests, a Manager or Owner approves or rejects (11.2).
 */
export const businessAccount = mysqlTable(
	'business_account',
	{
		id: id(),
		name: varchar('name', { length: 150 }).notNull(),
		type: status('type', BUSINESS_TYPES).notNull(),
		tradeLicenceNumber: varchar('trade_licence_number', { length: 64 }).notNull(),
		tradeLicenceFile: file('trade_licence_file'),
		tin: varchar('tin', { length: 20 }).notNull().unique(),
		vatNumber: varchar('vat_number', { length: 32 }),
		contactName: varchar('contact_name', { length: 150 }).notNull(),
		contactPhone: varchar('contact_phone', { length: 20 }).notNull(),
		contactEmail: varchar('contact_email', { length: 255 }),
		expectedMonthlyKg: kgOrNull('expected_monthly_kg'),
		/** Extra key-account discount on top of the tier, set by the Owner (11.3). */
		discountPct: percent('discount_pct'),
		/** Credit is an exception (11.5): off by default, then a limit and terms. */
		creditApproved: boolean('credit_approved').default(false).notNull(),
		creditLimit: money('credit_limit'),
		currency: currency(),
		paymentTermsDays: smallint('payment_terms_days').default(0).notNull(),
		/** Per-account override of the minimum order (11.4); null → the setting. */
		minOrderKg: kgOrNull('min_order_kg'),
		notes: varchar('notes', { length: 500 }),
		extra: extra(),
		...approvalFields,
		...secureFields
	},
	(table) => [index('business_account_approval_idx').on(table.approvalStatus)]
);

/** The customers who may order for a business, and whether they administer it. */
export const businessMember = mysqlTable(
	'business_member',
	{
		id: id(),
		businessAccountId: int('business_account_id')
			.notNull()
			.references(() => businessAccount.id, { onDelete: 'cascade' }),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'cascade' }),
		isAdmin: boolean('is_admin').default(false).notNull(),
		...lesserFields
	},
	(table) => [
		uniqueIndex('business_member_uq').on(table.businessAccountId, table.customerId),
		index('business_member_customer_idx').on(table.customerId)
	]
);

/** Delivery addresses (several) and the billing address (11.1). */
export const businessAddress = mysqlTable(
	'business_address',
	{
		id: id(),
		businessAccountId: int('business_account_id')
			.notNull()
			.references(() => businessAccount.id, { onDelete: 'cascade' }),
		label: varchar('label', { length: 50 }),
		areaId: int('area_id').references(() => deliveryArea.id, { onDelete: 'restrict' }),
		city: varchar('city', { length: 64 }).notNull().default('Addis Ababa'),
		line1: varchar('line1', { length: 255 }).notNull(),
		landmark: varchar('landmark', { length: 255 }),
		latitude: decimal('latitude', { precision: 9, scale: 6, mode: 'number' }),
		longitude: decimal('longitude', { precision: 9, scale: 6, mode: 'number' }),
		isBilling: boolean('is_billing').default(false).notNull(),
		isDefaultDelivery: boolean('is_default_delivery').default(false).notNull(),
		...secureFields
	},
	(table) => [index('business_address_account_idx').on(table.businessAccountId)]
);

export const businessAccountRelations = relations(businessAccount, ({ many }) => ({
	members: many(businessMember),
	addresses: many(businessAddress)
}));

export const businessMemberRelations = relations(businessMember, ({ one }) => ({
	businessAccount: one(businessAccount, {
		fields: [businessMember.businessAccountId],
		references: [businessAccount.id]
	}),
	customer: one(customer, { fields: [businessMember.customerId], references: [customer.id] })
}));

export const businessAddressRelations = relations(businessAddress, ({ one }) => ({
	businessAccount: one(businessAccount, {
		fields: [businessAddress.businessAccountId],
		references: [businessAccount.id]
	})
}));
