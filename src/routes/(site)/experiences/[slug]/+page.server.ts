import { error, fail } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { localClock, localDate } from '@nahu/admin-kit/time';
import { experience, openSessions } from '#lib/server/experiences.ts';
import { floodRefused, isTrapped, submitForm } from '#lib/server/site.ts';
import { bookingRequestSchema } from '#lib/schemas/siteVisit.ts';
import { tr } from '#lib/format.ts';
import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const x = await experience(params.slug);
	if (!x) error(404, m.exp_label());
	const languages = x.languages ?? [];
	const form = await superValidate(
		{ partySize: x.minParty, language: languages.includes(getLocale()) ? getLocale() : (languages[0] ?? null) },
		zod4(bookingRequestSchema),
		{ errors: false }
	);
	return { experience: x, form };
};

/**
 * A booking request for the inbox (8.4, 8.5): staff confirm it, which makes the booking and takes
 * payment. The session's places are checked here, so a request is never for a full session.
 */
export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(bookingRequestSchema));
		if (!form.valid) return fail(400, { form });
		if (isTrapped(form.data)) return message(form, m.exp_sent());
		if (floodRefused(event, 'booking', 3)) return message(form, m.site_err_flood(), { status: 429 });

		const x = await experience(event.params.slug);
		if (!x) error(404, m.exp_label());
		const d = form.data;
		const max = x.maxParty ?? 250;
		if (d.partySize < x.minParty || d.partySize > max) {
			return setError(form, 'partySize', m.exp_err_party({ min: x.minParty, max }));
		}
		if (d.language && !(x.languages ?? []).includes(d.language)) d.language = null;

		let session: { id: number; startsAt: Date; free: number } | null = null;
		if (!x.isEnquiryOnly && x.sessions.length) {
			if (!d.sessionId) return setError(form, 'sessionId', m.exp_err_session());
			[session] = await openSessions(x.id, d.sessionId);
			if (!session) return setError(form, 'sessionId', m.exp_err_session());
			if (session.free < d.partySize) return setError(form, 'partySize', m.exp_err_room({ count: session.free }));
		}

		const visitDate = session ? localDate(session.startsAt) : (d.preferredDate ?? null);
		await submitForm(event, {
			formType: 'booking',
			name: d.name,
			phone: d.phone,
			email: d.email,
			subject: `${tr(x.name, 'en')}${session ? ` · ${visitDate} ${localClock(session.startsAt)}` : ''}`.slice(0, 255),
			message: d.specialRequests ?? null,
			visitDate,
			data: {
				bookableId: x.id,
				bookable: x.slug,
				sessionId: session?.id ?? null,
				sessionStartsAt: session?.startsAt.toISOString() ?? null,
				preferredDate: session ? null : (d.preferredDate ?? null),
				partySize: d.partySize,
				language: d.language ?? null,
				accessibilityNeeds: d.accessibilityNeeds ?? null
			},
			marketingConsent: d.marketingConsent
		});
		return message(form, m.exp_sent());
	}
};
