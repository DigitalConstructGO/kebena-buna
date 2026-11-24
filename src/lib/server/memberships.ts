/** Membership and subscription writes the pages share: numbers, card codes, terms, pickers. */
import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { localToday } from '@nahu/admin-kit/time';
import type { Writer } from '@nahu/admin-kit/server/db';
import { db } from '#lib/server/db/index.ts';
import {
	customer,
	customerAddress,
	membership,
	membershipMember,
	membershipPlan,
	subscription
} from '#lib/server/db/schema.ts';
import { nextNumber } from '#lib/server/records.ts';

/** A short code that reads unambiguously off a card: no 0/O, 1/I. */
export function cardCode(length = 10) {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	return Array.from(randomBytes(length), (b) => chars[b % chars.length]).join('');
}

/**
 * `KM-26-0042` / `KS-26-0007` from `document_sequence`, skipping any number already taken (rows
 * imported or seeded before the sequence existed).
 */
async function documentNumber(
	tx: Writer,
	prefix: string,
	key: string,
	taken: (n: string) => Promise<boolean>
) {
	// The year in Addis Ababa, not on the server's clock.
	const yy = localToday().slice(2, 4);
	for (;;) {
		const n = await nextNumber(tx, `${key}:${yy}`);
		const number = `${prefix}-${yy}-${String(n).padStart(4, '0')}`;
		if (!(await taken(number))) return number;
	}
}

export const nextMembershipNumber = (tx: Writer) =>
	documentNumber(tx, 'KM', 'membership', async (n) =>
		Boolean(
			(await tx.select({ id: membership.id }).from(membership).where(eq(membership.number, n)))[0]
		)
	);

export const nextSubscriptionNumber = (tx: Writer) =>
	documentNumber(tx, 'KS', 'subscription', async (n) =>
		Boolean(
			(
				await tx
					.select({ id: subscription.id })
					.from(subscription)
					.where(eq(subscription.number, n))
			)[0]
		)
	);

const addDays = (iso: string, days: number) => {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
};
/** The same day `months` later, kept inside its month: Aug 31 + 6 months is Feb 28 (29), not Mar 2. */
const addMonths = (iso: string, months: number) => {
	const [y, m, d] = iso.split('-').map(Number);
	const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
	return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10);
};

/**
 * A term's last day: the day before the same date `months` on, or the month's end when that
 * month is too short for the date (Aug 31 for 6 months ends Feb 28).
 */
const termEnd = (startsOn: string, months: number) => {
	const same = addMonths(startsOn, months);
	return same.slice(8) === startsOn.slice(8) ? addDays(same, -1) : same;
};

/** A term's end and grace end from its start and plan. */
export async function termDates(planId: number, startsOn: string) {
	const [plan] = await db
		.select({ months: membershipPlan.durationMonths, grace: membershipPlan.graceDays })
		.from(membershipPlan)
		.where(eq(membershipPlan.id, planId));
	const endsOn = termEnd(startsOn, plan?.months ?? 12);
	return { startsOn, endsOn, graceEndsOn: addDays(endsOn, plan?.grace ?? 7) };
}

/**
 * Refuses a named person the plan has no room for: its `maxAdults` / `maxChildren` count the
 * membership's active members, leaving out `exceptMemberId` (the one being edited).
 */
export async function checkMemberRoom(
	membershipId: number,
	isChild: boolean,
	exceptMemberId?: number
) {
	const [plan] = await db
		.select({ maxAdults: membershipPlan.maxAdults, maxChildren: membershipPlan.maxChildren })
		.from(membership)
		.innerJoin(membershipPlan, eq(membership.planId, membershipPlan.id))
		.where(eq(membership.id, membershipId));
	if (!plan) throw new WriteRefused(null, 'Membership not found');
	const [{ n }] = await db
		.select({ n: count() })
		.from(membershipMember)
		.where(
			and(
				eq(membershipMember.membershipId, membershipId),
				eq(membershipMember.isChild, isChild),
				eq(membershipMember.isActive, true),
				isNull(membershipMember.deletedAt),
				exceptMemberId ? ne(membershipMember.id, exceptMemberId) : undefined
			)
		);
	const max = isChild ? plan.maxChildren : plan.maxAdults;
	if (n >= max) {
		const who = isChild ? (max === 1 ? 'child' : 'children') : max === 1 ? 'adult' : 'adults';
		throw new WriteRefused(
			'isChild',
			max
				? `The plan covers ${max} ${who}, and ${n} are on it already`
				: `The plan covers no ${who}`
		);
	}
}

export { addDays, addMonths };

/** A new term, with the customer as its first named member. */
export async function createMembership(
	tx: Writer,
	values: {
		customerId: number;
		planId: number;
		startsOn: string | null;
		renewalMethod: 'manual_link' | 'auto_charge';
		renewsMembershipId?: number | null;
	},
	userId: string | undefined
) {
	const dates = values.startsOn ? await termDates(values.planId, values.startsOn) : {};
	const number = await nextMembershipNumber(tx);
	const [res] = await tx.insert(membership).values({
		number,
		customerId: values.customerId,
		planId: values.planId,
		status: 'pending_payment',
		renewalMethod: values.renewalMethod,
		renewsMembershipId: values.renewsMembershipId ?? null,
		...dates,
		createdBy: userId
	});
	// A renewal carries its people over, each with a new card; a new term starts with the customer.
	const carried = values.renewsMembershipId
		? await tx
				.select({
					name: membershipMember.name,
					isChild: membershipMember.isChild,
					birthYear: membershipMember.birthYear,
					photo: membershipMember.photo
				})
				.from(membershipMember)
				.where(
					and(
						eq(membershipMember.membershipId, values.renewsMembershipId),
						eq(membershipMember.isActive, true),
						isNull(membershipMember.deletedAt)
					)
				)
		: [];
	if (carried.length) {
		await tx.insert(membershipMember).values(
			carried.map((p) => ({
				...p,
				membershipId: res.insertId,
				cardCode: cardCode(),
				createdBy: userId
			}))
		);
	} else {
		const [c] = await tx
			.select({ name: customer.name })
			.from(customer)
			.where(eq(customer.id, values.customerId));
		await tx.insert(membershipMember).values({
			membershipId: res.insertId,
			name: c?.name ?? 'Member',
			cardCode: cardCode(),
			createdBy: userId
		});
	}
	return { id: res.insertId, number };
}

/**
 * What a customer's membership gives them in the shop (7.2): its plan's discount and whether
 * delivery is free, from their best term still running (active, or in its grace days). Null for a
 * customer who is not a member.
 */
export async function memberPerks(tx: Writer, customerId: number) {
	const [best] = await tx
		.select({
			membershipId: membership.id,
			shopDiscountPct: membershipPlan.shopDiscountPct,
			freeDelivery: membershipPlan.freeDelivery
		})
		.from(membership)
		.innerJoin(membershipPlan, eq(membership.planId, membershipPlan.id))
		.where(
			and(
				eq(membership.customerId, customerId),
				inArray(membership.status, ['active', 'grace']),
				isNull(membership.deletedAt)
			)
		)
		.orderBy(desc(membershipPlan.shopDiscountPct))
		.limit(1);
	return best ? { ...best, shopDiscountPct: Number(best.shopDiscountPct) } : null;
}

/** A customer's addresses as picker options. */
export const addressOptions = (customerId: number) =>
	db
		.select({
			value: customerAddress.id,
			name: sql<string>`concat(coalesce(${customerAddress.label}, 'Address'), ' — ', ${customerAddress.line1})`
		})
		.from(customerAddress)
		.where(and(eq(customerAddress.customerId, customerId), isNull(customerAddress.deletedAt)));
