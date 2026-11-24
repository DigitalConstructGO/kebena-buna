/**
 * The public membership and coffee-subscription forms (questionnaire 7). Client-safe, with the
 * site's translated messages (`#lib/schemas/site`).
 */
import { z } from 'zod/v4';
import { m } from '#lib/i18n.ts';
import {
	buyerFields,
	payWithField,
	siteDate,
	siteFormBase,
	siteOptionalText,
	siteText
} from '#lib/schemas/site.ts';

const pick = (message: () => string) =>
	z.coerce.number({ error: message }).int().positive({ error: message });
const optionalPick = z.preprocess(
	(v) => (v === '' || v === undefined || v === null || v === '0' ? null : v),
	z.coerce.number().int().positive().nullable()
);
/** Names typed into repeated inputs (the action drops the empty ones). */
const names = z
	.array(
		z
			.string()
			.trim()
			.max(150, { error: () => m.site_err_long() })
	)
	.max(10)
	.default([]);

export const membershipSignupSchema = z.object({
	planId: pick(() => m.member_err_plan()),
	startsOn: siteDate,
	/** Everyone else on a family plan: the buyer is the first adult. */
	adults: names,
	children: names,
	/** The membership a reminder's renewal link names (`?m=`): this term follows it. */
	renews: siteOptionalText(20),
	...buyerFields,
	...siteFormBase,
	...payWithField
});

export const subscriptionSignupSchema = z.object({
	planId: pick(() => m.subs_err_plan()),
	variantId: pick(() => m.subs_err_coffee()),
	roastLevelId: pick(() => m.subs_err_roast()),
	grindId: optionalPick,
	quantity: z.coerce
		.number({ error: () => m.site_err_number() })
		.int({ error: () => m.site_err_number() })
		.min(1, { error: () => m.site_err_min({ min: 1 }) })
		.max(5, { error: () => m.site_err_max({ max: 5 }) })
		.default(1),
	frequency: z.enum(['biweekly', 'monthly']).default('monthly'),
	deliveryZoneId: pick(() => m.subs_err_zone()),
	/** Address: not needed when the zone is pickup at the museum (checked on the server). */
	areaId: optionalPick,
	line1: siteOptionalText(255),
	landmark: siteOptionalText(255),
	city: siteText(64).default('Addis Ababa'),
	/** The subscription a reminder's top-up link names (`?s=`): the bundle is added to it. */
	topUp: siteOptionalText(20),
	...buyerFields,
	...siteFormBase,
	...payWithField
});
