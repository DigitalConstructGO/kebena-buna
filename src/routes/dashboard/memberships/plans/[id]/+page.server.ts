import { error } from '@sveltejs/kit';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { db } from '#lib/server/db/index.ts';
import {
	customer,
	membership,
	membershipPlan,
	product,
	productVariant,
	taxRate
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';

async function loadPlan(raw: string) {
	const id = idParam(raw, 'Plan');
	const [row] = await db
		.select({
			plan: membershipPlan,
			tax: enOf(taxRate.name),
			variant: productVariant.sku,
			productId: productVariant.productId,
			product: enOf(product.name)
		})
		.from(membershipPlan)
		.leftJoin(taxRate, eq(membershipPlan.taxRateId, taxRate.id))
		.leftJoin(productVariant, eq(membershipPlan.monthlyCoffeeVariantId, productVariant.id))
		.leftJoin(product, eq(productVariant.productId, product.id))
		.where(and(eq(membershipPlan.id, id), isNull(membershipPlan.deletedAt)));
	if (!row) error(404, 'Plan not found');
	return row;
}

export const load = async ({ params, locals }) => {
	const row = await loadPlan(params.id);
	const p = row.plan;
	const [byStatus, recent, stamps] = await Promise.all([
		db
			.select({ status: membership.status, count: count() })
			.from(membership)
			.where(and(eq(membership.planId, p.id), isNull(membership.deletedAt)))
			.groupBy(membership.status),
		db
			.select({
				id: membership.id,
				number: membership.number,
				customerId: membership.customerId,
				customer: customer.name,
				status: membership.status,
				startsOn: membership.startsOn,
				endsOn: membership.endsOn
			})
			.from(membership)
			.innerJoin(customer, eq(membership.customerId, customer.id))
			.where(and(eq(membership.planId, p.id), isNull(membership.deletedAt)))
			.orderBy(desc(membership.id))
			.limit(100),
		stampsOf(p)
	]);
	return {
		plan: p,
		tax: row.tax,
		variant: row.variant ? `${row.product} — ${row.variant}` : null,
		variantId: p.monthlyCoffeeVariantId,
		byStatus,
		recent,
		stamps,
		canManage: hasPermission(locals, 'memberships.manage')
	};
};

export const actions = {
	delete: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const { plan } = await loadPlan(event.params.id);
		const [used] = await db
			.select({ id: membership.id })
			.from(membership)
			.where(eq(membership.planId, plan.id))
			.limit(1);
		if (used)
			return {
				message: {
					type: 'error',
					text: 'Memberships were sold on this plan: switch it off instead.'
				}
			};
		await db
			.update(membershipPlan)
			.set(deletionStamp(event.locals.user?.id))
			.where(eq(membershipPlan.id, plan.id));
		redirect(
			'/dashboard/memberships/plans',
			{ type: 'success', message: 'Plan deleted' },
			event.cookies
		);
	}
};
