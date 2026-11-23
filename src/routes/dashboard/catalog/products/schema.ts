/** The new-product form: the product, its description and its allowed options in one post. */
import {
	productDescriptionSchema,
	productOptionsSchema,
	productSchema
} from '#lib/schemas/catalog.ts';

export const productNewSchema = productSchema
	.extend(productDescriptionSchema.shape)
	.extend(productOptionsSchema.shape);

/** The product's translated columns, as `packLocalized` folds them. */
export const PRODUCT_TEXT = [
	'name',
	'summary',
	'tastingNotes',
	'originStory',
	'seoTitle',
	'seoDescription'
];
