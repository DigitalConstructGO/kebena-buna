import { error } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { postedForm } from '@nahu/admin-kit/server/files';
import { db } from '#lib/server/db/index.ts';
import { post, postCategory } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { namesOf, staffOptions, stampsOf } from '#lib/server/people.ts';
import { postCategoryOptions } from '#lib/server/options.ts';
import { idParam } from '#lib/server/records.ts';
import { deleteDoc, docFormValues, minutesOf, refusal, savePost, setPublishStatus } from '#lib/server/content.ts';
import { postSchema } from '#lib/schemas/content.ts';
import { PUBLISH_STATUSES } from '#lib/constants.ts';

async function found(raw: string) {
	const id = idParam(raw, 'Post');
	const [row] = await db
		.select()
		.from(post)
		.where(and(eq(post.id, id), isNull(post.deletedAt)));
	if (!row) error(404, 'Post not found');
	return row;
}

/** One blog post, edited in place. */
export const load = async ({ params }) => {
	const p = await found(params.id);
	const [categories, authors, stamps, names, category] = await Promise.all([
		postCategoryOptions(),
		staffOptions(),
		stampsOf(p),
		namesOf([p.authorId]),
		p.categoryId
			? db.select({ name: enOf(postCategory.name) }).from(postCategory).where(eq(postCategory.id, p.categoryId))
			: Promise.resolve([])
	]);
	const rest = { ...p, coverImage: undefined };
	return {
		post: {
			id: p.id,
			slug: p.slug,
			title: (p.title as Record<string, string>).en ?? p.slug,
			coverImage: p.coverImage,
			publishStatus: p.publishStatus,
			publishedAt: p.publishedAt,
			authorId: p.authorId,
			author: p.authorId ? (names[p.authorId] ?? null) : null,
			category: category[0]?.name ?? null,
			minutes: minutesOf(p.body)
		},
		categories,
		authors,
		stamps,
		form: await superValidate(
			docFormValues(rest, ['title', 'excerpt', 'seoTitle', 'seoDescription']),
			zod4(postSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	save: async (event) => {
		const p = await found(event.params.id);
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(postSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		try {
			await savePost(event, form.data, posted, p.id);
		} catch (err) {
			const r = refusal(err);
			if (!r) throw err;
			if (r.field) setError(form, r.field as 'slug', r.text);
			return message(form, { type: 'error', text: r.text }, { status: 400 });
		}
		return message(form, { type: 'success', text: 'Post saved' });
	},
	status: async (event) => {
		const p = await found(event.params.id);
		const to = String((await event.request.formData()).get('to'));
		if (!(PUBLISH_STATUSES as readonly string[]).includes(to)) error(400, 'Unknown status');
		await setPublishStatus(event, post, 'post', p.id, to as (typeof PUBLISH_STATUSES)[number]);
		return { message: { type: 'success', text: `Post ${to === 'draft' ? 'unpublished' : to}` } };
	},
	delete: async (event) => {
		const p = await found(event.params.id);
		await deleteDoc(event, post, 'post', p.id);
		redirect('/dashboard/content/posts', { type: 'success', message: 'Post deleted' }, event.cookies);
	}
};
