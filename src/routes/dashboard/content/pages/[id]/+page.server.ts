import { error } from '@sveltejs/kit';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { postedForm } from '@nahu/admin-kit/server/files';
import { db } from '#lib/server/db/index.ts';
import { page } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import {
	deleteDoc,
	docFormValues,
	minutesOf,
	pageOptions,
	refusal,
	savePage,
	setPublishStatus
} from '#lib/server/content.ts';
import { pageSchema } from '#lib/schemas/content.ts';
import { PUBLISH_STATUSES } from '#lib/constants.ts';

async function found(raw: string) {
	const id = idParam(raw, 'Page');
	const [row] = await db
		.select()
		.from(page)
		.where(and(eq(page.id, id), isNull(page.deletedAt)));
	if (!row) error(404, 'Page not found');
	return row;
}

/** One page, edited in place, with its place in the tree and who last changed it. */
export const load = async ({ params }) => {
	const p = await found(params.id);
	const [children, parent, parents, stamps] = await Promise.all([
		db
			.select({ id: page.id, title: enOf(page.title), publishStatus: page.publishStatus })
			.from(page)
			.where(and(eq(page.parentId, p.id), isNull(page.deletedAt)))
			.orderBy(asc(page.sortOrder)),
		p.parentId
			? db.select({ id: page.id, title: enOf(page.title) }).from(page).where(eq(page.id, p.parentId))
			: Promise.resolve([]),
		pageOptions(p.id),
		stampsOf(p)
	]);
	const rest = { ...p, heroImage: undefined };
	return {
		page: {
			id: p.id,
			slug: p.slug,
			title: (p.title as Record<string, string>).en ?? p.slug,
			heroImage: p.heroImage,
			publishStatus: p.publishStatus,
			publishedAt: p.publishedAt,
			parentId: p.parentId,
			minutes: minutesOf(p.body)
		},
		parent: parent[0] ?? null,
		children,
		parents,
		stamps,
		form: await superValidate(
			docFormValues(rest, ['title', 'seoTitle', 'seoDescription']),
			zod4(pageSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	save: async (event) => {
		const p = await found(event.params.id);
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(pageSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		try {
			await savePage(event, form.data, posted, p.id);
		} catch (err) {
			const r = refusal(err);
			if (!r) throw err;
			if (r.field) setError(form, r.field as 'slug', r.text);
			return message(form, { type: 'error', text: r.text }, { status: 400 });
		}
		return message(form, { type: 'success', text: 'Page saved' });
	},
	status: async (event) => {
		const p = await found(event.params.id);
		const to = String((await event.request.formData()).get('to'));
		if (!(PUBLISH_STATUSES as readonly string[]).includes(to)) error(400, 'Unknown status');
		await setPublishStatus(event, page, 'page', p.id, to as (typeof PUBLISH_STATUSES)[number]);
		return { message: { type: 'success', text: `Page ${to === 'draft' ? 'unpublished' : to}` } };
	},
	delete: async (event) => {
		const p = await found(event.params.id);
		await deleteDoc(event, page, 'page', p.id);
		redirect('/dashboard/content/pages', { type: 'success', message: 'Page deleted' }, event.cookies);
	}
};
