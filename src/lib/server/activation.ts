/**
 * What a paid order switches on besides tickets: the memberships and coffee subscriptions it
 * bought. Runs inside the payment's transaction (`applyOrderPayment`), so money never lands
 * without the membership or subscription it paid for.
 *
 * A membership starts on the day the buyer chose, or today if that day has passed while it waited
 * for payment. A subscription gets its prepaid deliveries scheduled on roast days (the
 * `roast.weekdays` setting), the first at least two days out so it can still be changed (7.5). A
 * top-up adds its bundle's deliveries to the subscription it was bought for.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { localToday } from '@nahu/admin-kit/time';
import {
	membership,
	orderLine,
	subscription,
	subscriptionBundle,
	subscriptionDelivery
} from '#lib/server/db/schema.ts';
import { addDays, addMonths, termDates } from '#lib/server/memberships.ts';
import { readSetting } from '#lib/server/stockReads.ts';

/** ISO weekday of a `YYYY-MM-DD`: Monday 1 … Sunday 7. */
const isoWeekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() || 7;

/** The first roast day on or after `from`. With no roast days set, `from` itself. */
export function roastDayFrom(from: string, weekdays: number[]) {
	const days = weekdays.filter((d) => d >= 1 && d <= 7);
	if (!days.length) return from;
	for (let i = 0; i < 7; i++) {
		const day = addDays(from, i);
		if (days.includes(isoWeekday(day))) return day;
	}
	return from;
}

/** The roast days of `count` deliveries: every two weeks or every month, each on a roast day. */
export function deliverySchedule(
	first: string,
	count: number,
	frequency: 'biweekly' | 'monthly',
	weekdays: number[]
) {
	const dates: string[] = [];
	for (let n = 0; n < count; n++) {
		const base = frequency === 'biweekly' ? addDays(first, n * 14) : addMonths(first, n);
		dates.push(n === 0 ? first : roastDayFrom(base, weekdays));
	}
	return dates;
}

/** Activates the memberships and subscriptions a now-paid order bought. */
export async function activateOrderItems(tx: Writer, orderId: number) {
	const lines = await tx
		.select({
			id: orderLine.id,
			itemType: orderLine.itemType,
			subscriptionId: orderLine.subscriptionId
		})
		.from(orderLine)
		.where(
			and(
				eq(orderLine.orderId, orderId),
				inArray(orderLine.itemType, ['membership', 'subscription_bundle'])
			)
		);
	if (!lines.length) return;
	const today = localToday();

	const membershipLines = lines.filter((l) => l.itemType === 'membership').map((l) => l.id);
	if (membershipLines.length) {
		const pending = await tx
			.select({ id: membership.id, planId: membership.planId, startsOn: membership.startsOn })
			.from(membership)
			.where(
				and(
					inArray(membership.orderLineId, membershipLines),
					eq(membership.status, 'pending_payment')
				)
			)
			.for('update');
		for (const m of pending) {
			const start = m.startsOn && m.startsOn > today ? m.startsOn : today;
			await tx
				.update(membership)
				.set({ status: 'active', ...(await termDates(m.planId, start)) })
				.where(eq(membership.id, m.id));
		}
	}

	const subscriptionIds = lines
		.filter((l) => l.itemType === 'subscription_bundle' && l.subscriptionId)
		.map((l) => l.subscriptionId as number);
	if (subscriptionIds.length) {
		const weekdays = await readSetting<number[]>('roast.weekdays', [2, 5]);
		// Top-ups (bundles bought for a subscription already running) are read before new ones
		// are switched on below, so a new subscription's own bundle is never taken for one.
		const bundleLines = lines.filter((l) => l.itemType === 'subscription_bundle').map((l) => l.id);
		const topUps = await tx
			.select({ s: subscription, deliveries: subscriptionBundle.deliveries })
			.from(subscriptionBundle)
			.innerJoin(subscription, eq(subscriptionBundle.subscriptionId, subscription.id))
			.where(
				and(
					inArray(subscriptionBundle.orderLineId, bundleLines),
					inArray(subscription.status, ['active', 'paused', 'completed'])
				)
			)
			.for('update');
		const pending = await tx
			.select({
				id: subscription.id,
				frequency: subscription.frequency,
				deliveries: subscription.deliveriesPurchased
			})
			.from(subscription)
			.where(
				and(inArray(subscription.id, subscriptionIds), eq(subscription.status, 'pending_payment'))
			)
			.for('update');
		for (const s of pending) {
			const dates = deliverySchedule(
				roastDayFrom(addDays(today, 2), weekdays),
				s.deliveries,
				s.frequency,
				weekdays
			);
			if (dates.length) {
				await tx
					.insert(subscriptionDelivery)
					.values(
						dates.map((roastDate, i) => ({ subscriptionId: s.id, sequence: i + 1, roastDate }))
					);
			}
			await tx
				.update(subscription)
				.set({ status: 'active', nextRoastDate: dates[0] ?? null })
				.where(eq(subscription.id, s.id));
		}

		// A top-up's deliveries go after the last roast day on record, at the subscription's pace;
		// a completed subscription starts again.
		for (const { s, deliveries } of topUps) {
			const rows = await tx
				.select({
					roastDate: subscriptionDelivery.roastDate,
					sequence: subscriptionDelivery.sequence
				})
				.from(subscriptionDelivery)
				.where(eq(subscriptionDelivery.subscriptionId, s.id));
			const soonest = addDays(today, 2);
			const last = rows.reduce((max, r) => (r.roastDate > max ? r.roastDate : max), '');
			const base =
				last && last >= soonest
					? s.frequency === 'biweekly'
						? addDays(last, 14)
						: addMonths(last, 1)
					: soonest;
			const dates = deliverySchedule(
				roastDayFrom(base, weekdays),
				deliveries,
				s.frequency,
				weekdays
			);
			const seq = rows.reduce((max, r) => Math.max(max, r.sequence), 0);
			await tx
				.insert(subscriptionDelivery)
				.values(
					dates.map((roastDate, i) => ({ subscriptionId: s.id, sequence: seq + i + 1, roastDate }))
				);
			await tx
				.update(subscription)
				.set({
					deliveriesPurchased: s.deliveriesPurchased + deliveries,
					status: s.status === 'completed' ? 'active' : s.status,
					nextRoastDate: s.nextRoastDate ?? dates[0] ?? null
				})
				.where(eq(subscription.id, s.id));
		}
	}
}
