import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, isNull, notInArray } from 'drizzle-orm';
import { message, setError, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { fromLocal, localClock, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import {
	bookable,
	bundle,
	booking,
	bookingSession,
	businessAccount,
	courier,
	customer,
	deliveryZone,
	discountCode,
	event as eventTable,
	grind,
	invoice,
	location,
	membership,
	membershipPlan,
	order,
	orderLine,
	orderStatusHistory,
	payment,
	productVariant,
	refund,
	roastBatch,
	roastLevel,
	subscription,
	ticket,
	ticketType
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stampsOf, staffOptions, userAlias } from '#lib/server/people.ts';
import { courierOptions } from '#lib/server/options.ts';
import { idParam } from '#lib/server/records.ts';
import {
	canCancel,
	hasRefundableMoney,
	moveOrder,
	nextStatuses,
	recordOrderPayment,
	refundable,
	refundClaims,
	requestRefund
} from '#lib/server/orders.ts';
import { cancelTicket } from '#lib/server/visits.ts';
import { changeWorkflow } from '#lib/server/bookings.ts';
import {
	cancelSchema,
	orderDeliverySchema,
	orderStatusSchema,
	paymentSchema,
	refundRequestSchema
} from '#lib/schemas/orders.ts';
import { tr } from '#lib/format.ts';

async function loadOrder(raw: string) {
	const id = idParam(raw, 'Order');
	const [o] = await db.select().from(order).where(and(eq(order.id, id), isNull(order.deletedAt)));
	if (!o) error(404, 'Order not found');
	return o;
}

const changer = userAlias('changer');
const recorder = userAlias('recorder');
const requester = userAlias('requester');
const approver = userAlias('approver');
const riderUser = userAlias('rider');

/** What each line sold, as the record it links to: `[entity, id, name]`. */
function soldAs(l: {
	itemType: string;
	variantId: number | null;
	sku: string | null;
	ticketTypeId: number | null;
	ticketTypeName: unknown;
	eventId: number | null;
	eventTitle: unknown;
	bookableId: number | null;
	bookableName: unknown;
	membershipPlanId: number | null;
	planName: unknown;
	subscriptionId: number | null;
	subscriptionNumber: string | null;
}): { entity: string; id: number | null; name: string } | null {
	const t = (v: unknown) => tr(v as Record<string, string>);
	switch (l.itemType) {
		case 'product':
			return { entity: 'variant', id: l.variantId, name: l.sku ?? 'Variant' };
		case 'ticket':
		case 'ticket_upgrade':
			return { entity: 'ticketType', id: l.ticketTypeId, name: t(l.ticketTypeName) || 'Ticket type' };
		case 'event_ticket':
			return { entity: 'event', id: l.eventId, name: t(l.eventTitle) || 'Event' };
		case 'booking':
			return { entity: 'bookable', id: l.bookableId, name: t(l.bookableName) || 'Booking' };
		case 'membership':
			return { entity: 'membershipPlan', id: l.membershipPlanId, name: t(l.planName) || 'Membership' };
		case 'subscription_bundle':
			return { entity: 'subscription', id: l.subscriptionId, name: l.subscriptionNumber ?? 'Subscription' };
		default:
			return null;
	}
}

export const load = async ({ params, locals }) => {
	const o = await loadOrder(params.id);

	const [
		[related],
		lineRows,
		history,
		payments,
		refunds,
		invoices,
		tickets,
		stamps,
		riders,
		couriers,
		claims
	] = await Promise.all([
		db
			.select({
				customer: customer.name,
				customerPhone: customer.phone,
				business: businessAccount.name,
				zone: enOf(deliveryZone.name),
				courier: courier.name,
				courierTemplate: courier.trackingUrlTemplate,
				discountCode: discountCode.code,
				rider: riderUser.name,
				membershipNumber: membership.number
			})
			.from(order)
			.innerJoin(customer, eq(order.customerId, customer.id))
			.leftJoin(businessAccount, eq(order.businessAccountId, businessAccount.id))
			.leftJoin(deliveryZone, eq(order.deliveryZoneId, deliveryZone.id))
			.leftJoin(courier, eq(order.courierId, courier.id))
			.leftJoin(discountCode, eq(order.discountCodeId, discountCode.id))
			.leftJoin(riderUser, eq(order.riderId, riderUser.id))
			.leftJoin(membership, eq(order.membershipId, membership.id))
			.where(eq(order.id, o.id)),
		db
			.select({
				line: orderLine,
				roastLevel: enOf(roastLevel.name),
				grind: enOf(grind.name),
				roastBatchCode: roastBatch.code,
				ticketTypeName: ticketType.name,
				eventTitle: eventTable.title,
				bookableName: bookable.name,
				sessionStartsAt: bookingSession.startsAt,
				planName: membershipPlan.name,
				subscriptionNumber: subscription.number,
				variantSku: productVariant.sku,
				bundleName: enOf(bundle.name)
			})
			.from(orderLine)
			.leftJoin(roastLevel, eq(orderLine.roastLevelId, roastLevel.id))
			.leftJoin(grind, eq(orderLine.grindId, grind.id))
			.leftJoin(roastBatch, eq(orderLine.roastBatchId, roastBatch.id))
			.leftJoin(ticketType, eq(orderLine.ticketTypeId, ticketType.id))
			.leftJoin(eventTable, eq(orderLine.eventId, eventTable.id))
			.leftJoin(bookable, eq(orderLine.bookableId, bookable.id))
			.leftJoin(bookingSession, eq(orderLine.bookingSessionId, bookingSession.id))
			.leftJoin(membershipPlan, eq(orderLine.membershipPlanId, membershipPlan.id))
			.leftJoin(subscription, eq(orderLine.subscriptionId, subscription.id))
			.leftJoin(productVariant, eq(orderLine.variantId, productVariant.id))
			.leftJoin(bundle, eq(orderLine.bundleId, bundle.id))
			.where(eq(orderLine.orderId, o.id))
			.orderBy(asc(orderLine.id)),
		db
			.select({
				id: orderStatusHistory.id,
				fromStatus: orderStatusHistory.fromStatus,
				toStatus: orderStatusHistory.toStatus,
				note: orderStatusHistory.note,
				notified: orderStatusHistory.notified,
				createdAt: orderStatusHistory.createdAt,
				byId: orderStatusHistory.changedBy,
				by: changer.name
			})
			.from(orderStatusHistory)
			.leftJoin(changer, eq(orderStatusHistory.changedBy, changer.id))
			.where(eq(orderStatusHistory.orderId, o.id))
			.orderBy(desc(orderStatusHistory.createdAt), desc(orderStatusHistory.id)),
		db
			.select({
				id: payment.id,
				provider: payment.provider,
				method: payment.method,
				status: payment.status,
				amount: payment.amount,
				txRef: payment.txRef,
				reference: payment.reference,
				invoiceId: payment.invoiceId,
				paidAt: payment.paidAt,
				createdAt: payment.createdAt,
				byId: payment.recordedBy,
				by: recorder.name
			})
			.from(payment)
			.leftJoin(recorder, eq(payment.recordedBy, recorder.id))
			.where(eq(payment.orderId, o.id))
			.orderBy(desc(payment.createdAt)),
		db
			.select({
				id: refund.id,
				status: refund.status,
				amount: refund.amount,
				reason: refund.reason,
				toStoreCredit: refund.toStoreCredit,
				createdAt: refund.createdAt,
				requestedById: refund.requestedBy,
				requestedBy: requester.name,
				approvedById: refund.approvedBy,
				approvedBy: approver.name
			})
			.from(refund)
			.leftJoin(requester, eq(refund.requestedBy, requester.id))
			.leftJoin(approver, eq(refund.approvedBy, approver.id))
			.where(eq(refund.orderId, o.id))
			.orderBy(desc(refund.createdAt)),
		db
			.select({
				id: invoice.id,
				number: invoice.number,
				status: invoice.status,
				total: invoice.total,
				amountPaid: invoice.amountPaid,
				dueOn: invoice.dueOn
			})
			.from(invoice)
			.where(eq(invoice.orderId, o.id)),
		db
			.select({
				id: ticket.id,
				code: ticket.code,
				visitDate: ticket.visitDate,
				status: ticket.status,
				holderName: ticket.holderName,
				admits: ticket.admits
			})
			.from(ticket)
			.where(eq(ticket.orderId, o.id)),
		stampsOf(o),
		staffOptions(),
		courierOptions(),
		refundClaims(db, o.id)
	]);

	// Where it is collected, or where it was sold / ships from.
	const placeId = o.pickupLocationId ?? o.locationId;
	const pickup = placeId
		? await db.select({ id: location.id, name: enOf(location.name) }).from(location).where(eq(location.id, placeId))
		: [];

	const lines = lineRows.map((r) => ({
		...r.line,
		// A bag bought in a bundle says so; the bundle's saving is in its discount.
		description: r.line.bundleId
			? `${tr(r.line.description)} — in ${r.bundleName}${r.line.bundleGroup && r.line.bundleGroup > 1 ? ` (#${r.line.bundleGroup})` : ''}`
			: tr(r.line.description),
		roastLevel: r.roastLevel,
		grind: r.grind,
		roastBatchCode: r.roastBatchCode,
		sessionStartsAt: r.sessionStartsAt,
		sold: soldAs({
			...r.line,
			sku: r.variantSku ?? r.line.sku,
			ticketTypeName: r.ticketTypeName,
			eventTitle: r.eventTitle,
			bookableName: r.bookableName,
			planName: r.planName,
			subscriptionNumber: r.subscriptionNumber
		})
	}));
	const hasRoast = lineRows.some((r) => r.line.fulfilment === 'roast_to_order');
	const open = refundable(
		lineRows.map((r) => r.line),
		claims.pending
	);
	const next = nextStatuses(o, hasRoast);

	return {
		order: o,
		related: related!,
		place: pickup[0] ?? null,
		lines,
		history,
		payments,
		refunds,
		invoices,
		tickets,
		stamps,
		next,
		cancellable: canCancel(o.status),
		// Paid money not yet given back or claimed by a refund in flight — part-paid and cancelled
		// orders included.
		refundable: hasRefundableMoney(o) && Number(o.amountPaid) - claims.amount > 0.005,
		balance: Math.max(0, Number(o.total) - Number(o.amountPaid)),
		options: {
			riders,
			couriers,
			refundLines: open.map((l) => ({
				value: l.line.id,
				name: `${tr(l.line.description)} — ${l.left} left`
			}))
		},
		canManage: hasPermission(locals, 'orders.manage'),
		canRefund: hasPermission(locals, 'refunds.manage'),
		statusForm: await superValidate({ status: next[0] }, zod4(orderStatusSchema), { id: 'status', errors: false }),
		deliveryForm: await superValidate(
			{
				riderId: o.riderId,
				courierId: o.courierId,
				trackingNumber: o.trackingNumber,
				expectedDispatchOn: o.expectedDispatchOn,
				staffNote: o.staffNote
			},
			zod4(orderDeliverySchema),
			{ id: 'delivery', errors: false }
		),
		paymentForm: await superValidate(
			{
				provider: 'desk_cash',
				amount: Math.max(0, Number(o.total) - Number(o.amountPaid)),
				paidOn: localToday()
			},
			zod4(paymentSchema),
			{ id: 'payment', errors: false }
		),
		cancelForm: await superValidate(zod4(cancelSchema), { id: 'cancel', errors: false }),
		refundForm: await superValidate({ whole: false }, zod4(refundRequestSchema), { id: 'refund', errors: false })
	};
};

/** A refusal shown on the form it came from, under its field when it names one. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function refused(form: SuperValidated<any, any>, err: unknown) {
	if (!(err instanceof WriteRefused)) throw err;
	if (err.field) setError(form, err.field as never, err.message);
	return message(form, { type: 'error', text: err.message }, { status: 400 });
}

export const actions = {
	status: async (event) => {
		requirePermission(event.locals, 'orders.manage');
		const form = await superValidate(event.request, zod4(orderStatusSchema), { id: 'status' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const o = await loadOrder(event.params.id);
		try {
			await db.transaction((tx) =>
				moveOrder(tx, event, o, form.data.status, { note: form.data.note, notified: form.data.notified })
			);
		} catch (err) {
			return refused(form, err);
		}
		return message(form, { type: 'success', text: `Order is now ${form.data.status.replaceAll('_', ' ')}` });
	},
	delivery: async (event) => {
		requirePermission(event.locals, 'orders.manage');
		const form = await superValidate(event.request, zod4(orderDeliverySchema), { id: 'delivery' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const o = await loadOrder(event.params.id);
		const values = { ...form.data, updatedBy: event.locals.user?.id ?? null };
		await db.transaction(async (tx) => {
			await tx.update(order).set(values).where(eq(order.id, o.id));
			await recordAudit(tx, event, { table: 'orders', recordId: o.id, action: 'update', before: o, after: values });
		});
		return message(form, { type: 'success', text: 'Delivery details saved' });
	},
	payment: async (event) => {
		requirePermission(event.locals, 'orders.manage');
		const form = await superValidate(event.request, zod4(paymentSchema), { id: 'payment' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const o = await loadOrder(event.params.id);
		try {
			await db.transaction((tx) =>
				recordOrderPayment(tx, event, o, {
					provider: form.data.provider,
					amount: form.data.amount,
					reference: form.data.reference,
					paidAt: fromLocal(form.data.paidOn, localClock(new Date()))
				})
			);
		} catch (err) {
			return refused(form, err);
		}
		return message(form, { type: 'success', text: 'Payment recorded' });
	},
	cancel: async (event) => {
		requirePermission(event.locals, 'orders.manage');
		const form = await superValidate(event.request, zod4(cancelSchema), { id: 'cancel' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const o = await loadOrder(event.params.id);
		const userId = event.locals.user?.id;
		const note = `${o.number} cancelled: ${form.data.reason}`.slice(0, 255);
		try {
			await db.transaction(async (tx) => {
				// Re-read locked, so a double-submitted cancel happens once.
				const [cur] = await tx.select().from(order).where(eq(order.id, o.id)).for('update');
				if (!canCancel(cur.status)) throw new WriteRefused(null, 'This order has left the building and cannot be cancelled.');
				await moveOrder(tx, event, cur, 'cancelled', {
					force: true,
					note: form.data.reason,
					extra: { cancelReason: form.data.reason }
				});
				// What the order bought goes with it: its bookings stop holding their place…
				const bookings = await tx
					.select({ id: booking.id })
					.from(booking)
					.where(and(eq(booking.orderId, o.id), notInArray(booking.status, ['cancelled', 'declined', 'done']), isNull(booking.deletedAt)));
				for (const b of bookings) await changeWorkflow(tx, { bookingId: b.id }, 'cancelled', note, userId);
				// …and its memberships end.
				const memberships = await tx
					.select({ m: membership })
					.from(membership)
					.innerJoin(orderLine, eq(membership.orderLineId, orderLine.id))
					.where(and(eq(orderLine.orderId, o.id), notInArray(membership.status, ['cancelled', 'lapsed'])));
				for (const { m } of memberships) {
					const values = { status: 'cancelled' as const, cancelledAt: new Date(), cancelReason: note, updatedBy: userId };
					await tx.update(membership).set(values).where(eq(membership.id, m.id));
					await recordAudit(tx, event, { table: 'membership', recordId: m.id, action: 'update', before: m, after: values });
				}
			});
		} catch (err) {
			return refused(form, err);
		}
		// Its unused tickets are cancelled and their places go back. `cancelTicket` runs its own
		// transaction, so this follows the order's; one used meanwhile is left as it is.
		const tickets = await db
			.select({ id: ticket.id })
			.from(ticket)
			.where(and(eq(ticket.orderId, o.id), eq(ticket.status, 'valid')));
		for (const t of tickets) {
			try {
				await cancelTicket(event, t.id, note);
			} catch (err) {
				if (!(err instanceof WriteRefused)) throw err;
			}
		}
		const paid = Number(o.amountPaid) > 0;
		return message(form, {
			type: 'success',
			text: paid ? 'Order cancelled — request a refund for what was paid.' : 'Order cancelled'
		});
	},
	refund: async (event) => {
		requirePermission(event.locals, 'refunds.manage');
		const form = await superValidate(event.request, zod4(refundRequestSchema), { id: 'refund' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const o = await loadOrder(event.params.id);
		try {
			await db.transaction((tx) =>
				requestRefund(tx, event, o.id, {
					whole: form.data.whole,
					orderLineId: form.data.orderLineId,
					quantity: form.data.quantity ?? null,
					restock: form.data.restock,
					toStoreCredit: form.data.toStoreCredit,
					feeRetained: form.data.feeRetained,
					reason: form.data.reason
				})
			);
		} catch (err) {
			return refused(form, err);
		}
		return message(form, { type: 'success', text: 'Refund requested — it needs approval.' });
	}
};
