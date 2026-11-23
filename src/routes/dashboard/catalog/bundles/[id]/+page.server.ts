import { error, fail } from '@sveltejs/kit';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { bad } from '@nahu/admin-kit/server/actionResults';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { childActions, childCrud, WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { postedForm, saveUploadedFile, UploadRefused } from '@nahu/admin-kit/server/files';
import { localDate } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { bundle, bundleItem, order, orderLine, productVariant } from '#lib/server/db/schema.ts';
import { unpackLocalized } from '#lib/server/localized.ts';
import { stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { bagSizeOptions, categoryOptions, variantOptions } from '#lib/server/options.ts';
import { BUNDLE_TEXT, bundleContents, bundleRow, bundleSold, bundleTotals } from '#lib/server/bundles.ts';
import {
	bundleEditSchema,
	bundleImageSchema,
	bundleItemEditSchema,
	bundleItemSchema
} from '#lib/schemas/catalog.ts';
import { PUBLISH_STATUSES } from '#lib/constants.ts';

async function loadBundle(raw: string | number) {
	const id = idParam(String(raw), 'Bundle');
	const [b] = await db.select().from(bundle).where(and(eq(bundle.id, id), isNull(bundle.deletedAt)));
	if (!b) error(404, 'Bundle not found');
	return b;
}

const owner = async (event: { params: { id?: string } }) => (await loadBundle(event.params.id ?? '')).id;

/** What the bundle holds. An exact size must be a live one; a slot names a bag size to fill. */
const items = childCrud({
	table: bundleItem,
	ownerColumn: 'bundleId',
	label: 'Bag',
	addSchema: bundleItemSchema,
	editSchema: bundleItemEditSchema,
	audit: 'bundle_item',
	permission: 'catalog.manage',
	transform: async (values) => {
		if (values.variantId) {
			const [v] = await db
				.select({ id: productVariant.id })
				.from(productVariant)
				.where(and(eq(productVariant.id, Number(values.variantId)), isNull(productVariant.deletedAt)));
			if (!v) throw new WriteRefused('variantId', 'That size has been deleted.');
			values.bagSizeId = null;
			values.categoryId = null;
		}
		return values;
	}
});

export const load = async ({ params, locals }) => {
	const b = await loadBundle(params.id);
	const [itemSection, contents, sales, [sums], stamps, variants, bagSizes, categories] = await Promise.all([
		items.load(b.id),
		bundleContents([b.id]),
		db
			.select({
				orderId: order.id,
				number: order.number,
				placedAt: order.placedAt,
				status: order.status,
				bags: sql<number>`sum(${orderLine.quantity})`.mapWith(Number),
				list: sql<number>`sum(${orderLine.unitPrice} * ${orderLine.quantity})`.mapWith(Number),
				discount: sql<number>`sum(${orderLine.discountAmount})`.mapWith(Number),
				total: sql<number>`sum(${orderLine.lineTotal})`.mapWith(Number)
			})
			.from(orderLine)
			.innerJoin(order, eq(orderLine.orderId, order.id))
			.where(eq(orderLine.bundleId, b.id))
			.groupBy(order.id, orderLine.bundleGroup)
			.orderBy(desc(order.placedAt))
			.limit(25),
		db
			.select({
				sold: sql<number>`count(distinct ${orderLine.orderId}, ${orderLine.bundleGroup})`.mapWith(Number),
				sales: sql<number>`coalesce(sum(${orderLine.lineTotal}), 0)`.mapWith(Number),
				given: sql<number>`coalesce(sum(${orderLine.discountAmount}), 0)`.mapWith(Number)
			})
			.from(orderLine)
			.where(eq(orderLine.bundleId, b.id)),
		stampsOf(b),
		variantOptions(),
		bagSizeOptions(),
		categoryOptions()
	]);
	const byId = new Map(contents.map((c) => [c.id, c]));

	return {
		bundle: b,
		totals: bundleTotals({ pricing: b.pricing, value: Number(b.value) }, contents),
		items: {
			...itemSection,
			rows: itemSection.rows.map((row) => {
				const c = byId.get(row.id);
				return {
					...row,
					variant: c?.kind === 'exact' ? c.label : '',
					bagSize: c?.kind === 'choice' ? c.slotSize : '',
					category: c?.categoryId ? c.category : '',
					min: c?.min ?? null,
					max: c?.max ?? null,
					choices: c?.kind === 'choice' ? c.slotChoices : null,
					problem: c?.problem ?? null
				};
			})
		},
		sales,
		sums: sums!,
		stamps,
		options: { variants, bagSizes, categories },
		canManage: hasPermission(locals, 'catalog.manage'),
		editForm: await superValidate(
			{
				...unpackLocalized(b, BUNDLE_TEXT),
				startsOn: b.startsAt ? localDate(b.startsAt) : null,
				endsOn: b.endsAt ? localDate(b.endsAt) : null
			},
			zod4(bundleEditSchema),
			{ errors: false, id: 'edit' }
		),
		imageForm: await superValidate(zod4(bundleImageSchema), { id: 'image' })
	};
};

export const actions = {
	...childActions({ Item: items }, owner),

	edit: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const form = await superValidate(event.request, zod4(bundleEditSchema), { id: 'edit' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		// The bundle is the one in the URL; the form's own id is not trusted to name it.
		const before = await loadBundle(event.params.id);
		const { id: _id, ...data } = form.data;
		void _id;
		const values = { ...bundleRow({ ...data }), updatedBy: event.locals.user?.id ?? null };
		try {
			await db.transaction(async (tx) => {
				await tx.update(bundle).set(values).where(eq(bundle.id, before.id));
				await recordAudit(tx, event, { table: 'bundle', recordId: before.id, action: 'update', before, after: values });
			});
		} catch (err) {
			if (!isDuplicateKey(err)) throw err;
			setError(form, 'slug', 'Another bundle already has this address.');
			return message(form, { type: 'error', text: 'That address is taken' }, { status: 400 });
		}
		return message(form, { type: 'success', text: 'Bundle saved' });
	},

	image: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(bundleImageSchema), { id: 'image' });
		const b = await loadBundle(event.params.id);
		try {
			const image = form.data.image?.size ? await saveUploadedFile(form.data.image) : null;
			if (!image) {
				setError(form, 'image', 'Choose a picture');
				return message(form, { type: 'error', text: 'Choose a picture' }, { status: 400 });
			}
			await db.update(bundle).set({ image, updatedBy: event.locals.user?.id }).where(eq(bundle.id, b.id));
		} catch (err) {
			if (err instanceof UploadRefused) {
				setError(form, 'image', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Picture saved' });
	},

	publish: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const b = await loadBundle(event.params.id);
		const to = String((await event.request.formData()).get('to'));
		if (!(PUBLISH_STATUSES as readonly string[]).includes(to)) return fail(400);
		const publishStatus = to as (typeof PUBLISH_STATUSES)[number];
		if (publishStatus === 'published') {
			const { bags, problems } = bundleTotals({ pricing: b.pricing, value: Number(b.value) }, await bundleContents([b.id]));
			if (!bags) return bad('Put something in the bundle before publishing it.');
			if (problems.length) return bad(`Fix what is in it first. ${problems[0]}.`);
		}
		await db.transaction(async (tx) => {
			await tx.update(bundle).set({ publishStatus, updatedBy: event.locals.user?.id }).where(eq(bundle.id, b.id));
			await recordAudit(tx, event, { table: 'bundle', recordId: b.id, action: 'update', before: b, after: { publishStatus } });
		});
		return {
			message: { type: 'success', text: publishStatus === 'published' ? 'Published on the website' : `Marked ${publishStatus}` }
		};
	},

	/** Only a bundle never sold; a sold one is archived instead, so its orders still name it. */
	delete: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const b = await loadBundle(event.params.id);
		const refusal = await db.transaction(async (tx) => {
			await tx.select({ id: bundle.id }).from(bundle).where(eq(bundle.id, b.id)).for('update');
			if (await bundleSold(tx, b.id)) return 'This bundle has been sold: archive it instead.';
			await tx
				.update(bundle)
				.set({
					...deletionStamp(event.locals.user?.id),
					// Frees the address for a new bundle, as a deleted product's is.
					slug: sql`concat(left(${bundle.slug}, 99 - length(${bundle.id})), '~', ${bundle.id})`
				})
				.where(eq(bundle.id, b.id));
			await tx
				.update(bundleItem)
				.set(deletionStamp(event.locals.user?.id))
				.where(and(eq(bundleItem.bundleId, b.id), isNull(bundleItem.deletedAt)));
			await recordAudit(tx, event, { table: 'bundle', recordId: b.id, action: 'delete' });
			return null;
		});
		if (refusal) return bad(refusal);
		redirect('/dashboard/catalog/bundles', { type: 'success', message: 'Bundle deleted' }, event.cookies);
	}
};
