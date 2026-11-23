/**
 * The shop's checkout form (questionnaire 3): who is buying, and pickup at the museum or delivery
 * to an address in a zone. Client-safe, so the form checks itself before posting.
 */
import { z } from 'zod/v4';
import { m } from '#lib/i18n.ts';
import { buyerFields, payWithField, siteFormBase, siteOptionalText } from '#lib/schemas/site.ts';

const optionalId = z.preprocess(
	(v) => (v === '' || v === undefined || v === null || v === 0 || v === '0' ? null : v),
	z.coerce.number().int().positive().nullable()
);

export const checkoutSchema = z
	.object({
		...buyerFields,
		...siteFormBase,
		...payWithField,
		method: z.enum(['pickup', 'delivery']).default('pickup'),
		zoneId: optionalId,
		areaId: optionalId,
		city: siteOptionalText(64),
		woreda: siteOptionalText(64),
		line1: siteOptionalText(255),
		landmark: siteOptionalText(255),
		note: siteOptionalText(500)
	})
	.superRefine((d, ctx) => {
		if (d.method !== 'delivery') return;
		for (const field of ['zoneId', 'city', 'line1'] as const) {
			if (!d[field])
				ctx.addIssue({ code: 'custom', path: [field], message: m.site_err_required() });
		}
	});

const RECEIPT_TYPES = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
/** Some phones send an iPhone photo with no type at all: its name says what it is. */
const RECEIPT_NAMES = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;
const receiptOk = (f: File | undefined) =>
	Boolean(
		f &&
		f.size > 0 &&
		f.size <= 10 * 1024 * 1024 &&
		(RECEIPT_TYPES.test(f.type) || (!f.type && RECEIPT_NAMES.test(f.name)))
	);

/** A bank-transfer receipt, sent from the order's page (`/track/{number}`). */
export const transferSchema = z
	.object({
		bankAccountId: z.coerce
			.number({ error: () => m.track_transfer_err_account() })
			.int()
			.positive({ error: () => m.track_transfer_err_account() }),
		reference: siteOptionalText(64),
		receipt: z.file().optional()
	})
	.refine((d) => receiptOk(d.receipt), {
		path: ['receipt'],
		error: () => m.track_transfer_err_file()
	});
