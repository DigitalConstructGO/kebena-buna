import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { postedForm, UploadRefused } from '@nahu/admin-kit/server/files';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { localToday } from '@nahu/admin-kit/time';
import { saveEvent } from '#lib/server/events.ts';
import { locationOptions } from '#lib/server/options.ts';
import { eventSchema } from '#lib/schemas/visits.ts';

export const load = async ({ locals }) => {
	requirePermission(locals, 'events.manage');
	const today = localToday();
	return {
		form: await superValidate(
			{ startDate: today, startTime: '15:00', endDate: today, endTime: '17:00', capacity: 40 },
			zod4(eventSchema),
			{ errors: false }
		),
		locations: await locationOptions()
	};
};

export const actions = {
	default: async (event) => {
		requirePermission(event.locals, 'events.manage');
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(eventSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		let id: number;
		try {
			id = await saveEvent(event, form.data, posted);
		} catch (err) {
			if (err instanceof WriteRefused || err instanceof UploadRefused) {
				if (err.field) setError(form, err.field as never, err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			if (isDuplicateKey(err)) {
				setError(form, 'slug', 'Another event has this address');
				return message(form, { type: 'error', text: 'Another event has this address' }, { status: 400 });
			}
			throw err;
		}
		redirect(
			`/dashboard/visits/events/${id}`,
			{ type: 'success', message: 'Event created — now add its ticket types' },
			event.cookies
		);
	}
};
