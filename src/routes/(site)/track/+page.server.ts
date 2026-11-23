import { fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod/v4';
import { db } from '#lib/server/db/index.ts';
import { order } from '#lib/server/db/schema.ts';
import { floodRefused, trackHref } from '#lib/server/site.ts';
import { sitePhone, siteText } from '#lib/schemas/site.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

const findSchema = z.object({ number: siteText(20), phone: sitePhone });

export const load: PageServerLoad = async () => ({ form: await superValidate(zod4(findSchema)) });

/** An order found by its number and the phone it was placed with, then its status page. */
export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(findSchema));
		if (!form.valid) return fail(400, { form });
		if (floodRefused(event, 'track', 5)) return message(form, m.site_err_flood(), { status: 429 });
		const [o] = await db
			.select({ number: order.number, payToken: order.payToken })
			.from(order)
			.where(and(eq(order.number, form.data.number.toUpperCase()), eq(order.contactPhone, form.data.phone)))
			.limit(1);
		if (!o?.payToken) return message(form, m.track_find_none(), { status: 404 });
		redirect(303, trackHref(o));
	}
};
