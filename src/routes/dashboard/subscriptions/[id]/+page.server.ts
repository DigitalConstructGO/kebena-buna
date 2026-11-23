import { error } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod/v4';
import { localToday } from '@nahu/admin-kit/time';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import type { Writer } from '@nahu/admin-kit/server/db';
import { db } from '#lib/server/db/index.ts';
import {
	bagSize,
	customer,
	customerAddress,
	deliveryZone,
	grind,
	membership,
	order,
	orderLine,
	product,
	productVariant,
	roastLevel,
	subscription,
	subscriptionBundle,
	subscriptionDelivery,
	subscriptionPlan
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stampsOf, userAlias } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import {
	deliveryZoneOptions,
	grindOptions,
	roastLevelOptions,
	variantOptions
} from '#lib/server/options.ts';
import { addMonths, addressOptions } from '#lib/server/memberships.ts';
import { formatDate, humanize } from '#lib/format.ts';
import type { SubscriptionStatus } from '#lib/constants.ts';
import {
	pauseSchema,
	subscriptionCancelSchema,
	subscriptionEditSchema
} from '#lib/schemas/memberships.ts';

async function loadSubscription(raw: string) {
	const id = idParam(raw, 'Subscription');
	const [row] = await db
		.select({
			s: subscription,
			customer: customer.name,
			customerPhone: customer.phone,
			membership: membership.number,
			productId: product.id,
			product: enOf(product.name),
			size: enOf(bagSize.name),
			sku: productVariant.sku,
			price: productVariant.price,
			roast: enOf(roastLevel.name),
			grind: enOf(grind.name),
			address: sql<
				string | null
			>`concat(${customerAddress.line1}, coalesce(concat(' · ', ${customerAddress.landmark}), ''))`,
			zone: enOf(deliveryZone.name)
		})
		.from(subscription)
		.innerJoin(customer, eq(subscription.customerId, customer.id))
		.innerJoin(productVariant, eq(subscription.variantId, productVariant.id))
		.innerJoin(product, eq(productVariant.productId, product.id))
		.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
		.innerJoin(roastLevel, eq(subscription.roastLevelId, roastLevel.id))
		.leftJoin(grind, eq(subscription.grindId, grind.id))
		.leftJoin(membership, eq(subscription.membershipId, membership.id))
		.leftJoin(customerAddress, eq(subscription.addressId, customerAddress.id))
		.leftJoin(deliveryZone, eq(subscription.deliveryZoneId, deliveryZone.id))
		.where(and(eq(subscription.id, id), isNull(subscription.deletedAt)));
	if (!row) error(404, 'Subscription not found');
	return row;
}

const skipper = userAlias('skipper');

export const load = async ({ params, locals }) => {
	const row = await loadSubscription(params.id);
	const sub = row.s;
	const [bundles, deliveries, stamps, variants, roasts, grinds, zones, addresses] =
		await Promise.all([
			db
				.select({
					id: subscriptionBundle.id,
					planId: subscriptionBundle.planId,
					plan: enOf(subscriptionPlan.name),
					deliveries: subscriptionBundle.deliveries,
					discountPct: subscriptionBundle.discountPct,
					pricePerDelivery: subscriptionBundle.pricePerDelivery,
					orderId: orderLine.orderId,
					orderNumber: order.number,
					purchasedAt: subscriptionBundle.purchasedAt
				})
				.from(subscriptionBundle)
				.leftJoin(subscriptionPlan, eq(subscriptionBundle.planId, subscriptionPlan.id))
				.leftJoin(orderLine, eq(subscriptionBundle.orderLineId, orderLine.id))
				.leftJoin(order, eq(orderLine.orderId, order.id))
				.where(eq(subscriptionBundle.subscriptionId, sub.id))
				.orderBy(asc(subscriptionBundle.purchasedAt)),
			db
				.select({
					id: subscriptionDelivery.id,
					sequence: subscriptionDelivery.sequence,
					roastDate: subscriptionDelivery.roastDate,
					status: subscriptionDelivery.status,
					orderId: subscriptionDelivery.orderId,
					orderNumber: order.number,
					orderStatus: order.status,
					skippedAt: subscriptionDelivery.skippedAt,
					skippedById: subscriptionDelivery.skippedBy,
					skippedBy: skipper.name
				})
				.from(subscriptionDelivery)
				.leftJoin(order, eq(subscriptionDelivery.orderId, order.id))
				.leftJoin(skipper, eq(subscriptionDelivery.skippedBy, skipper.id))
				.where(eq(subscriptionDelivery.subscriptionId, sub.id))
				.orderBy(asc(subscriptionDelivery.sequence)),
			stampsOf(sub),
			variantOptions(),
			roastLevelOptions(),
			grindOptions(),
			deliveryZoneOptions(),
			addressOptions(sub.customerId)
		]);
	return {
		sub,
		info: row,
		bundles,
		deliveries,
		stamps,
		today: localToday(),
		options: { variants, roasts, grinds, zones, addresses },
		canManage: hasPermission(locals, 'memberships.manage'),
		editForm: await superValidate(
			{
				frequency: sub.frequency,
				variantId: sub.variantId,
				roastLevelId: sub.roastLevelId,
				grindId: sub.grindId,
				quantity: sub.quantity,
				addressId: sub.addressId,
				deliveryZoneId: sub.deliveryZoneId,
				nextRoastDate: sub.nextRoastDate
			},
			zod4(subscriptionEditSchema),
			{ errors: false, id: 'edit' }
		),
		pauseForm: await superValidate(
			{ pausedUntil: sub.pausedUntil ?? undefined },
			zod4(pauseSchema),
			{ errors: false, id: 'pause' }
		),
		cancelForm: await superValidate(zod4(subscriptionCancelSchema), { id: 'cancel' })
	};
};

/**
 * The first delivery still scheduled becomes the subscription's next roast date, and the prepaid
 * deliveries used are the ones ordered or delivered. A skipped one is not used: it stays prepaid,
 * as Skip and Pause promise, so it still counts as left (and is settled on cancel).
 */
async function refreshNext(tx: Writer, id: number) {
	const [next] = await tx
		.select({ roastDate: subscriptionDelivery.roastDate })
		.from(subscriptionDelivery)
		.where(
			and(eq(subscriptionDelivery.subscriptionId, id), eq(subscriptionDelivery.status, 'scheduled'))
		)
		.orderBy(asc(subscriptionDelivery.roastDate))
		.limit(1);
	const [used] = await tx
		.select({ n: sql<number>`count(*)`.mapWith(Number) })
		.from(subscriptionDelivery)
		.where(
			and(
				eq(subscriptionDelivery.subscriptionId, id),
				inArray(subscriptionDelivery.status, ['delivered', 'ordered'])
			)
		);
	await tx
		.update(subscription)
		.set({ nextRoastDate: next?.roastDate ?? null, deliveriesUsed: used.n })
		.where(eq(subscription.id, id));
}

/** The subscription locked for a change, or the reason it cannot take one in its status. */
async function lockOpen(
	tx: Writer,
	id: number,
	allowed: readonly SubscriptionStatus[],
	doing: string
) {
	const [s] = await tx.select().from(subscription).where(eq(subscription.id, id)).for('update');
	if (!allowed.includes(s.status))
		return { s, refusal: `A ${humanize(s.status).toLowerCase()} subscription cannot be ${doing}` };
	return { s, refusal: null };
}

const deliveryField = z.object({ deliveryId: z.coerce.number().int().positive() });

async function setDelivery(event: RequestEvent, skip: boolean) {
	requirePermission(event.locals, 'memberships.manage');
	const { s: loaded } = await loadSubscription(event.params.id);
	const parsed = deliveryField.safeParse(Object.fromEntries(await event.request.formData()));
	if (!parsed.success) return { message: { type: 'error', text: 'Which delivery?' } };
	const refusal = await db.transaction(async (tx) => {
		// A cancelled or completed subscription sends nothing more: its deliveries stay as they are.
		const { refusal } = await lockOpen(tx, loaded.id, ['active', 'paused'], 'changed');
		if (refusal) return refusal;
		const updated = await tx
			.update(subscriptionDelivery)
			.set(
				skip
					? { status: 'skipped', skippedAt: new Date(), skippedBy: event.locals.user?.id }
					: { status: 'scheduled', skippedAt: null, skippedBy: null }
			)
			.where(
				and(
					eq(subscriptionDelivery.id, parsed.data.deliveryId),
					eq(subscriptionDelivery.subscriptionId, loaded.id),
					eq(subscriptionDelivery.status, skip ? 'scheduled' : 'skipped'),
					// Only a roast day still ahead can be skipped or brought back.
					gt(subscriptionDelivery.roastDate, localToday())
				)
			);
		if (!updated[0].affectedRows) return 'That delivery can no longer change.';
		await refreshNext(tx, loaded.id);
		return null;
	});
	if (refusal) return { message: { type: 'error', text: refusal } };
	return { message: { type: 'success', text: skip ? 'Delivery skipped' : 'Delivery back on' } };
}

/** The longest pause (7.5). */
const MAX_PAUSE_MONTHS = 3;

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const form = await superValidate(event.request, zod4(subscriptionEditSchema), { id: 'edit' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { s: before } = await loadSubscription(event.params.id);
		await db.transaction(async (tx) => {
			await tx
				.update(subscription)
				.set({ ...form.data, updatedBy: event.locals.user?.id })
				.where(eq(subscription.id, before.id));
			await recordAudit(tx, event, {
				table: 'subscription',
				recordId: before.id,
				action: 'update',
				before,
				after: form.data
			});
		});
		return message(form, { type: 'success', text: 'Subscription saved' });
	},
	pause: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const form = await superValidate(event.request, zod4(pauseSchema), { id: 'pause' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Choose a date' }, { status: 400 });
		const { pausedUntil } = form.data;
		const today = localToday();
		const latest = addMonths(today, MAX_PAUSE_MONTHS);
		if (pausedUntil <= today || pausedUntil > latest) {
			const text = `Pause until a day after today and no later than ${formatDate(latest)}`;
			setError(form, 'pausedUntil', text);
			return message(form, { type: 'error', text }, { status: 400 });
		}
		const { s: loaded } = await loadSubscription(event.params.id);
		const refusal = await db.transaction(async (tx) => {
			const { s, refusal } = await lockOpen(tx, loaded.id, ['active'], 'paused');
			if (refusal) return refusal;
			await tx
				.update(subscription)
				.set({ status: 'paused', pausedUntil, updatedBy: event.locals.user?.id })
				.where(eq(subscription.id, s.id));
			// Roast days inside the pause are skipped, not lost: they stay prepaid.
			await tx
				.update(subscriptionDelivery)
				.set({ status: 'skipped', skippedAt: new Date(), skippedBy: event.locals.user?.id })
				.where(
					and(
						eq(subscriptionDelivery.subscriptionId, s.id),
						eq(subscriptionDelivery.status, 'scheduled'),
						gt(subscriptionDelivery.roastDate, today),
						lte(subscriptionDelivery.roastDate, pausedUntil)
					)
				);
			await refreshNext(tx, s.id);
			await recordAudit(tx, event, {
				table: 'subscription',
				recordId: s.id,
				action: 'update',
				before: s,
				after: { status: 'paused', pausedUntil }
			});
			return null;
		});
		if (refusal) return message(form, { type: 'error', text: refusal }, { status: 400 });
		return message(form, { type: 'success', text: 'Subscription paused' });
	},
	resume: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const { s: loaded } = await loadSubscription(event.params.id);
		const refusal = await db.transaction(async (tx) => {
			const { s, refusal } = await lockOpen(tx, loaded.id, ['paused'], 'resumed');
			if (refusal) return refusal;
			await tx
				.update(subscription)
				.set({ status: 'active', pausedUntil: null, updatedBy: event.locals.user?.id })
				.where(eq(subscription.id, s.id));
			await recordAudit(tx, event, {
				table: 'subscription',
				recordId: s.id,
				action: 'update',
				before: s,
				after: { status: 'active', pausedUntil: null }
			});
			return null;
		});
		if (refusal) return { message: { type: 'error', text: refusal } };
		return { message: { type: 'success', text: `${loaded.number} is active again` } };
	},
	cancel: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const form = await superValidate(event.request, zod4(subscriptionCancelSchema), {
			id: 'cancel'
		});
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { s: loaded } = await loadSubscription(event.params.id);
		const refusal = await db.transaction(async (tx) => {
			const { s, refusal } = await lockOpen(
				tx,
				loaded.id,
				['pending_payment', 'active', 'paused'],
				'cancelled'
			);
			if (refusal) return refusal;
			await tx
				.update(subscription)
				.set({
					status: 'cancelled',
					cancelledAt: new Date(),
					unusedSettlement: form.data.unusedSettlement,
					nextRoastDate: null,
					updatedBy: event.locals.user?.id
				})
				.where(eq(subscription.id, s.id));
			// Every roast day still to come is off, skipped ones too, so none can be brought back.
			await tx
				.update(subscriptionDelivery)
				.set({ status: 'cancelled' })
				.where(
					and(
						eq(subscriptionDelivery.subscriptionId, s.id),
						or(
							eq(subscriptionDelivery.status, 'scheduled'),
							and(
								eq(subscriptionDelivery.status, 'skipped'),
								gt(subscriptionDelivery.roastDate, localToday())
							)
						)
					)
				);
			await recordAudit(tx, event, {
				table: 'subscription',
				recordId: s.id,
				action: 'update',
				before: s,
				after: { status: 'cancelled', unusedSettlement: form.data.unusedSettlement },
				detail: form.data.note ? { note: form.data.note } : undefined
			});
			return null;
		});
		if (refusal) return message(form, { type: 'error', text: refusal }, { status: 400 });
		return message(form, { type: 'success', text: `${loaded.number} cancelled` });
	},
	skip: async (event) => setDelivery(event, true),
	unskip: async (event) => setDelivery(event, false)
};
