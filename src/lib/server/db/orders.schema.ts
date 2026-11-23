/**
 * Orders, payments, refunds and invoices — one commercial spine for everything sold (questionnaire
 * 2.6, 2.7, 3). A cart holding two bags of Limu, three entry tickets, a ceremony and a membership
 * is one order with four kinds of line, one payment, one receipt and one VAT record. Selling
 * something new later (gift cards) is a new line type, not a second checkout.
 *
 * Lines copy the name, price and tax rate at the moment of sale, so editing a product, a price or
 * VAT never changes a past receipt. Orders and payments are kept 10 years (9.4) and never deleted;
 * anonymising a customer leaves them in place.
 */
import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	datetime,
	decimal,
	index,
	int,
	json,
	mysqlTable,
	smallint,
	text,
	uniqueIndex,
	varchar,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import {
	bigId,
	currency,
	extra,
	id,
	localized,
	money,
	percent,
	secureFields,
	status,
	userRef
} from './fields';
import { audience, location, taxRate } from './system.schema';
import { courier, customer, customerAddress, deliveryZone } from './customers.schema';
import { bundle, grind, packaging, productVariant, roastLevel } from './catalog.schema';
import { roastBatch } from './inventory.schema';
import { event, ticketType, visitSlot } from './visits.schema';
import { membership, membershipPlan, subscription, subscriptionPlan } from './memberships.schema';
import { bookable, bookingSession } from './bookings.schema';
import { businessAccount } from './wholesale.schema';
import {
	DELIVERY_METHODS,
	DISCOUNT_KINDS,
	FULFILMENT_MODES,
	INVOICE_STATUSES,
	ORDER_ITEM_TYPES,
	ORDER_STATUSES,
	PAYMENT_PROVIDERS,
	PAYMENT_STATES,
	PAYMENT_STATUSES,
	REFUND_STATUSES,
	SALES_CHANNELS
} from '../../constants';

/** The address an order was delivered to, as it was at checkout. */
export type AddressSnapshot = {
	recipientName?: string;
	phone?: string;
	area?: string;
	city: string;
	woreda?: string;
	line1: string;
	landmark?: string;
	latitude?: number;
	longitude?: number;
};

/**
 * Discount codes (2.7): percent or fixed, minimum order, window, usage limits, and which parts of
 * the shop they apply to. `usedCount` is bumped under a row lock with the order.
 */
export const discountCode = mysqlTable('discount_code', {
	id: id(),
	code: varchar('code', { length: 32 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	kind: status('kind', DISCOUNT_KINDS).notNull(),
	/** Percent (10.00) or an amount in `currency`. */
	value: decimal('value', { precision: 14, scale: 2, mode: 'number' }).notNull(),
	currency: currency(),
	minOrderAmount: money('min_order_amount'),
	maxDiscountAmount: decimal('max_discount_amount', { precision: 14, scale: 2, mode: 'number' }),
	/** The line types it applies to: `['product']`, `['ticket','event_ticket']`; null = all. */
	appliesTo: json('applies_to').$type<string[]>(),
	startsAt: datetime('starts_at'),
	expiresAt: datetime('expires_at'),
	usageLimit: int('usage_limit'),
	perCustomerLimit: smallint('per_customer_limit'),
	usedCount: int('used_count').default(0).notNull(),
	...secureFields
});

/** `orders`, not `order`: ORDER is a reserved word in SQL. */
export const order = mysqlTable(
	'orders',
	{
		id: id(),
		/** KC-26-000123, from `document_sequence`. */
		number: varchar('number', { length: 20 }).notNull().unique(),
		channel: status('channel', SALES_CHANNELS).notNull().default('web'),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		businessAccountId: int('business_account_id').references(() => businessAccount.id, {
			onDelete: 'restrict'
		}),
		/** Where a desk sale happened, or which stock location fulfils it. */
		locationId: int('location_id').references(() => location.id, { onDelete: 'restrict' }),
		status: status('status', ORDER_STATUSES).notNull().default('pending_payment'),
		paymentState: status('payment_state', PAYMENT_STATES).notNull().default('unpaid'),
		/** The language receipts, e-tickets and messages go out in (1.1). */
		locale: varchar('locale', { length: 8 }).notNull().default('am'),

		// Who it is for, as given at checkout.
		contactName: varchar('contact_name', { length: 150 }),
		contactPhone: varchar('contact_phone', { length: 20 }),
		contactEmail: varchar('contact_email', { length: 255 }),
		customerTin: varchar('customer_tin', { length: 20 }),
		customerBusinessName: varchar('customer_business_name', { length: 150 }),
		/** The "I will show a valid Ethiopian ID" box (6.2). */
		residencyDeclared: boolean('residency_declared').default(false).notNull(),

		// How it gets there (3.5–3.7).
		deliveryMethod: status('delivery_method', DELIVERY_METHODS).notNull().default('none'),
		deliveryZoneId: int('delivery_zone_id').references(() => deliveryZone.id, {
			onDelete: 'restrict'
		}),
		addressId: int('address_id').references(() => customerAddress.id, { onDelete: 'set null' }),
		deliveryAddress: json('delivery_address').$type<AddressSnapshot>(),
		pickupLocationId: int('pickup_location_id').references(() => location.id, {
			onDelete: 'restrict'
		}),
		/** Shown at pickup as a QR (3.7). */
		pickupCode: varchar('pickup_code', { length: 16 }).unique(),
		riderId: userRef('rider_id'),
		courierId: int('courier_id').references(() => courier.id, { onDelete: 'restrict' }),
		trackingNumber: varchar('tracking_number', { length: 64 }),
		/** From the roast calendar and dispatch days (2.4). */
		expectedDispatchOn: date('expected_dispatch_on', { mode: 'string' }),

		// Money. All tax-inclusive (2.6); `taxTotal` is the VAT inside `total`.
		currency: currency(),
		subtotal: money('subtotal'),
		discountTotal: money('discount_total'),
		deliveryFee: money('delivery_fee'),
		taxTotal: money('tax_total'),
		total: money('total'),
		amountPaid: money('amount_paid'),
		amountRefunded: money('amount_refunded'),
		discountCodeId: int('discount_code_id').references(() => discountCode.id, {
			onDelete: 'restrict'
		}),
		/** The membership whose discount / free delivery was applied (7.2; never stacked with a code). */
		membershipId: int('membership_id').references((): AnyMySqlColumn => membership.id, {
			onDelete: 'set null'
		}),

		/** Sequential VAT receipt number, given when paid (2.6). */
		receiptNumber: varchar('receipt_number', { length: 24 }).unique(),
		/** One-click payment link for renewals, top-ups and invoices (7.4, 7.5). */
		payToken: varchar('pay_token', { length: 64 }).unique(),
		payTokenExpiresAt: datetime('pay_token_expires_at'),
		/** Sent by the client with a checkout, so a double-submitted cart makes one order. */
		idempotencyKey: varchar('idempotency_key', { length: 64 }).unique(),

		customerNote: varchar('customer_note', { length: 500 }),
		staffNote: varchar('staff_note', { length: 500 }),
		placedAt: datetime('placed_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		paidAt: datetime('paid_at'),
		dispatchedAt: datetime('dispatched_at'),
		completedAt: datetime('completed_at'),
		cancelledAt: datetime('cancelled_at'),
		cancelReason: varchar('cancel_reason', { length: 255 }),
		ipAddress: varchar('ip_address', { length: 45 }),
		extra: extra(),
		...secureFields
	},
	(table) => [
		index('order_customer_idx').on(table.customerId, table.placedAt),
		index('order_status_idx').on(table.status, table.placedAt),
		index('order_paid_idx').on(table.paidAt),
		index('order_dispatch_idx').on(table.expectedDispatchOn, table.status),
		index('order_business_idx').on(table.businessAccountId)
	]
);

/**
 * One thing sold. `itemType` says which of the nullable references is set; `description` holds the
 * name in every language as it was sold, so receipts never depend on today's catalogue.
 */
export const orderLine = mysqlTable(
	'order_line',
	{
		id: id(),
		orderId: int('order_id')
			.notNull()
			.references(() => order.id, { onDelete: 'cascade' }),
		itemType: status('item_type', ORDER_ITEM_TYPES).notNull(),
		description: localized('description').notNull(),
		sku: varchar('sku', { length: 40 }),

		// Coffee and merchandise.
		variantId: int('variant_id').references(() => productVariant.id, { onDelete: 'restrict' }),
		roastLevelId: int('roast_level_id').references(() => roastLevel.id, { onDelete: 'restrict' }),
		grindId: int('grind_id').references(() => grind.id, { onDelete: 'restrict' }),
		packagingId: int('packaging_id').references(() => packaging.id, { onDelete: 'restrict' }),
		fulfilment: status('fulfilment', FULFILMENT_MODES),
		/** Set when a roast-to-order line is roasted: the batch's "linked orders" (4.7). */
		roastBatchId: int('roast_batch_id').references((): AnyMySqlColumn => roastBatch.id, {
			onDelete: 'restrict'
		}),
		/** The roast day it is queued for. */
		roastOn: date('roast_on', { mode: 'string' }),
		/**
		 * The bundle this bag was bought in. Its lines share a `bundleGroup` (1, 2… within the
		 * order), so two 2 kg bundles in one cart read as two; the saving sits in `discountAmount`.
		 */
		bundleId: int('bundle_id').references(() => bundle.id, { onDelete: 'restrict' }),
		bundleGroup: smallint('bundle_group'),

		// Visits, events, bookings, memberships, subscriptions.
		ticketTypeId: int('ticket_type_id').references((): AnyMySqlColumn => ticketType.id, {
			onDelete: 'restrict'
		}),
		audienceId: int('audience_id').references(() => audience.id, { onDelete: 'restrict' }),
		visitSlotId: int('visit_slot_id').references((): AnyMySqlColumn => visitSlot.id, {
			onDelete: 'restrict'
		}),
		eventId: int('event_id').references((): AnyMySqlColumn => event.id, { onDelete: 'restrict' }),
		bookableId: int('bookable_id').references((): AnyMySqlColumn => bookable.id, {
			onDelete: 'restrict'
		}),
		bookingSessionId: int('booking_session_id').references(
			(): AnyMySqlColumn => bookingSession.id,
			{ onDelete: 'restrict' }
		),
		membershipPlanId: int('membership_plan_id').references(
			(): AnyMySqlColumn => membershipPlan.id,
			{ onDelete: 'restrict' }
		),
		subscriptionPlanId: int('subscription_plan_id').references(
			(): AnyMySqlColumn => subscriptionPlan.id,
			{ onDelete: 'restrict' }
		),
		subscriptionId: int('subscription_id').references((): AnyMySqlColumn => subscription.id, {
			onDelete: 'set null'
		}),

		quantity: smallint('quantity').notNull().default(1),
		unitPrice: money('unit_price'),
		discountAmount: money('discount_amount'),
		taxRateId: int('tax_rate_id').references(() => taxRate.id, { onDelete: 'restrict' }),
		taxRate: percent('tax_rate'),
		taxAmount: money('tax_amount'),
		lineTotal: money('line_total'),
		refundedQuantity: smallint('refunded_quantity').default(0).notNull(),
		refundedAmount: money('refunded_amount'),
		/** Anything line-specific with no column yet (a gift message). */
		extra: extra()
	},
	(table) => [
		index('order_line_order_idx').on(table.orderId),
		index('order_line_variant_idx').on(table.variantId),
		index('order_line_roast_queue_idx').on(table.roastOn, table.roastBatchId),
		index('order_line_slot_idx').on(table.visitSlotId),
		index('order_line_bundle_idx').on(table.bundleId),
		check('order_line_qty_chk', sql`${table.quantity} > 0`),
		check('order_line_refund_chk', sql`${table.refundedQuantity} <= ${table.quantity}`)
	]
);

/** Every status change, who made it, and whether the customer was told (3.3). */
export const orderStatusHistory = mysqlTable(
	'order_status_history',
	{
		id: bigId(),
		orderId: int('order_id')
			.notNull()
			.references(() => order.id, { onDelete: 'cascade' }),
		fromStatus: status('from_status', ORDER_STATUSES),
		toStatus: status('to_status', ORDER_STATUSES).notNull(),
		note: varchar('note', { length: 255 }),
		changedBy: userRef('changed_by'),
		notified: boolean('notified').default(false).notNull(),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [index('order_status_history_order_idx').on(table.orderId)]
);

/**
 * Invoices for group bookings, school visits, private hire and wholesale (3.8, 6.6, 11.5).
 * Reminders at −7 / 0 / +7 days are `notification` rows deduplicated by invoice and day.
 */
export const invoice = mysqlTable(
	'invoice',
	{
		id: id(),
		number: varchar('number', { length: 24 }).notNull().unique(),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		businessAccountId: int('business_account_id').references(() => businessAccount.id, {
			onDelete: 'restrict'
		}),
		orderId: int('order_id').references(() => order.id, { onDelete: 'restrict' }),
		status: status('status', INVOICE_STATUSES).notNull().default('draft'),
		billingName: varchar('billing_name', { length: 150 }).notNull(),
		billingTin: varchar('billing_tin', { length: 20 }),
		billingAddress: varchar('billing_address', { length: 255 }),
		currency: currency(),
		subtotal: money('subtotal'),
		taxTotal: money('tax_total'),
		total: money('total'),
		amountPaid: money('amount_paid'),
		issuedAt: datetime('issued_at'),
		dueOn: date('due_on', { mode: 'string' }),
		paidAt: datetime('paid_at'),
		notes: text('notes'),
		...secureFields
	},
	(table) => [
		index('invoice_status_idx').on(table.status, table.dueOn),
		index('invoice_business_idx').on(table.businessAccountId)
	]
);

/**
 * A payment attempt or a recorded payment. `txRef` is ours and unique, sent to the gateway, so a
 * retried webhook or a double click settles one row. Desk cash and bank transfers are rows here
 * too, recorded by staff, so the daily sales report has one source.
 */
export const payment = mysqlTable(
	'payment',
	{
		id: id(),
		orderId: int('order_id').references(() => order.id, { onDelete: 'restrict' }),
		invoiceId: int('invoice_id').references(() => invoice.id, { onDelete: 'restrict' }),
		provider: status('provider', PAYMENT_PROVIDERS).notNull(),
		/** The wallet or card behind the gateway: telebirr via Chapa, visa… */
		method: varchar('method', { length: 32 }),
		status: status('status', PAYMENT_STATUSES).notNull().default('initiated'),
		amount: money('amount'),
		currency: currency(),
		/** Gateway fee, when the gateway reports one — refunds may deduct it (6.5). */
		fee: money('fee'),
		txRef: varchar('tx_ref', { length: 64 }).notNull().unique(),
		providerRef: varchar('provider_ref', { length: 128 }),
		checkoutUrl: varchar('checkout_url', { length: 500 }),
		failureReason: varchar('failure_reason', { length: 255 }),
		/** The gateway's verify response, for disputes. */
		response: json('response'),
		/** Bank transfer reference / desk receipt for manual payments. */
		reference: varchar('reference', { length: 64 }),
		recordedBy: userRef('recorded_by'),
		paidAt: datetime('paid_at'),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		updatedAt: datetime('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
			.$onUpdate(() => new Date())
	},
	(table) => [
		index('payment_order_idx').on(table.orderId),
		index('payment_invoice_idx').on(table.invoiceId),
		index('payment_status_idx').on(table.status, table.createdAt),
		uniqueIndex('payment_provider_ref_uq').on(table.provider, table.providerRef)
	]
);

/**
 * A refund, through the method it was paid with (3.4). Only Manager or Owner may approve one;
 * `isAutomatic` marks the full refunds of a museum-side cancellation (6.5).
 */
export const refund = mysqlTable(
	'refund',
	{
		id: id(),
		orderId: int('order_id')
			.notNull()
			.references(() => order.id, { onDelete: 'restrict' }),
		paymentId: int('payment_id').references(() => payment.id, { onDelete: 'restrict' }),
		status: status('status', REFUND_STATUSES).notNull().default('requested'),
		amount: money('amount'),
		currency: currency(),
		/** Processing fee kept (6.5). */
		feeRetained: money('fee_retained'),
		/** Back to the card / wallet, or as store credit. */
		toStoreCredit: boolean('to_store_credit').default(false).notNull(),
		reason: varchar('reason', { length: 255 }).notNull(),
		isAutomatic: boolean('is_automatic').default(false).notNull(),
		providerRef: varchar('provider_ref', { length: 128 }),
		requestedBy: userRef('requested_by'),
		approvedBy: userRef('approved_by'),
		processedAt: datetime('processed_at'),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [index('refund_order_idx').on(table.orderId)]
);

/** Which lines a partial refund covers. */
export const refundLine = mysqlTable(
	'refund_line',
	{
		id: id(),
		refundId: int('refund_id')
			.notNull()
			.references(() => refund.id, { onDelete: 'cascade' }),
		orderLineId: int('order_line_id')
			.notNull()
			.references(() => orderLine.id, { onDelete: 'restrict' }),
		quantity: smallint('quantity').notNull(),
		amount: money('amount'),
		/** Put the bags back on the shelf. */
		restock: boolean('restock').default(false).notNull()
	},
	(table) => [index('refund_line_refund_idx').on(table.refundId)]
);

/** Each code used, for the usage report (5.2) and per-customer limits. */
export const discountRedemption = mysqlTable(
	'discount_redemption',
	{
		id: id(),
		discountCodeId: int('discount_code_id')
			.notNull()
			.references(() => discountCode.id, { onDelete: 'restrict' }),
		orderId: int('order_id')
			.notNull()
			.references(() => order.id, { onDelete: 'cascade' }),
		customerId: int('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		amount: money('amount'),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		uniqueIndex('discount_redemption_uq').on(table.discountCodeId, table.orderId),
		index('discount_redemption_customer_idx').on(table.discountCodeId, table.customerId)
	]
);

export const orderRelations = relations(order, ({ one, many }) => ({
	customer: one(customer, { fields: [order.customerId], references: [customer.id] }),
	businessAccount: one(businessAccount, {
		fields: [order.businessAccountId],
		references: [businessAccount.id]
	}),
	deliveryZone: one(deliveryZone, {
		fields: [order.deliveryZoneId],
		references: [deliveryZone.id]
	}),
	courier: one(courier, { fields: [order.courierId], references: [courier.id] }),
	discountCode: one(discountCode, {
		fields: [order.discountCodeId],
		references: [discountCode.id]
	}),
	lines: many(orderLine),
	history: many(orderStatusHistory),
	payments: many(payment),
	refunds: many(refund)
}));

export const orderLineRelations = relations(orderLine, ({ one }) => ({
	order: one(order, { fields: [orderLine.orderId], references: [order.id] }),
	variant: one(productVariant, { fields: [orderLine.variantId], references: [productVariant.id] }),
	roastLevel: one(roastLevel, { fields: [orderLine.roastLevelId], references: [roastLevel.id] }),
	grind: one(grind, { fields: [orderLine.grindId], references: [grind.id] }),
	bundle: one(bundle, { fields: [orderLine.bundleId], references: [bundle.id] }),
	roastBatch: one(roastBatch, { fields: [orderLine.roastBatchId], references: [roastBatch.id] }),
	ticketType: one(ticketType, { fields: [orderLine.ticketTypeId], references: [ticketType.id] }),
	visitSlot: one(visitSlot, { fields: [orderLine.visitSlotId], references: [visitSlot.id] }),
	event: one(event, { fields: [orderLine.eventId], references: [event.id] })
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
	order: one(order, { fields: [orderStatusHistory.orderId], references: [order.id] })
}));

export const invoiceRelations = relations(invoice, ({ one, many }) => ({
	customer: one(customer, { fields: [invoice.customerId], references: [customer.id] }),
	order: one(order, { fields: [invoice.orderId], references: [order.id] }),
	payments: many(payment)
}));

export const paymentRelations = relations(payment, ({ one }) => ({
	order: one(order, { fields: [payment.orderId], references: [order.id] }),
	invoice: one(invoice, { fields: [payment.invoiceId], references: [invoice.id] })
}));

export const refundRelations = relations(refund, ({ one, many }) => ({
	order: one(order, { fields: [refund.orderId], references: [order.id] }),
	payment: one(payment, { fields: [refund.paymentId], references: [payment.id] }),
	lines: many(refundLine)
}));

export const refundLineRelations = relations(refundLine, ({ one }) => ({
	refund: one(refund, { fields: [refundLine.refundId], references: [refund.id] }),
	orderLine: one(orderLine, { fields: [refundLine.orderLineId], references: [orderLine.id] })
}));
