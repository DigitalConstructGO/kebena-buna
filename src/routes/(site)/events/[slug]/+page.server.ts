import { randomUUID } from 'node:crypto';
import { error, fail } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eventBySlug } from '#lib/server/siteEvents.ts';
import { floodRefused, isTrapped, paymentsOn, submitForm } from '#lib/server/site.ts';
import { activeAudiences, afterOrder, OrderRefused, placeTicketOrder, ticketTypesFor } from '#lib/server/ticketOrders.ts';
import { eventOrderSchema, eventRegisterSchema } from '#lib/schemas/siteVisit.ts';
import { errorPath } from '#lib/site/visit/errorPath.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const e = await eventBySlug(params.slug);
	if (!e) error(404, m.events_label());

	const audiences = await activeAudiences();
	const audience =
		audiences.find((a) => a.code === url.searchParams.get('audience')) ?? audiences.find((a) => a.isDefault) ?? audiences[0];
	const perAudience = await Promise.all(audiences.map((a) => ticketTypesFor(a.id, e.id)));
	// An event with ticket types sells them; one without takes a plain registration (8.4).
	const sellsTickets = perAudience.some((list) => list.length > 0);
	const types = (perAudience[audiences.indexOf(audience)] ?? []).map((t) => ({ ...t, price: Number(t.price) }));

	return {
		event: e,
		sellsTickets,
		audiences: audiences.map((a) => ({ code: a.code, name: a.name })),
		audience: audience ? { id: audience.id, code: audience.code, declaration: audience.requiresIdCheck ? audience.declaration : null } : null,
		types,
		paymentsOn: paymentsOn(),
		buy: await superValidate(
			{ audienceId: audience?.id, items: types.map((t) => ({ ticketTypeId: t.id, quantity: 0 })), idempotencyKey: randomUUID() },
			zod4(eventOrderSchema),
			{ id: 'buy', errors: false }
		),
		register: await superValidate(zod4(eventRegisterSchema), { id: 'register' })
	};
};

export const actions: Actions = {
	/** The event's own tickets, paid through an order; a free event's are issued at once. */
	buy: async (event) => {
		const form = await superValidate(event.request, zod4(eventOrderSchema), { id: 'buy' });
		if (!form.valid) return fail(400, { buy: form });
		if (isTrapped(form.data)) return message(form, m.events_sent());
		if (floodRefused(event, 'event-tickets', 4)) return message(form, m.site_err_flood(), { status: 429 });
		const e = await eventBySlug(event.params.slug);
		if (!e?.open) return setError(form, 'items._errors', m.events_err_closed());

		let placed;
		try {
			placed = await placeTicketOrder(event, { ...form.data, eventId: e.id });
		} catch (err) {
			// An event order has no slot: its refusals are about the tickets, the audience or the declaration.
			if (err instanceof OrderRefused) return setError(form, errorPath(err.field) as Exclude<ReturnType<typeof errorPath>, 'slotId'>, err.message);
			throw err;
		}
		return afterOrder(event, placed);
	},
	/** No ticket types: a registration for the inbox, with the places asked for. */
	register: async (event) => {
		const form = await superValidate(event.request, zod4(eventRegisterSchema), { id: 'register' });
		if (!form.valid) return fail(400, { register: form });
		if (isTrapped(form.data)) return message(form, m.events_sent());
		if (floodRefused(event, 'event-register', 3)) return message(form, m.site_err_flood(), { status: 429 });
		const e = await eventBySlug(event.params.slug);
		if (!e?.open) return setError(form, 'seats', m.events_err_closed());
		if (form.data.seats > e.left) return setError(form, 'seats', m.events_err_full());

		await submitForm(event, {
			formType: 'event_registration',
			name: form.data.name,
			phone: form.data.phone,
			email: form.data.email,
			subject: `${e.title.en ?? e.slug}`.slice(0, 255),
			data: { eventId: e.id, event: e.slug, seats: form.data.seats },
			marketingConsent: form.data.marketingConsent
		});
		return message(form, m.events_sent());
	}
};
