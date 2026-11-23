import { error } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import {
	courier,
	customer,
	deliveryZone,
	grind,
	location,
	order,
	orderLine,
	packaging,
	roastLevel,
	user
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { readSetting } from '#lib/server/stockReads.ts';

/**
 * Packing slips: what goes in the bag and where it goes, one page per order, no prices — for the
 * packing bench and to travel with the parcel. `?ids=1,2,3` prints several at once (the orders list
 * sends the ticked ones); the order page sends its own.
 */
export const load = async ({ url, locals }) => {
	requirePermission(locals, 'orders.view');
	const ids = [
		...new Set(
			(url.searchParams.get('ids') ?? '')
				.split(',')
				.map(Number)
				.filter((n) => Number.isInteger(n) && n > 0)
		)
	].slice(0, 100);
	if (!ids.length) error(400, 'No orders chosen to print');

	const pickup = location;
	const [orders, lines, [shop], tin] = await Promise.all([
		db
			.select({
				id: order.id,
				number: order.number,
				placedAt: order.placedAt,
				status: order.status,
				deliveryMethod: order.deliveryMethod,
				address: order.deliveryAddress,
				customerNote: order.customerNote,
				customer: customer.name,
				phone: customer.phone,
				zone: enOf(deliveryZone.name),
				courier: courier.name,
				trackingNumber: order.trackingNumber,
				rider: user.name,
				pickupAt: enOf(pickup.name)
			})
			.from(order)
			.innerJoin(customer, eq(order.customerId, customer.id))
			.leftJoin(deliveryZone, eq(order.deliveryZoneId, deliveryZone.id))
			.leftJoin(courier, eq(order.courierId, courier.id))
			.leftJoin(user, eq(order.riderId, user.id))
			.leftJoin(pickup, eq(order.pickupLocationId, pickup.id))
			.where(and(inArray(order.id, ids), isNull(order.deletedAt))),
		db
			.select({
				orderId: orderLine.orderId,
				description: enOf(orderLine.description),
				sku: orderLine.sku,
				roast: enOf(roastLevel.name),
				grind: enOf(grind.name),
				packaging: enOf(packaging.name),
				quantity: orderLine.quantity,
				refunded: orderLine.refundedQuantity
			})
			.from(orderLine)
			.leftJoin(roastLevel, eq(orderLine.roastLevelId, roastLevel.id))
			.leftJoin(grind, eq(orderLine.grindId, grind.id))
			.leftJoin(packaging, eq(orderLine.packagingId, packaging.id))
			// Only what goes in a bag: tickets, memberships and bookings have nothing to pack.
			.where(and(inArray(orderLine.orderId, ids), eq(orderLine.itemType, 'product')))
			.orderBy(asc(orderLine.id)),
		db
			.select({ address: location.address, phone: location.phone })
			.from(location)
			.where(eq(location.type, 'shop'))
			.limit(1),
		readSetting('receipt.tin', '')
	]);
	if (!orders.length) error(404, 'Those orders were not found');

	// In the order they were asked for, so a printed pile matches the ticked list.
	const byId = new Map(orders.map((o) => [o.id, o]));
	return {
		letterhead: {
			name: 'Kebena Coffee',
			legalName: 'Kebena General Trading PLC',
			tin,
			address: shop?.address ?? null,
			phone: shop?.phone ?? null
		},
		slips: ids
			.map((id) => byId.get(id))
			.filter((o) => o !== undefined)
			.map((o) => ({
				...o,
				lines: lines
					.filter((l) => l.orderId === o.id)
					.map((l) => ({ ...l, quantity: l.quantity - l.refunded }))
					.filter((l) => l.quantity > 0)
			}))
	};
};
