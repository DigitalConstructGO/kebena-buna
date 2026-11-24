/** The Sales forms: order status and delivery, payments, refunds, invoices, discount codes. */
import { z } from 'zod/v4';
import { DISCOUNT_KINDS, ORDER_ITEM_TYPES, ORDER_STATUSES } from '#lib/constants.ts';
import {
	bool,
	boolTrue,
	isoDate,
	moneyField,
	optionalDate,
	optionalId,
	optionalInt,
	optionalMoney,
	optionalText,
	optionalUserId,
	requiredId,
	requiredText,
	sortOrder
} from '#lib/schemas/common.ts';

/** Providers staff record by hand; gateway payments arrive by webhook. */
export const MANUAL_PROVIDERS = [
	'desk_cash',
	'desk_card',
	'bank_transfer',
	'telebirr',
	'cbe_birr',
	'store_credit'
] as const;

export const orderStatusSchema = z.object({
	status: z.enum(ORDER_STATUSES),
	note: optionalText(255),
	notified: bool
});

export const orderDeliverySchema = z.object({
	riderId: optionalUserId,
	courierId: optionalId,
	trackingNumber: optionalText(64),
	expectedDispatchOn: optionalDate,
	staffNote: optionalText(500)
});

export const cancelSchema = z.object({ reason: requiredText(255, 'Say why it is cancelled') });

/** The channels staff take orders on; the website's are its own. */
export const STAFF_CHANNELS = ['desk', 'admin', 'telegram', 'wholesale'] as const;

const staffLineSchema = z.object({
	variantId: requiredId('Choose what is sold'),
	roastLevelId: optionalId,
	grindId: optionalId,
	quantity: z.coerce.number().int().min(1, 'At least one').max(999)
});

/**
 * An order staff take at the desk, on the phone or for a wholesale account. It is priced on the
 * server: retail prices, less the account's tier and discount for wholesale.
 */
export const staffOrderSchema = z
	.object({
		channel: z.enum(STAFF_CHANNELS),
		customerId: optionalId,
		businessAccountId: optionalId,
		locationId: optionalId,
		deliveryMethod: z.enum(['none', 'pickup', 'rider', 'courier']).default('none'),
		deliveryZoneId: optionalId,
		addressLine: optionalText(255),
		addressCity: optionalText(64),
		deliveryFee: optionalMoney,
		customerNote: optionalText(500),
		staffNote: optionalText(500),
		/** Paid in full now, by this means; empty leaves it to be paid (the buyer gets a pay link). */
		payNow: z.preprocess(
			(v) => (v === '' ? null : v),
			z.enum(MANUAL_PROVIDERS).nullable().optional()
		),
		payReference: optionalText(64),
		/** Wholesale on approved credit: sent now, billed on an invoice due after the account's terms. */
		onCredit: bool,
		lines: z.array(staffLineSchema).min(1, 'Add what is sold')
	})
	.superRefine((d, ctx) => {
		if (d.channel === 'wholesale' ? !d.businessAccountId : !d.customerId)
			ctx.addIssue({
				code: 'custom',
				path: [d.channel === 'wholesale' ? 'businessAccountId' : 'customerId'],
				message: 'Choose who it is for'
			});
		if ((d.deliveryMethod === 'rider' || d.deliveryMethod === 'courier') && !d.addressLine)
			ctx.addIssue({ code: 'custom', path: ['addressLine'], message: 'Where it goes' });
		if (d.onCredit && d.payNow)
			ctx.addIssue({ code: 'custom', path: ['payNow'], message: 'On credit it is paid later' });
	});

/** A buyer's transfer receipt staff checked against the statement. */
export const receiptSchema = z.object({ paymentId: requiredId('Which receipt?') });
export const rejectReceiptSchema = receiptSchema.extend({
	reason: requiredText(255, 'Say why, so the buyer can put it right')
});

/** An account buyers can pay into by transfer, listed on their order's page. */
export const bankAccountSchema = z.object({
	bankName: requiredText(80),
	accountName: requiredText(120),
	accountNumber: requiredText(40),
	note: optionalText(255),
	sortOrder,
	status: boolTrue
});
export const bankAccountEditSchema = bankAccountSchema.extend({ id: z.coerce.number() });

export const paymentSchema = z.object({
	provider: z.enum(MANUAL_PROVIDERS),
	amount: z.coerce.number().positive('Enter the amount received'),
	reference: optionalText(64),
	paidOn: isoDate
});

/** One line, or everything not yet refunded (`whole`). */
export const refundRequestSchema = z.object({
	whole: bool,
	orderLineId: optionalId,
	quantity: optionalInt,
	restock: bool,
	toStoreCredit: bool,
	feeRetained: moneyField,
	reason: requiredText(255, 'Say why it is refunded')
});

export const refundDecisionSchema = z.object({ note: optionalText(255) });

export const invoiceEditSchema = z.object({
	billingName: requiredText(150),
	billingTin: optionalText(20),
	billingAddress: optionalText(255),
	dueOn: optionalDate,
	notes: optionalText(2000)
});

/** A limit that may be left empty (no limit), but is at least 1 when given. */
const optionalLimit = z.preprocess(
	(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
	z.coerce.number().int().min(1, 'At least 1, or leave empty for no limit').nullable().optional()
);

const discountFields = z.object({
	code: z
		.string()
		.trim()
		.min(3, 'At least 3 characters')
		.max(32)
		.regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, - and _ only')
		.transform((v) => v.toUpperCase()),
	description: optionalText(255),
	kind: z.enum(DISCOUNT_KINDS),
	value: z.coerce.number().positive('Enter the discount'),
	minOrderAmount: moneyField,
	maxDiscountAmount: optionalMoney,
	appliesTo: z.array(z.enum(ORDER_ITEM_TYPES)).default([]),
	startsOn: optionalDate,
	expiresOn: optionalDate,
	usageLimit: optionalLimit,
	perCustomerLimit: optionalLimit,
	isActive: boolTrue
});

/** The rules across fields: a percentage of at most 100, and an expiry on or after the start. */
const discountRules = (
	v: {
		kind: string;
		value: number;
		startsOn?: string | null;
		expiresOn?: string | null;
		usageLimit?: number | null;
		perCustomerLimit?: number | null;
	},
	ctx: z.RefinementCtx
) => {
	if (v.kind === 'percent' && v.value > 100) {
		ctx.addIssue({ code: 'custom', path: ['value'], message: 'A percentage is at most 100' });
	}
	if (v.startsOn && v.expiresOn && v.expiresOn < v.startsOn) {
		ctx.addIssue({ code: 'custom', path: ['expiresOn'], message: 'On or after the start date' });
	}
	if (v.usageLimit && v.perCustomerLimit && v.perCustomerLimit > v.usageLimit) {
		ctx.addIssue({
			code: 'custom',
			path: ['perCustomerLimit'],
			message: 'No more than the total limit'
		});
	}
};

export const discountSchema = discountFields.superRefine(discountRules);
export const discountEditSchema = discountFields
	.extend({ id: requiredId() })
	.superRefine(discountRules);
