import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { z } from 'zod/v4';
import { inboxAction } from '#lib/server/siteForms.ts';
import { groupSchema, privateEventSchema } from '#lib/schemas/siteForms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	group: await superValidate(zod4(groupSchema), { id: 'group' }),
	event: await superValidate(zod4(privateEventSchema), { id: 'event' })
});

/**
 * Requests, not bookings: staff confirm a date and slot (which holds the places), then invoice
 * (6.6). Both land in the inbox, where staff turn them into bookings.
 */
export const actions: Actions = {
	group: (event) =>
		inboxAction<z.infer<typeof groupSchema>>(event, groupSchema, 'group', (d) => {
			const preferredDates = [d.preferredDate1, d.preferredDate2, d.preferredDate3].filter(
				(x): x is string => Boolean(x)
			);
			return {
				formType: 'group_booking',
				name: d.contactName,
				phone: d.phone,
				email: d.email,
				subject: `${d.kind === 'school' ? 'School visit' : 'Group visit'}: ${d.organisationName}, ${d.partySize} people`,
				message: d.specialRequests,
				visitDate: preferredDates[0],
				data: {
					kind: d.kind,
					organisationName: d.organisationName,
					// The inbox's "Make booking" reads `preferredDate`; the full list is `preferredDates`.
					preferredDate: preferredDates[0],
					preferredDates,
					partySize: d.partySize,
					ageRange: d.ageRange,
					tin: d.tin ?? null
				},
				marketingConsent: d.marketingConsent
			};
		}),
	event: (event) =>
		inboxAction<z.infer<typeof privateEventSchema>>(event, privateEventSchema, 'event', (d) => ({
			formType: 'private_event',
			name: d.name,
			phone: d.phone,
			email: d.email,
			subject: `Private event: ${d.eventType}, ${d.guestCount} guests`,
			message: d.message,
			visitDate: d.preferredDate,
			data: {
				eventType: d.eventType,
				preferredDate: d.preferredDate,
				guestCount: d.guestCount,
				budget: d.budget ?? null,
				catering: d.catering ?? null
			},
			marketingConsent: d.marketingConsent
		}))
};
