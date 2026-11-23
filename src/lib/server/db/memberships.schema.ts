/**
 * Memberships and coffee subscriptions (questionnaire 7).
 *
 * Neither charges a stored card: memberships renew by reminder and payment link (7.4), and
 * subscriptions are prepaid bundles of deliveries (7.5). `renewalMethod` and the bundle rows leave
 * room for automatic charging once a gateway supports it, without reshaping anything.
 */
import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	date,
	datetime,
	index,
	int,
	mysqlTable,
	smallint,
	tinyint,
	uniqueIndex,
	varchar,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import {
	currency,
	file,
	id,
	localized,
	money,
	percent,
	secureFields,
	status,
	userRef
} from './fields';
import { taxRate } from './system.schema';
import { customer, customerAddress, deliveryZone } from './customers.schema';
import { grind, productVariant, roastLevel } from './catalog.schema';
import { order, orderLine } from './orders.schema';
import {
	MEMBERSHIP_STATUSES,
	PUBLISH_STATUSES,
	RENEWAL_METHODS,
	SUBSCRIPTION_DELIVERY_STATUSES,
	SUBSCRIPTION_FREQUENCIES,
	SUBSCRIPTION_STATUSES
} from '../../constants';

/**
 * Individual, Family, Student, Patron (7.1). The benefits the system applies by itself are
 * columns (7.2); anything staff apply by hand goes in `benefits` text.
 */
export const membershipPlan = mysqlTable('membership_plan', {
	id: id(),
	code: varchar('code', { length: 24 }).notNull().unique(),
	name: localized('name').notNull(),
	description: localized('description'),
	benefits: localized('benefits'),
	price: money('price'),
	currency: currency(),
	taxRateId: int('tax_rate_id').references(() => taxRate.id, { onDelete: 'restrict' }),
	durationMonths: tinyint('duration_months').notNull().default(12),
	graceDays: tinyint('grace_days').notNull().default(7),
	maxAdults: tinyint('max_adults').notNull().default(1),
	maxChildren: tinyint('max_children').notNull().default(0),
	/** One family QR admitting this many, instead of a card each (7.3). */
	sharedCardAdmits: tinyint('shared_card_admits'),
	requiresProof: localized('requires_proof'),
	freeEntry: boolean('free_entry').default(true).notNull(),
	shopDiscountPct: percent('shop_discount_pct'),
	freeDelivery: boolean('free_delivery').default(true).notNull(),
	membersOnlyEvents: boolean('members_only_events').default(true).notNull(),
	/** Patron: a bag every month through the subscription engine (7.2). */
	monthlyCoffeeVariantId: int('monthly_coffee_variant_id').references(() => productVariant.id, {
		onDelete: 'restrict'
	}),
	image: file('image'),
	publishStatus: status('publish_status', PUBLISH_STATUSES).notNull().default('draft'),
	sortOrder: smallint('sort_order').default(0).notNull(),
	...secureFields
});

/**
 * One membership term. A renewal is a new row pointing at the one it renews, so the history of
 * terms (and what each cost) stays intact.
 */
export const membership = mysqlTable(
	'membership',
	{
		id: id(),
		number: varchar('number', { length: 20 }).notNull().unique(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		planId: int('plan_id')
			.notNull()
			.references(() => membershipPlan.id, { onDelete: 'restrict' }),
		status: status('status', MEMBERSHIP_STATUSES).notNull().default('pending_payment'),
		startsOn: date('starts_on', { mode: 'string' }),
		endsOn: date('ends_on', { mode: 'string' }),
		graceEndsOn: date('grace_ends_on', { mode: 'string' }),
		renewalMethod: status('renewal_method', RENEWAL_METHODS).notNull().default('manual_link'),
		renewsMembershipId: int('renews_membership_id').references(
			(): AnyMySqlColumn => membership.id,
			{ onDelete: 'set null' }
		),
		orderLineId: int('order_line_id').references((): AnyMySqlColumn => orderLine.id, {
			onDelete: 'restrict'
		}),
		cancelledAt: datetime('cancelled_at'),
		cancelReason: varchar('cancel_reason', { length: 255 }),
		...secureFields
	},
	(table) => [
		index('membership_customer_idx').on(table.customerId),
		index('membership_expiry_idx').on(table.status, table.endsOn)
	]
);

/** The named people a membership covers, each with their own card QR (7.3). */
export const membershipMember = mysqlTable(
	'membership_member',
	{
		id: id(),
		membershipId: int('membership_id')
			.notNull()
			.references(() => membership.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 150 }).notNull(),
		isChild: boolean('is_child').default(false).notNull(),
		birthYear: smallint('birth_year'),
		cardCode: varchar('card_code', { length: 16 }).notNull().unique(),
		photo: file('photo'),
		...secureFields
	},
	(table) => [index('membership_member_membership_idx').on(table.membershipId)]
);

/** The prepaid bundles on offer: 3, 6, 12 deliveries at 5 / 10 / 15% off (7.5). */
export const subscriptionPlan = mysqlTable(
	'subscription_plan',
	{
		id: id(),
		name: localized('name').notNull(),
		deliveries: tinyint('deliveries').notNull(),
		discountPct: percent('discount_pct'),
		sortOrder: smallint('sort_order').default(0).notNull(),
		...secureFields
	},
	(table) => [uniqueIndex('subscription_plan_deliveries_uq').on(table.deliveries)]
);

/**
 * A running subscription: what to send, how often, where, and how many prepaid deliveries are
 * left. The product, roast and grind can change until two days before the roast day (7.5).
 * A Patron's monthly bag is a subscription with `membershipId` set and nothing to pay.
 */
export const subscription = mysqlTable(
	'subscription',
	{
		id: id(),
		number: varchar('number', { length: 20 }).notNull().unique(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		membershipId: int('membership_id').references(() => membership.id, { onDelete: 'set null' }),
		status: status('status', SUBSCRIPTION_STATUSES).notNull().default('pending_payment'),
		frequency: status('frequency', SUBSCRIPTION_FREQUENCIES).notNull(),
		variantId: int('variant_id')
			.notNull()
			.references(() => productVariant.id, { onDelete: 'restrict' }),
		roastLevelId: int('roast_level_id')
			.notNull()
			.references(() => roastLevel.id, { onDelete: 'restrict' }),
		grindId: int('grind_id').references(() => grind.id, { onDelete: 'restrict' }),
		quantity: tinyint('quantity').notNull().default(1),
		addressId: int('address_id').references(() => customerAddress.id, { onDelete: 'restrict' }),
		deliveryZoneId: int('delivery_zone_id').references(() => deliveryZone.id, {
			onDelete: 'restrict'
		}),
		/** Prepaid deliveries bought across all bundles, and how many have been used or skipped. */
		deliveriesPurchased: smallint('deliveries_purchased').default(0).notNull(),
		deliveriesUsed: smallint('deliveries_used').default(0).notNull(),
		nextRoastDate: date('next_roast_date', { mode: 'string' }),
		pausedUntil: date('paused_until', { mode: 'string' }),
		cancelledAt: datetime('cancelled_at'),
		/** refund or store_credit [CONFIRM 7.5]. */
		unusedSettlement: varchar('unused_settlement', { length: 16 }),
		...secureFields
	},
	(table) => [
		index('subscription_customer_idx').on(table.customerId),
		index('subscription_next_idx').on(table.status, table.nextRoastDate)
	]
);

/** Each bundle bought or topped up, with the price paid for it. */
export const subscriptionBundle = mysqlTable(
	'subscription_bundle',
	{
		id: id(),
		subscriptionId: int('subscription_id')
			.notNull()
			.references(() => subscription.id, { onDelete: 'cascade' }),
		planId: int('plan_id').references(() => subscriptionPlan.id, { onDelete: 'restrict' }),
		orderLineId: int('order_line_id').references((): AnyMySqlColumn => orderLine.id, {
			onDelete: 'restrict'
		}),
		deliveries: tinyint('deliveries').notNull(),
		discountPct: percent('discount_pct'),
		pricePerDelivery: money('price_per_delivery'),
		purchasedAt: datetime('purchased_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [index('subscription_bundle_sub_idx').on(table.subscriptionId)]
);

/**
 * One scheduled delivery, tied to a roast day. When its roast day comes it becomes a zero-priced
 * order (so it rides the normal roast queue, packing and delivery) and `orderId` is set.
 */
export const subscriptionDelivery = mysqlTable(
	'subscription_delivery',
	{
		id: id(),
		subscriptionId: int('subscription_id')
			.notNull()
			.references(() => subscription.id, { onDelete: 'cascade' }),
		sequence: smallint('sequence').notNull(),
		roastDate: date('roast_date', { mode: 'string' }).notNull(),
		status: status('status', SUBSCRIPTION_DELIVERY_STATUSES).notNull().default('scheduled'),
		orderId: int('order_id').references((): AnyMySqlColumn => order.id, {
			onDelete: 'set null'
		}),
		skippedAt: datetime('skipped_at'),
		skippedBy: userRef('skipped_by'),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		uniqueIndex('subscription_delivery_seq_uq').on(table.subscriptionId, table.sequence),
		index('subscription_delivery_roast_idx').on(table.roastDate, table.status)
	]
);

export const membershipRelations = relations(membership, ({ one, many }) => ({
	customer: one(customer, { fields: [membership.customerId], references: [customer.id] }),
	plan: one(membershipPlan, { fields: [membership.planId], references: [membershipPlan.id] }),
	members: many(membershipMember)
}));

export const membershipMemberRelations = relations(membershipMember, ({ one }) => ({
	membership: one(membership, {
		fields: [membershipMember.membershipId],
		references: [membership.id]
	})
}));

export const subscriptionRelations = relations(subscription, ({ one, many }) => ({
	customer: one(customer, { fields: [subscription.customerId], references: [customer.id] }),
	variant: one(productVariant, {
		fields: [subscription.variantId],
		references: [productVariant.id]
	}),
	roastLevel: one(roastLevel, { fields: [subscription.roastLevelId], references: [roastLevel.id] }),
	grind: one(grind, { fields: [subscription.grindId], references: [grind.id] }),
	address: one(customerAddress, {
		fields: [subscription.addressId],
		references: [customerAddress.id]
	}),
	bundles: many(subscriptionBundle),
	deliveries: many(subscriptionDelivery)
}));

export const subscriptionBundleRelations = relations(subscriptionBundle, ({ one }) => ({
	subscription: one(subscription, {
		fields: [subscriptionBundle.subscriptionId],
		references: [subscription.id]
	})
}));

export const subscriptionDeliveryRelations = relations(subscriptionDelivery, ({ one }) => ({
	subscription: one(subscription, {
		fields: [subscriptionDelivery.subscriptionId],
		references: [subscription.id]
	}),
	order: one(order, { fields: [subscriptionDelivery.orderId], references: [order.id] })
}));
