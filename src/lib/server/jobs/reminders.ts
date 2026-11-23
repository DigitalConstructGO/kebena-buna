/**
 * Customer reminders and the date-driven status changes behind them:
 *
 * - Memberships (questionnaire 7.4): a reminder 14 days before the end, on the end date and 7
 *   days after, each with the renewal link. Past its end a membership is in `grace`; past
 *   `graceEndsOn` it `lapsed`. A term already renewed gets no reminder.
 * - Subscriptions (7.5): a top-up reminder when one prepaid delivery is left.
 * - Invoices (11.5): an open invoice past its due date is `overdue`; reminders go 7 days before
 *   the due date, on it and 7 days after.
 *
 * Reminders are queued between 09:00 and 19:00 local time only, once each (`dedupe`). A reminder
 * the server was down for is still sent on its next run, the same day or later.
 */
import { and, eq, exists, gte, inArray, isNull, lt, lte, not, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { addLocalDays, localClock, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import {
	businessAccount,
	customer,
	invoice,
	membership,
	membershipPlan,
	subscription
} from '#lib/server/db/schema.ts';
import { queueMessage } from '#lib/server/notify.ts';
import { readSetting } from '#lib/server/stockReads.ts';

const DAYTIME = { from: '09:00', to: '19:00' };
const daytime = () => {
	const now = localClock(new Date());
	return now >= DAYTIME.from && now < DAYTIME.to;
};

const MEMBERSHIP_OFFSETS = [-14, 0, 7] as const;
const INVOICE_OFFSETS = [-7, 0, 7] as const;
const label = (offset: number) => (offset < 0 ? `${offset}d` : offset === 0 ? '0d' : `+${offset}d`);
const money = (v: unknown) => Number(v ?? 0).toFixed(2);

/** `active` → `grace` → `lapsed` by date; returns how many changed. */
export async function ageMemberships(): Promise<number> {
	const today = localToday();
	const [toGrace] = await db
		.update(membership)
		.set({ status: 'grace' })
		.where(and(eq(membership.status, 'active'), lt(membership.endsOn, today), isNull(membership.deletedAt)));
	const [toLapsed] = await db
		.update(membership)
		.set({ status: 'lapsed' })
		.where(
			and(
				inArray(membership.status, ['active', 'grace']),
				lt(sql`coalesce(${membership.graceEndsOn}, ${membership.endsOn})`, today),
				isNull(membership.deletedAt)
			)
		);
	return toGrace.affectedRows + toLapsed.affectedRows;
}

export async function membershipReminders(): Promise<number> {
	if (!daytime()) return 0;
	const today = localToday();
	const renewUrl = await readSetting('notify.renew_url', '');
	const next = alias(membership, 'renewal');
	const renewed = exists(
		db
			.select({ id: next.id })
			.from(next)
			.where(and(eq(next.renewsMembershipId, membership.id), inArray(next.status, ['pending_payment', 'active']), isNull(next.deletedAt)))
	);
	let queued = 0;
	for (const offset of MEMBERSHIP_OFFSETS) {
		// Ended `offset` days ago (or ends in -offset days), and that day has come.
		const endsOn = addLocalDays(today, -offset);
		const due = await db
			.select({
				id: membership.id,
				number: membership.number,
				endsOn: membership.endsOn,
				customerId: customer.id,
				name: customer.name,
				phone: customer.phone,
				email: customer.email,
				locale: customer.locale,
				plan: membershipPlan.name
			})
			.from(membership)
			.innerJoin(customer, eq(membership.customerId, customer.id))
			.innerJoin(membershipPlan, eq(membership.planId, membershipPlan.id))
			.where(
				and(
					inArray(membership.status, ['active', 'grace']),
					// Any end date from the reminder day up to today, so a day the server missed still sends.
					lte(membership.endsOn, endsOn),
					gte(membership.endsOn, addLocalDays(endsOn, -3)),
					eq(membership.renewalMethod, 'manual_link'),
					isNull(membership.deletedAt),
					not(renewed)
				)
			);
		for (const m of due) {
			const locale = m.locale || 'am';
			queued += await queueMessage(
				db,
				offset < 0 ? 'membership.renewal_due' : offset === 0 ? 'membership.ending' : 'membership.lapsing',
				{ phone: m.phone, email: m.email, locale, customerId: m.customerId },
				{
					name: m.name,
					membership_number: m.number,
					plan: m.plan?.[locale] || m.plan?.am || m.plan?.en || '',
					ends_on: m.endsOn,
					pay_url: renewUrl ? `${renewUrl}${renewUrl.includes('?') ? '&' : '?'}m=${encodeURIComponent(m.number)}` : ''
				},
				{ refType: 'membership', refId: m.id, dedupe: `membership:${m.id}:renewal:${label(offset)}` }
			);
		}
	}
	return queued;
}

export async function subscriptionTopUps(): Promise<number> {
	if (!daytime()) return 0;
	const topUpUrl = await readSetting('notify.top_up_url', '');
	const due = await db
		.select({
			id: subscription.id,
			number: subscription.number,
			purchased: subscription.deliveriesPurchased,
			customerId: customer.id,
			name: customer.name,
			phone: customer.phone,
			email: customer.email,
			locale: customer.locale
		})
		.from(subscription)
		.innerJoin(customer, eq(subscription.customerId, customer.id))
		.where(
			and(
				inArray(subscription.status, ['active', 'paused']),
				// A Patron's monthly bag is paid by the membership: nothing to top up.
				isNull(subscription.membershipId),
				eq(sql`${subscription.deliveriesPurchased} - ${subscription.deliveriesUsed}`, 1),
				isNull(subscription.deletedAt)
			)
		);
	let queued = 0;
	for (const s of due) {
		queued += await queueMessage(
			db,
			'subscription.top_up',
			{ phone: s.phone, email: s.email, locale: s.locale, customerId: s.customerId },
			{
				name: s.name,
				subscription_number: s.number,
				pay_url: topUpUrl ? `${topUpUrl}${topUpUrl.includes('?') ? '&' : '?'}s=${encodeURIComponent(s.number)}` : ''
			},
			// Once per bundle: a top-up raises `purchased`, and the next last delivery reminds again.
			{ refType: 'subscription', refId: s.id, dedupe: `subscription:${s.id}:top_up:${s.purchased}` }
		);
	}
	return queued;
}

/** Open invoices past their due date become `overdue`; returns how many. */
export async function markOverdueInvoices(): Promise<number> {
	const [res] = await db
		.update(invoice)
		.set({ status: 'overdue' })
		.where(and(eq(invoice.status, 'open'), lt(invoice.dueOn, localToday()), isNull(invoice.deletedAt)));
	return res.affectedRows;
}

export async function invoiceReminders(): Promise<number> {
	if (!daytime()) return 0;
	const today = localToday();
	let queued = 0;
	for (const offset of INVOICE_OFFSETS) {
		const dueOn = addLocalDays(today, -offset);
		const due = await db
			.select({
				id: invoice.id,
				number: invoice.number,
				dueOn: invoice.dueOn,
				total: invoice.total,
				paid: invoice.amountPaid,
				billingName: invoice.billingName,
				customerId: customer.id,
				phone: sql<string | null>`coalesce(${businessAccount.contactPhone}, ${customer.phone})`,
				email: sql<string | null>`coalesce(${businessAccount.contactEmail}, ${customer.email})`,
				locale: customer.locale
			})
			.from(invoice)
			.innerJoin(customer, eq(invoice.customerId, customer.id))
			.leftJoin(businessAccount, eq(invoice.businessAccountId, businessAccount.id))
			.where(
				and(
					inArray(invoice.status, ['open', 'overdue']),
					lte(invoice.dueOn, dueOn),
					gte(invoice.dueOn, addLocalDays(dueOn, -3)),
					sql`${invoice.total} - ${invoice.amountPaid} > 0`,
					isNull(invoice.deletedAt)
				)
			);
		for (const i of due) {
			queued += await queueMessage(
				db,
				offset < 0 ? 'invoice.due_soon' : offset === 0 ? 'invoice.due_today' : 'invoice.overdue',
				{ phone: i.phone, email: i.email, locale: i.locale, customerId: i.customerId },
				{
					name: i.billingName,
					invoice_number: i.number,
					balance: money(Number(i.total) - Number(i.paid)),
					due_on: i.dueOn
				},
				{ refType: 'invoice', refId: i.id, dedupe: `invoice:${i.id}:reminder:${label(offset)}` }
			);
		}
	}
	return queued;
}

