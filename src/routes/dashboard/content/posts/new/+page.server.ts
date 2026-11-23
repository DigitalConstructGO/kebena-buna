import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { postedForm } from '@nahu/admin-kit/server/files';
import { postCategoryOptions } from '#lib/server/options.ts';
import { staffOptions } from '#lib/server/people.ts';
import { refusal, savePost } from '#lib/server/content.ts';
import { postSchema } from '#lib/schemas/content.ts';

export const load = async ({ locals }) => {
	const [categories, authors] = await Promise.all([postCategoryOptions(), staffOptions()]);
	return {
		form: await superValidate({ authorId: locals.user?.id }, zod4(postSchema), { errors: false }),
		categories,
		authors
	};
};

export const actions = {
	default: async (event) => {
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(postSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		let id: number;
		try {
			id = await savePost(event, form.data, posted);
		} catch (err) {
			const r = refusal(err);
			if (!r) throw err;
			if (r.field) setError(form, r.field as 'slug', r.text);
			return message(form, { type: 'error', text: r.text }, { status: 400 });
		}
		redirect(`/dashboard/content/posts/${id}`, { type: 'success', message: 'Post created' }, event.cookies);
	}
};
