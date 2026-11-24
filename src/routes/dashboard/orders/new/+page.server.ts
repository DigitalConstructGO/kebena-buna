import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import {
	bagSize,
	businessAccount,
	deliveryZone,
	location,
	product,
	productGrind,
	productRoastLevel,
	productVariant,
	wholesaleTier
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import {
	customerOptions,
	grindOptions,
	locationOptions,
	roastLevelOptions
} from '#lib/server/options.ts';
import { owedBy, placeStaffOrder } from '#lib/server/staffOrders.ts';
import { readSetting } from '#lib/server/stockReads.ts';
import { staffOrderSchema } from '#lib/schemas/orders.ts';

/** What can be sold here: switched-on variants, with price, size and the options each allows. */
async function sellable() {
	const [variants, roasts, grinds] = await Promise.all([
		db
			.select({
				value: productVariant.id,
				name: sql<string>`concat(${enOf(product.name)}, ' — ', coalesce(${enOf(bagSize.name)}, ${enOf(productVariant.name)}, ''))`,
				productId: product.id,
				kind: product.kind,
				price: productVariant.price,
				grams: bagSize.grams,
				available:
					sql<number>`(select coalesce(sum(ps.units - ps.reserved_units), 0) from packed_stock ps where ps.variant_id = ${productVariant.id})`.mapWith(
						Number
					)
			})
			.from(productVariant)
			.innerJoin(product, eq(productVariant.productId, product.id))
			.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
			.where(
				and(
					eq(productVariant.isActive, true),
					isNull(productVariant.deletedAt),
					eq(product.isActive, true),
					isNull(product.deletedAt)
				)
			)
			.orderBy(asc(product.sortOrder), asc(productVariant.sortOrder)),
		db
			.select({ productId: productRoastLevel.productId, id: productRoastLevel.roastLevelId })
			.from(productRoastLevel),
		db.select({ productId: productGrind.productId, id: productGrind.grindId }).from(productGrind)
	]);
	return variants.map((v) => ({
		...v,
		price: Number(v.price),
		roasts: roasts.filter((r) => r.productId === v.productId).map((r) => r.id),
		grinds: grinds.filter((g) => g.productId === v.productId).map((g) => g.id)
	}));
}

/** Approved, switched-on business accounts with their terms and what they owe now. */
async function accounts() {
	const rows = await db
		.select({
			value: businessAccount.id,
			name: businessAccount.name,
			discountPct: businessAccount.discountPct,
			creditApproved: businessAccount.creditApproved,
			creditLimit: businessAccount.creditLimit,
			termsDays: businessAccount.paymentTermsDays,
			minOrderKg: businessAccount.minOrderKg
		})
		.from(businessAccount)
		.where(
			and(
				eq(businessAccount.approvalStatus, 'approved'),
				eq(businessAccount.isActive, true),
				isNull(businessAccount.deletedAt)
			)
		)
		.orderBy(asc(businessAccount.name));
	return Promise.all(
		rows.map(async (a) => ({
			...a,
			discountPct: Number(a.discountPct),
			creditLimit: Number(a.creditLimit),
			minOrderKg: a.minOrderKg === null ? null : Number(a.minOrderKg),
			owed: a.creditApproved ? await owedBy(db, a.value) : 0
		}))
	);
}

export const load = async ({ locals, url }) => {
	requirePermission(locals, 'orders.manage');
	const wanted = (name: string) => {
		const v = Number(url.searchParams.get(name));
		return Number.isInteger(v) && v > 0 ? v : undefined;
	};
	const [variants, roastLevels, grinds, customers, business, locations, zones, minKg, tiers] =
		await Promise.all([
			sellable(),
			roastLevelOptions(),
			grindOptions(),
			customerOptions(),
			accounts(),
			locationOptions(sql`${location.holdsStock} or ${location.sellsAtDesk}`),
			db
				.select({ value: deliveryZone.id, name: enOf(deliveryZone.name), fee: deliveryZone.fee })
				.from(deliveryZone)
				.where(isNull(deliveryZone.deletedAt))
				.orderBy(asc(deliveryZone.sortOrder)),
			readSetting('wholesale.min_order_kg', 5),
			db
				.select({
					minKg: wholesaleTier.minKg,
					maxKg: wholesaleTier.maxKg,
					pct: wholesaleTier.discountPct
				})
				.from(wholesaleTier)
				.where(and(eq(wholesaleTier.status, true), isNull(wholesaleTier.deletedAt)))
				.orderBy(asc(wholesaleTier.minKg))
		]);
	// Opened from a customer or a business account: it is for them.
	const accountId = business.some((a) => a.value === wanted('account'))
		? wanted('account')
		: undefined;
	const customerId = customers.some((c) => c.value === wanted('customer'))
		? wanted('customer')
		: undefined;
	return {
		variants,
		roastLevels,
		grinds,
		customers,
		accounts: business,
		locations,
		zones: zones.map((z) => ({ ...z, fee: Number(z.fee) })),
		minKg,
		tiers: tiers.map((t) => ({
			minKg: Number(t.minKg),
			maxKg: t.maxKg === null ? null : Number(t.maxKg),
			pct: Number(t.pct)
		})),
		form: await superValidate(
			{
				channel: accountId ? 'wholesale' : 'desk',
				businessAccountId: accountId,
				customerId,
				locationId: locations[0]?.value,
				deliveryMethod: 'none',
				lines: [{ variantId: undefined, roastLevelId: null, grindId: null, quantity: 1 }]
			},
			zod4(staffOrderSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	default: async (event) => {
		requirePermission(event.locals, 'orders.manage');
		const form = await superValidate(event.request, zod4(staffOrderSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		let placed: Awaited<ReturnType<typeof placeStaffOrder>>;
		try {
			placed = await db.transaction((tx) => placeStaffOrder(tx, event, form.data));
		} catch (err) {
			if (!(err instanceof WriteRefused)) throw err;
			if (err.field && err.field in form.data) setError(form, err.field as never, err.message);
			return message(form, { type: 'error', text: err.message }, { status: 400 });
		}
		redirect(
			`/dashboard/orders/${placed.id}`,
			{
				type: 'success',
				message: placed.invoiceNumber
					? `${placed.number} sent on credit — invoice ${placed.invoiceNumber}`
					: `${placed.number} placed`
			},
			event.cookies
		);
	}
};
