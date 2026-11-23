/**
 * The fixed vocabularies the database speaks: statuses, kinds and channels.
 *
 * Stored as `varchar` columns typed by these lists, never as MySQL `ENUM`s, so adding a value is a
 * one-line change here with no migration. Lists the *business* edits (bag sizes, ticket types,
 * delivery zones, plans) are tables, not entries here.
 *
 * Shared by server and client, so labels and filters read the same lists the columns are typed by.
 */

export const USER_KINDS = ['customer', 'staff'] as const;
export type UserKind = (typeof USER_KINDS)[number];

/* ── Places ─────────────────────────────────────────────────────────────────────────────────── */

export const LOCATION_TYPES = ['site', 'shop', 'cafe', 'roastery', 'warehouse', 'office'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const STATION_TYPES = ['washing_station', 'dry_mill', 'farm'] as const;
export type StationType = (typeof STATION_TYPES)[number];

/* ── Coffee ─────────────────────────────────────────────────────────────────────────────────── */

export const PROCESSING_METHODS = ['washed', 'natural', 'honey', 'anaerobic'] as const;
export type ProcessingMethod = (typeof PROCESSING_METHODS)[number];

export const PRODUCT_KINDS = ['coffee', 'bundle', 'merchandise'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const FULFILMENT_MODES = ['from_stock', 'roast_to_order'] as const;
export type FulfilmentMode = (typeof FULFILMENT_MODES)[number];

export const PUBLISH_STATUSES = ['draft', 'published', 'archived'] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

/**
 * How a bundle is priced against the bags in it: a percentage off their total, an amount off it,
 * or one price for the lot. Never more than the bags would cost on their own.
 */
export const BUNDLE_PRICINGS = ['percent_off', 'amount_off', 'fixed_price'] as const;
export type BundlePricing = (typeof BUNDLE_PRICINGS)[number];

/* ── Stock ──────────────────────────────────────────────────────────────────────────────────── */

/** Green (kg per lot) → roasted (kg per batch) → packed (bags per variant and roast). */
export const STOCK_STAGES = ['green', 'roasted', 'packed'] as const;
export type StockStage = (typeof STOCK_STAGES)[number];

export const STOCK_REASONS = [
	'receipt',
	'opening_count',
	'roast_input',
	'roast_output',
	'pack_input',
	'pack_output',
	'sale',
	'sale_return',
	'internal_use',
	'transfer_out',
	'transfer_in',
	'adjustment',
	'waste'
] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

/* ── Orders and money ───────────────────────────────────────────────────────────────────────── */

export const SALES_CHANNELS = ['web', 'desk', 'telegram', 'wholesale', 'admin', 'system'] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

/** The fulfilment path (questionnaire 3.2). Payment state is its own column. */
export const ORDER_STATUSES = [
	'pending_payment',
	'paid',
	'roasting',
	'packed',
	'out_for_delivery',
	'delivered',
	'ready_for_pickup',
	'collected',
	'completed',
	'cancelled'
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATES = [
	'unpaid',
	'paid',
	'partially_refunded',
	'refunded',
	'failed'
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

/** What an order line sells. A new kind of sale (gift cards) is a new value and FK, not a new checkout. */
export const ORDER_ITEM_TYPES = [
	'product',
	'ticket',
	'event_ticket',
	'membership',
	'subscription_bundle',
	'booking',
	'ticket_upgrade',
	'custom'
] as const;
export type OrderItemType = (typeof ORDER_ITEM_TYPES)[number];

export const DELIVERY_METHODS = ['rider', 'courier', 'pickup', 'none'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const PAYMENT_PROVIDERS = [
	'chapa',
	'telebirr',
	'cbe_birr',
	'bank_transfer',
	'desk_cash',
	'desk_card',
	'store_credit'
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = [
	'initiated',
	'pending',
	'succeeded',
	'failed',
	'cancelled',
	'expired'
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REFUND_STATUSES = [
	'requested',
	'approved',
	'processing',
	'succeeded',
	'failed'
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const INVOICE_STATUSES = ['draft', 'open', 'paid', 'overdue', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const DISCOUNT_KINDS = ['percent', 'fixed'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

/* ── Visits ─────────────────────────────────────────────────────────────────────────────────── */

export const TICKET_STATUSES = ['valid', 'used', 'cancelled', 'refunded', 'expired'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CHANGE_KINDS = [
	'reschedule',
	'upgrade',
	'refund',
	'cancel',
	'reissue'
] as const;
export type TicketChangeKind = (typeof TICKET_CHANGE_KINDS)[number];

export const SCAN_RESULTS = [
	'admitted',
	're_entry',
	'wrong_date',
	'cancelled',
	'unknown',
	'over_headcount',
	'duplicate_offline'
] as const;
export type ScanResult = (typeof SCAN_RESULTS)[number];

export const EVENT_VISIBILITIES = ['public', 'members_only', 'private'] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

/* ── Memberships and subscriptions ──────────────────────────────────────────────────────────── */

export const MEMBERSHIP_STATUSES = [
	'pending_payment',
	'active',
	'grace',
	'lapsed',
	'cancelled'
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** `manual_link` at launch; `auto_charge` once a gateway supports stored payment methods. */
export const RENEWAL_METHODS = ['manual_link', 'auto_charge'] as const;
export type RenewalMethod = (typeof RENEWAL_METHODS)[number];

export const SUBSCRIPTION_FREQUENCIES = ['biweekly', 'monthly'] as const;
export type SubscriptionFrequency = (typeof SUBSCRIPTION_FREQUENCIES)[number];

export const SUBSCRIPTION_STATUSES = [
	'pending_payment',
	'active',
	'paused',
	'completed',
	'cancelled'
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_DELIVERY_STATUSES = [
	'scheduled',
	'skipped',
	'ordered',
	'delivered',
	'cancelled'
] as const;
export type SubscriptionDeliveryStatus = (typeof SUBSCRIPTION_DELIVERY_STATUSES)[number];

/* ── Bookings and forms ─────────────────────────────────────────────────────────────────────── */

export const BOOKABLE_KINDS = [
	'guided_tour',
	'ceremony',
	'cupping',
	'private_event',
	'school_visit',
	'group_visit'
] as const;
export type BookableKind = (typeof BOOKABLE_KINDS)[number];

export const BOOKING_PRICING = [
	'per_person',
	'per_booking',
	'ticket_plus',
	'quote',
	'free'
] as const;
export type BookingPricing = (typeof BOOKING_PRICING)[number];

/** The shared-inbox workflow (questionnaire 8.5), used by bookings and form submissions alike. */
export const WORKFLOW_STATUSES = [
	'new',
	'in_progress',
	'confirmed',
	'done',
	'cancelled',
	'declined'
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const FORM_TYPES = [
	'booking',
	'group_booking',
	'private_event',
	'event_registration',
	'feedback',
	'enquiry',
	'green_coffee_quote',
	'wholesale_application'
] as const;
export type FormType = (typeof FORM_TYPES)[number];

/* ── Customers and messages ─────────────────────────────────────────────────────────────────── */

export const CONTACT_CHANNELS = ['email', 'sms', 'telegram', 'whatsapp'] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['queued', 'sending', 'sent', 'failed', 'skipped'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const CREDIT_REASONS = [
	'subscription_cancel',
	'refund',
	'goodwill',
	'redeemed',
	'expired'
] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

/* ── Wholesale ──────────────────────────────────────────────────────────────────────────────── */

export const BUSINESS_TYPES = [
	'cafe',
	'hotel',
	'restaurant',
	'office',
	'retailer',
	'exporter',
	'other'
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/* ── Content ────────────────────────────────────────────────────────────────────────────────── */

export const HOTSPOT_KINDS = [
	'info',
	'product',
	'lot',
	'origin_map',
	'booking',
	'scene',
	'link'
] as const;
export type HotspotKind = (typeof HOTSPOT_KINDS)[number];

export const AI_CHANNELS = ['web', 'telegram'] as const;
export type AiChannel = (typeof AI_CHANNELS)[number];
