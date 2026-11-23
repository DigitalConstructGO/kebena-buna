/** The catalogue's forms. Client-safe, so each dialog validates with the schema its action uses. */
import { z } from 'zod/v4';
import { BUNDLE_PRICINGS, FULFILMENT_MODES, PRODUCT_KINDS, PUBLISH_STATUSES } from '#lib/constants.ts';
import {
	amText,
	bool,
	boolTrue,
	code,
	enText,
	moneyField,
	optionalDate,
	optionalId,
	optionalInt,
	optionalKg,
	optionalText,
	requiredId,
	slug,
	sortOrder
} from '#lib/schemas/common.ts';

export const bagSizeSchema = z.object({
	code: code(16),
	nameEn: enText(60),
	nameAm: amText(60),
	nameOm: amText(60),
	nameAr: amText(60),
	nameIt: amText(60),
	nameFr: amText(60),
	grams: z.coerce.number().int().positive('Grams in the bag'),
	sortOrder,
	status: boolTrue
});
export const bagSizeEditSchema = bagSizeSchema.extend({ id: z.coerce.number() });

// ── Option lists ────────────────────────────────────────────────────────────────────────────

export const categorySchema = z.object({
	slug,
	nameEn: enText(80),
	nameAm: amText(80),
	nameOm: amText(80),
	nameAr: amText(80),
	nameIt: amText(80),
	nameFr: amText(80),
	descriptionEn: optionalText(500),
	descriptionAm: optionalText(500),
	descriptionOm: optionalText(500),
	descriptionAr: optionalText(500),
	descriptionIt: optionalText(500),
	descriptionFr: optionalText(500),
	sortOrder,
	status: boolTrue
});
export const categoryEditSchema = categorySchema.extend({ id: z.coerce.number() });

export const roastLevelSchema = z.object({
	code: code(16),
	nameEn: enText(60),
	nameAm: amText(60),
	nameOm: amText(60),
	nameAr: amText(60),
	nameIt: amText(60),
	nameFr: amText(60),
	descriptionEn: optionalText(500),
	descriptionAm: optionalText(500),
	descriptionOm: optionalText(500),
	descriptionAr: optionalText(500),
	descriptionIt: optionalText(500),
	descriptionFr: optionalText(500),
	sortOrder,
	status: boolTrue
});
export const roastLevelEditSchema = roastLevelSchema.extend({ id: z.coerce.number() });

export const grindSchema = z.object({
	code: code(16),
	nameEn: enText(60),
	nameAm: amText(60),
	nameOm: amText(60),
	nameAr: amText(60),
	nameIt: amText(60),
	nameFr: amText(60),
	sortOrder,
	status: boolTrue
});
export const grindEditSchema = grindSchema.extend({ id: z.coerce.number() });

export const packagingSchema = z.object({
	code: code(16),
	nameEn: enText(60),
	nameAm: amText(60),
	nameOm: amText(60),
	nameAr: amText(60),
	nameIt: amText(60),
	nameFr: amText(60),
	surcharge: moneyField,
	sortOrder,
	status: boolTrue
});
export const packagingEditSchema = packagingSchema.extend({ id: z.coerce.number() });

// ── Products ────────────────────────────────────────────────────────────────────────────────

/** The product's own fields (not its description, options, origins or pictures). */
export const productSchema = z.object({
	slug,
	kind: z.enum(PRODUCT_KINDS),
	categoryId: optionalId,
	nameEn: enText(150),
	nameAm: amText(150),
	nameOm: amText(150),
	nameAr: amText(150),
	nameIt: amText(150),
	nameFr: amText(150),
	summaryEn: optionalText(500),
	summaryAm: optionalText(500),
	summaryOm: optionalText(500),
	summaryAr: optionalText(500),
	summaryIt: optionalText(500),
	summaryFr: optionalText(500),
	tastingNotesEn: optionalText(500),
	tastingNotesAm: optionalText(500),
	tastingNotesOm: optionalText(500),
	tastingNotesAr: optionalText(500),
	tastingNotesIt: optionalText(500),
	tastingNotesFr: optionalText(500),
	originStoryEn: optionalText(5000),
	originStoryAm: optionalText(5000),
	originStoryOm: optionalText(5000),
	originStoryAr: optionalText(5000),
	originStoryIt: optionalText(5000),
	originStoryFr: optionalText(5000),
	fulfilment: z.enum(FULFILMENT_MODES),
	dispatchDays: z.coerce.number().int().min(0).max(60).default(1),
	taxRateId: optionalId,
	lowStockRoastedKg: optionalKg,
	isMemberOnly: bool,
	isSubscribable: boolTrue,
	isWholesale: bool,
	publishStatus: z.enum(PUBLISH_STATUSES),
	sortOrder,
	seoTitleEn: optionalText(150),
	seoTitleAm: optionalText(150),
	seoTitleOm: optionalText(150),
	seoTitleAr: optionalText(150),
	seoTitleIt: optionalText(150),
	seoTitleFr: optionalText(150),
	seoDescriptionEn: optionalText(300),
	seoDescriptionAm: optionalText(300),
	seoDescriptionOm: optionalText(300),
	seoDescriptionAr: optionalText(300),
	seoDescriptionIt: optionalText(300),
	seoDescriptionFr: optionalText(300)
});
export const productEditSchema = productSchema.extend({ id: z.coerce.number(), isActive: boolTrue });

/** The description, as HTML from the rich editor — sanitised on the server. */
export const productDescriptionSchema = z.object({
	descriptionEn: z.string().max(60000).default(''),
	descriptionAm: z.string().max(60000).default(''),
	descriptionOm: z.string().max(60000).default(''),
	descriptionAr: z.string().max(60000).default(''),
	descriptionIt: z.string().max(60000).default(''),
	descriptionFr: z.string().max(60000).default('')
});

/** Which roasts, grinds and packagings may be chosen, and which is preselected. */
export const productOptionsSchema = z.object({
	roastLevelIds: z.array(z.coerce.number().int()).default([]),
	defaultRoastLevelId: optionalId,
	grindIds: z.array(z.coerce.number().int()).default([]),
	defaultGrindId: optionalId,
	packagingIds: z.array(z.coerce.number().int()).default([]),
	defaultPackagingId: optionalId
});

export const productImageSchema = z.object({ image: z.file().optional() });
export const productPhotosSchema = z.object({ photos: z.array(z.file()).default([]) });

export const productOriginSchema = z
	.object({
		stationId: optionalId,
		lotId: optionalId,
		sharePercent: optionalInt,
		sortOrder
	})
	.refine((v) => v.stationId || v.lotId, { path: ['stationId'], message: 'Choose a station or a lot' });

/** A sellable size of a product (`childCrud` on the product page). */
export const variantSchema = z.object({
	sku: z.string().trim().min(1, 'Required').max(40).transform((v) => v.toUpperCase()),
	bagSizeId: optionalId,
	nameEn: optionalText(80),
	nameAm: amText(80),
	nameOm: amText(80),
	nameAr: amText(80),
	nameIt: amText(80),
	nameFr: amText(80),
	price: moneyField,
	compareAtPrice: moneyField,
	lowStockUnits: optionalInt,
	barcode: optionalText(40),
	sortOrder,
	status: boolTrue
});
export const variantEditSchema = variantSchema.extend({ id: z.coerce.number() });

// ── Bundles ─────────────────────────────────────────────────────────────────────────────────

const bundleFields = z.object({
	slug,
	nameEn: enText(150),
	nameAm: amText(150),
	nameOm: amText(150),
	nameAr: amText(150),
	nameIt: amText(150),
	nameFr: amText(150),
	summaryEn: optionalText(300),
	summaryAm: optionalText(300),
	summaryOm: optionalText(300),
	summaryAr: optionalText(300),
	summaryIt: optionalText(300),
	summaryFr: optionalText(300),
	pricing: z.enum(BUNDLE_PRICINGS),
	value: z.coerce.number().positive('Enter the discount or the price'),
	stacksWithDiscounts: bool,
	startsOn: optionalDate,
	endsOn: optionalDate,
	maxPerOrder: z.preprocess(
		(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
		z.coerce.number().int().min(1, 'At least 1, or leave empty for no limit').nullable().optional()
	),
	isMemberOnly: bool,
	publishStatus: z.enum(PUBLISH_STATUSES),
	sortOrder,
	isActive: boolTrue
});

/** A percentage under 100, and an end on or after the start. */
const bundleRules = (
	v: { pricing: string; value: number; startsOn?: string | null; endsOn?: string | null },
	ctx: z.RefinementCtx
) => {
	if (v.pricing === 'percent_off' && v.value >= 100) {
		ctx.addIssue({ code: 'custom', path: ['value'], message: 'A percentage is under 100' });
	}
	if (v.startsOn && v.endsOn && v.endsOn < v.startsOn) {
		ctx.addIssue({ code: 'custom', path: ['endsOn'], message: 'On or after the start date' });
	}
};

export const bundleSchema = bundleFields.superRefine(bundleRules);
export const bundleEditSchema = bundleFields.extend({ id: requiredId() }).superRefine(bundleRules);
export const bundleImageSchema = productImageSchema;

/**
 * One row of what a bundle holds (`childCrud` on the bundle page): an exact size, or a bag size the
 * customer fills with any coffee — from one category when given.
 */
export const bundleItemSchema = z
	.object({
		variantId: optionalId,
		bagSizeId: optionalId,
		categoryId: optionalId,
		quantity: z.coerce.number().int().min(1, 'At least 1').max(50),
		sortOrder,
		status: boolTrue
	})
	.superRefine((v, ctx) => {
		if (!v.variantId === !v.bagSizeId) {
			ctx.addIssue({ code: 'custom', path: ['variantId'], message: 'Choose an exact size, or a bag size for the customer to fill — not both' });
		}
		if (v.categoryId && !v.bagSizeId) {
			ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Only a customer-filled slot takes a category' });
		}
	});
export const bundleItemEditSchema = bundleItemSchema.safeExtend({ id: z.coerce.number() });
