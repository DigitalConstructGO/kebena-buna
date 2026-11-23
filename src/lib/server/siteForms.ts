/**
 * The action behind every public inbox form: validate, drop bots and floods, post to the staff
 * inbox (`submitForm`). The reply's message is a code the page turns into its own words: `ok`
 * (thank you, the form resets) or `flood` (wait a minute).
 *
 * A bot that filled the invisible field gets `ok` too, so it learns nothing; nothing is saved.
 */
import { fail, type RequestEvent } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { floodRefused, isTrapped, submitForm, type Submission } from '#lib/server/site.ts';

type Schema = Parameters<typeof zod4>[0];

export async function inboxAction<T extends Record<string, unknown>>(
	event: RequestEvent,
	schema: Schema,
	id: string,
	toSubmission: (data: T) => Submission
) {
	const form = await superValidate(event.request, zod4(schema), { id });
	if (!form.valid) return fail(400, { form });
	if (isTrapped(form.data as { website?: string })) return message(form, 'ok');
	if (floodRefused(event, id)) return message(form, 'flood', { status: 429 });
	await submitForm(event, toSubmission(form.data as T));
	return message(form, 'ok');
}
