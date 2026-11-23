import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { postedForm } from '@nahu/admin-kit/server/files';
import { pageOptions, refusal, savePage } from '#lib/server/content.ts';
import { pageSchema } from '#lib/schemas/content.ts';

export const load = async () => ({
	form: await superValidate(zod4(pageSchema)),
	parents: await pageOptions()
});

export const actions = {
	default: async (event) => {
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(pageSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		let id: number;
		try {
			id = await savePage(event, form.data, posted);
		} catch (err) {
			const r = refusal(err);
			if (!r) throw err;
			if (r.field) setError(form, r.field as 'slug', r.text);
			return message(form, { type: 'error', text: r.text }, { status: 400 });
		}
		redirect(`/dashboard/content/pages/${id}`, { type: 'success', message: 'Page created' }, event.cookies);
	}
};
