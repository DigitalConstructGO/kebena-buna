import { error } from '@sveltejs/kit';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { db } from '#lib/server/db/index.ts';
import {
	auditLog,
	bagSize,
	customer,
	grind,
	location,
	membershipPlan,
	order,
	orderLine,
	packedStock,
	packingRun,
	product,
	productVariant,
	roastLevel,
	subscription
} from '#lib/server/db/schema.ts';
import { enOf, packLocalized, unpackLocalized } from '#lib/server/localized.ts';
import { stampsOf, userAlias } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { packedLowDefault } from '#lib/server/catalog.ts';
import { bagSizeOptions } from '#lib/server/options.ts';
import { variantEditSchema } from '#lib/schemas/catalog.ts';

async function loadVariant(raw: string | number) {
	const id = idParam(String(raw), 'Variant');
	const [row] = await db
		.select({
			variant: productVariant,
			product: enOf(product.name),
			bagSize: enOf(bagSize.name)
		})
		.from(productVariant)
		.innerJoin(product, eq(productVariant.productId, product.id))
		.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
		.where(and(eq(productVariant.id, id), isNull(productVariant.deletedAt)));
	if (!row) error(404, 'Variant not found');
	return row;
}

const packer = userAlias('packer');
const changer = userAlias('changer');

export const load = async ({ params, locals }) => {
	const row = await loadVariant(params.id);
	const v = row.variant;
	const [runs, stock, lines, subscriptions, plans, prices, stamps, bagSizes, lowDefault] =
		await Promise.all([
			db
				.select({
					id: packingRun.id,
					code: packingRun.code,
					packedAt: packingRun.packedAt,
					roastLevel: enOf(roastLevel.name),
					grind: enOf(grind.name),
					units: packingRun.units,
					bestBefore: packingRun.bestBefore,
					locationId: packingRun.locationId,
					location: enOf(location.name),
					packedById: packingRun.packedBy,
					packedBy: packer.name
				})
				.from(packingRun)
				.innerJoin(roastLevel, eq(packingRun.roastLevelId, roastLevel.id))
				.leftJoin(grind, eq(packingRun.grindId, grind.id))
				.innerJoin(location, eq(packingRun.locationId, location.id))
				.leftJoin(packer, eq(packingRun.packedBy, packer.id))
				.where(and(eq(packingRun.variantId, v.id), isNull(packingRun.deletedAt)))
				.orderBy(desc(packingRun.packedAt))
				.limit(50),
			db
				.select({
					locationId: packedStock.locationId,
					location: enOf(location.name),
					roastLevel: enOf(roastLevel.name),
					packingRunId: packedStock.packingRunId,
					packingRun: packingRun.code,
					units: packedStock.units,
					reserved: packedStock.reservedUnits
				})
				.from(packedStock)
				.innerJoin(location, eq(packedStock.locationId, location.id))
				.innerJoin(roastLevel, eq(packedStock.roastLevelId, roastLevel.id))
				.innerJoin(packingRun, eq(packedStock.packingRunId, packingRun.id))
				.where(and(eq(packedStock.variantId, v.id), sql`${packedStock.units} > 0`)),
			db
				.select({
					orderId: order.id,
					number: order.number,
					placedAt: order.placedAt,
					status: order.status,
					customerId: order.customerId,
					customer: customer.name,
					quantity: orderLine.quantity,
					unitPrice: orderLine.unitPrice,
					lineTotal: orderLine.lineTotal
				})
				.from(orderLine)
				.innerJoin(order, eq(orderLine.orderId, order.id))
				.innerJoin(customer, eq(order.customerId, customer.id))
				.where(eq(orderLine.variantId, v.id))
				.orderBy(desc(order.placedAt))
				.limit(25),
			db
				.select({
					id: subscription.id,
					number: subscription.number,
					customerId: subscription.customerId,
					customer: customer.name,
					status: subscription.status,
					frequency: subscription.frequency,
					quantity: subscription.quantity,
					nextRoastDate: subscription.nextRoastDate
				})
				.from(subscription)
				.innerJoin(customer, eq(subscription.customerId, customer.id))
				.where(and(eq(subscription.variantId, v.id), isNull(subscription.deletedAt)))
				.orderBy(desc(subscription.id)),
			db
				.select({ id: membershipPlan.id, name: enOf(membershipPlan.name) })
				.from(membershipPlan)
				.where(and(eq(membershipPlan.monthlyCoffeeVariantId, v.id), isNull(membershipPlan.deletedAt))),
			db
				.select({
					id: auditLog.id,
					at: auditLog.createdAt,
					changes: auditLog.changes,
					byId: auditLog.userId,
					by: changer.name
				})
				.from(auditLog)
				.leftJoin(changer, eq(auditLog.userId, changer.id))
				.where(
					and(
						eq(auditLog.tableName, 'product_variant'),
						eq(auditLog.recordId, String(v.id)),
						sql`json_contains_path(${auditLog.changes}, 'one', '$.price', '$.compareAtPrice')`
					)
				)
				.orderBy(desc(auditLog.id)),
			stampsOf(v),
			bagSizeOptions(),
			packedLowDefault()
		]);

	const priceChanges = prices.map((p) => {
		const c = (p.changes ?? {}) as Record<string, [unknown, unknown]>;
		return {
			id: p.id,
			at: p.at,
			byId: p.byId,
			by: p.by,
			from: c.price?.[0] ?? null,
			to: c.price?.[1] ?? null,
			wasFrom: c.compareAtPrice?.[0] ?? null,
			wasTo: c.compareAtPrice?.[1] ?? null
		};
	});

	return {
		variant: v,
		product: row.product,
		bagSize: row.bagSize,
		runs,
		stock,
		lines,
		subscriptions,
		plans,
		priceChanges,
		stamps,
		lowAt: v.lowStockUnits ?? lowDefault,
		lowDefault,
		bagSizes,
		canManage: hasPermission(locals, 'catalog.manage'),
		editForm: await superValidate(
			{ ...unpackLocalized(v, ['name']), status: v.isActive },
			zod4(variantEditSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	/** Price and the rest; audited, so the price history below has every change. */
	edit: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const form = await superValidate(event.request, zod4(variantEditSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		// The size is the one in the URL; the form's own id is not trusted to name it.
		const { variant: before } = await loadVariant(event.params.id);
		const id = before.id;
		const { id: _id, status, ...values } = form.data;
		const row = { ...packLocalized({ ...values }, ['name']), isActive: status };
		try {
			await db.transaction(async (tx) => {
				await tx
					.update(productVariant)
					.set({ ...(row as Partial<typeof productVariant.$inferInsert>), updatedBy: event.locals.user?.id })
					.where(eq(productVariant.id, id));
				await recordAudit(tx, event, {
					table: 'product_variant',
					recordId: id,
					action: 'update',
					before,
					after: row
				});
			});
		} catch (err) {
			if (isDuplicateKey(err)) {
				setError(form, 'sku', 'Another size has this SKU, or the product already has this bag size.');
				return message(form, { type: 'error', text: 'Already taken' }, { status: 400 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Saved' });
	}
};
