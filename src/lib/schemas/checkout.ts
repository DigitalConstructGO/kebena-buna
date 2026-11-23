/**
 * The shop's checkout form (questionnaire 3): who is buying, and pickup at the museum or delivery
 * to an address in a zone. Client-safe, so the form checks itself before posting.
 */
import { z } from 'zod/v4';
import { m } from '#lib/paraglide/messages.js';
import { buyerFields, siteFormBase, siteOptionalText } from '#lib/schemas/site.ts';

const optionalId = z.preprocess(
	(v) => (v === '' || v === undefined || v === null || v === 0 || v === '0' ? null : v),
	z.coerce.number().int().positive().nullable()
);

export const checkoutSchema = z
	.object({
		...buyerFields,
		...siteFormBase,
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
			if (!d[field]) ctx.addIssue({ code: 'custom', path: [field], message: m.site_err_required() });
		}
	});
