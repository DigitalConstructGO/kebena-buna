import { error } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { postedForm, UploadRefused } from '@nahu/admin-kit/server/files';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import { event } from '#lib/server/db/schema.ts';
import { eventFormValues, saveEvent } from '#lib/server/events.ts';
import { locationOptions } from '#lib/server/options.ts';
import { idParam } from '#lib/server/records.ts';
import { eventEditSchema } from '#lib/schemas/visits.ts';

async function found(raw: string) {
	const [e] = await db
		.select()
		.from(event)
		.where(and(eq(event.id, idParam(raw, 'Event')), isNull(event.deletedAt)));
	if (!e) error(404, 'Event not found');
	return e;
}

export const load = async ({ params, locals }) => {
	requirePermission(locals, 'events.manage');
	const e = await found(params.id);
	return {
		event: { id: e.id, title: e.title, image: e.image },
		form: await superValidate(eventFormValues(e), zod4(eventEditSchema), { errors: false }),
		locations: await locationOptions()
	};
};

export const actions = {
	default: async (req) => {
		requirePermission(req.locals, 'events.manage');
		const e = await found(req.params.id);
		const posted = await postedForm(req.request);
		const form = await superValidate(posted, zod4(eventEditSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		try {
			await saveEvent(req, form.data, posted, e.id);
		} catch (err) {
			if (err instanceof WriteRefused || err instanceof UploadRefused) {
				if (err.field) setError(form, err.field as never, err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			if (isDuplicateKey(err)) {
				setError(form, 'slug', 'Another event has this address');
				return message(
					form,
					{ type: 'error', text: 'Another event has this address' },
					{ status: 400 }
				);
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Event saved' });
	}
};
