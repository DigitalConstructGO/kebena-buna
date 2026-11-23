import { desc, eq, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { db } from '#lib/server/db/index.ts';
import { discountCode, discountRedemption } from '#lib/server/db/schema.ts';
import { creator } from '#lib/server/people.ts';
import { discountRow } from '#lib/server/orders.ts';
import { discountSchema } from '#lib/schemas/orders.ts';

export const load = async () => {
	const rows = await db
		.select({
			id: discountCode.id,
			code: discountCode.code,
			description: discountCode.description,
			kind: discountCode.kind,
			value: discountCode.value,
			minOrderAmount: discountCode.minOrderAmount,
			appliesTo: discountCode.appliesTo,
			startsAt: discountCode.startsAt,
			expiresAt: discountCode.expiresAt,
			usageLimit: discountCode.usageLimit,
			usedCount: discountCode.usedCount,
			isActive: discountCode.isActive,
			given: sql<number>`(select coalesce(sum(${discountRedemption.amount}), 0) from ${discountRedemption} where ${discountRedemption.discountCodeId} = ${discountCode.id})`.mapWith(Number),
			createdById: discountCode.createdBy,
			createdBy: creator.name
		})
		.from(discountCode)
		.leftJoin(creator, eq(discountCode.createdBy, creator.id))
		.where(isNull(discountCode.deletedAt))
		.orderBy(desc(discountCode.id));
	return {
		rows,
		addForm: await superValidate({ kind: 'percent', isActive: true }, zod4(discountSchema), { errors: false })
	};
};

export const actions = {
	add: async (event) => {
		requirePermission(event.locals, 'discounts.manage');
		const form = await superValidate(event.request, zod4(discountSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		if (form.data.kind === 'percent' && form.data.value > 100) {
			setError(form, 'value', 'A percentage is at most 100');
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		}
		try {
			await db.transaction(async (tx) => {
				const [res] = await tx.insert(discountCode).values({
					...(discountRow(form.data) as typeof discountCode.$inferInsert),
					appliesTo: form.data.appliesTo.length ? form.data.appliesTo : null,
					createdBy: event.locals.user?.id
				});
				await recordAudit(tx, event, { table: 'discount_code', recordId: res.insertId, action: 'create' });
			});
		} catch (err) {
			if (!isDuplicateKey(err)) throw err;
			setError(form, 'code', 'This code already exists');
			return message(form, { type: 'error', text: 'This code already exists' }, { status: 400 });
		}
		return message(form, { type: 'success', text: `${form.data.code} added` });
	}
};
