import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { z } from 'zod/v4';
import { inboxAction } from '#lib/server/siteForms.ts';
import { enquirySchema, feedbackSchema } from '#lib/schemas/siteForms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	enquiry: await superValidate(zod4(enquirySchema), { id: 'enquiry' }),
	feedback: await superValidate(zod4(feedbackSchema), { id: 'feedback' })
});

/** Both land in the staff inbox (8.5): a general enquiry, or feedback with its rating. */
export const actions: Actions = {
	enquiry: (event) =>
		inboxAction<z.infer<typeof enquirySchema>>(event, enquirySchema, 'enquiry', (d) => ({
			formType: 'enquiry',
			name: d.name,
			email: d.email,
			phone: d.phone,
			subject: d.subject,
			message: d.message,
			marketingConsent: d.marketingConsent
		})),
	feedback: (event) =>
		inboxAction<z.infer<typeof feedbackSchema>>(event, feedbackSchema, 'feedback', (d) => ({
			formType: 'feedback',
			name: d.name,
			email: d.email,
			rating: d.rating,
			message: d.message,
			visitDate: d.visitDate,
			marketingConsent: d.marketingConsent
		}))
};
