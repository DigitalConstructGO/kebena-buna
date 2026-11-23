import { error } from '@sveltejs/kit';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { bad } from '@nahu/admin-kit/server/actionResults';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { localDate } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { customer, discountCode, discountRedemption, order } from '#lib/server/db/schema.ts';
import { stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { discountRow } from '#lib/server/orders.ts';
import { discountEditSchema } from '#lib/schemas/orders.ts';

async function loadCode(raw: string) {
	const id = idParam(raw, 'Discount code');
	const [d] = await db.select().from(discountCode).where(and(eq(discountCode.id, id), isNull(discountCode.deletedAt)));
	if (!d) error(404, 'Discount code not found');
	return d;
}

export const load = async ({ params }) => {
	const d = await loadCode(params.id);
	const [redemptions, [sums], stamps] = await Promise.all([
		db
			.select({
				id: discountRedemption.id,
				createdAt: discountRedemption.createdAt,
				orderId: discountRedemption.orderId,
				orderNumber: order.number,
				orderTotal: order.total,
				customerId: discountRedemption.customerId,
				customer: customer.name,
				amount: discountRedemption.amount
			})
			.from(discountRedemption)
			.innerJoin(order, eq(discountRedemption.orderId, order.id))
			.innerJoin(customer, eq(discountRedemption.customerId, customer.id))
			.where(eq(discountRedemption.discountCodeId, d.id))
			.orderBy(desc(discountRedemption.createdAt)),
		db
			.select({
				given: sql<number>`coalesce(sum(${discountRedemption.amount}), 0)`.mapWith(Number),
				sales: sql<number>`coalesce(sum(${order.total}), 0)`.mapWith(Number),
				customers: sql<number>`count(distinct ${discountRedemption.customerId})`.mapWith(Number)
			})
			.from(discountRedemption)
			.innerJoin(order, eq(discountRedemption.orderId, order.id))
			.where(eq(discountRedemption.discountCodeId, d.id)),
		stampsOf(d)
	]);
	return {
		code: d,
		redemptions,
		sums: sums!,
		stamps,
		editForm: await superValidate(
			{
				...d,
				appliesTo: (d.appliesTo ?? []) as never,
				startsOn: d.startsAt ? localDate(d.startsAt) : null,
				expiresOn: d.expiresAt ? localDate(d.expiresAt) : null
			},
			zod4(discountEditSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'discounts.manage');
		const form = await superValidate(event.request, zod4(discountEditSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		if (form.data.kind === 'percent' && form.data.value > 100) {
			setError(form, 'value', 'A percentage is at most 100');
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		}
		const before = await loadCode(event.params.id);
		if (form.data.usageLimit != null && form.data.usageLimit < before.usedCount) {
			setError(form, 'usageLimit', `It has been used ${before.usedCount} times already`);
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		}
		const { id: _id, ...data } = form.data;
		void _id;
		const values = {
			...(discountRow(data) as Partial<typeof discountCode.$inferInsert>),
			appliesTo: data.appliesTo.length ? data.appliesTo : null,
			updatedBy: event.locals.user?.id ?? null
		};
		try {
			await db.transaction(async (tx) => {
				await tx.update(discountCode).set(values).where(eq(discountCode.id, before.id));
				await recordAudit(tx, event, { table: 'discount_code', recordId: before.id, action: 'update', before, after: values });
			});
		} catch (err) {
			if (!isDuplicateKey(err)) throw err;
			setError(form, 'code', 'This code already exists');
			return message(form, { type: 'error', text: 'This code already exists' }, { status: 400 });
		}
		return message(form, { type: 'success', text: 'Discount code saved' });
	},
	/** Only a code nobody has used; a used one is switched off instead, so its history stays. */
	delete: async (event) => {
		requirePermission(event.locals, 'discounts.manage');
		const d = await loadCode(event.params.id);
		if (d.usedCount > 0) return bad('This code has been used: switch it off instead.');
		await db.transaction(async (tx) => {
			await tx.update(discountCode).set(deletionStamp(event.locals.user?.id)).where(eq(discountCode.id, d.id));
			await recordAudit(tx, event, { table: 'discount_code', recordId: d.id, action: 'delete' });
		});
		redirect('/dashboard/orders/discounts', { type: 'success', message: `${d.code} deleted` }, event.cookies);
	}
};
