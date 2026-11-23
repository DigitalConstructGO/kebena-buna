import type { Localized } from '#lib/format.ts';

/** A product as the shop's shelf shows it, and as its pop-up adds it to the cart (`/shop` load). */
export type ShelfProduct = {
	slug: string;
	kind: 'coffee' | 'bundle' | 'merchandise' | string;
	name: Localized;
	summary: Localized;
	tastingNotes: Localized;
	image: string;
	categoryId: number | null;
	from: number;
	roastToOrder: boolean;
	soldOut: boolean;
	/** On sale, in the order the product page lists them; `available` is null where stock is not counted. */
	variants: { id: number; name: Localized; size: Localized; price: number; available: number | null }[];
	/** The defaults the product page starts on; the pop-up adds with these. */
	roast: { id: number; name: Localized } | null;
	grindId: number | null;
	packagingId: number | null;
	origins: Localized[];
};
