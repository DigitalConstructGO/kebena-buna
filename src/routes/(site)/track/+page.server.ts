import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod/v4';
import { takeToken } from '@nahu/admin-kit/server/rateLimit';
import { db } from '#lib/server/db/index.ts';
import { order } from '#lib/server/db/schema.ts';
import { floodRefused } from '#lib/server/site.ts';
import { queueOrderLink } from '#lib/server/orderMessages.ts';
import { sitePhone, siteText } from '#lib/schemas/site.ts';
import { m } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

const findSchema = z.object({ number: siteText(20), phone: sitePhone });

export const load: PageServerLoad = async () => ({ form: await superValidate(zod4(findSchema)) });

/**
 * A lost order link, sent again. The order's page holds the buyer's address, pickup code and
 * ticket QR codes, and a phone number is no secret, so a match does not open it here: its link
 * goes by text (and email, if the order has one) to the phone it was placed with. The answer is
 * the same whether or not anything matched, so the form tells nobody which orders exist.
 */
export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(findSchema));
		if (!form.valid) return fail(400, { form });
		if (floodRefused(event, 'track', 5)) return message(form, m.site_err_flood(), { status: 429 });
		// Order numbers run in sequence: a handful of tries per order, whatever address they come from.
		const number = form.data.number.trim().toUpperCase();
		if (!takeToken(`site:track:${number}`, { capacity: 5, perMinute: 0.2 }))
			return message(form, m.site_err_flood(), { status: 429 });
		const [o] = await db
			.select()
			.from(order)
			.where(and(eq(order.number, number), eq(order.contactPhone, form.data.phone)))
			.limit(1);
		if (o?.payToken) await db.transaction((tx) => queueOrderLink(tx, o));
		return message(form, m.track_find_sent());
	}
};
