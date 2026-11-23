/**
 * Messages to staff: the low-stock list each morning (questionnaire 4.3), the day's sales at 21:00
 * (5.2), and form submissions or bookings left in New for more than a day (8.5).
 *
 * Who gets each is the `alerts.roles` setting — role names per alert, editable in Admin › Settings —
 * and each goes by email to the active staff in those roles. Each is queued once per day
 * (`dedupe`), so the job may run as often as it likes.
 */
import { and, count, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { localClock, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { booking, formSubmission, order, roles, user } from '#lib/server/db/schema.ts';
import { queueMessage, type Payload } from '#lib/server/notify.ts';
import { lowStock, readSetting, stockLevels } from '#lib/server/stockReads.ts';
import { netSales, netVat, paidDay, soldOrder } from '#lib/server/dashboard.ts';

type Alert = 'low_stock' | 'sales_daily' | 'inbox_stale';

/** The roles questionnaire 4.3, 5.2 and 8.5 name, until staff change the setting. */
const DEFAULT_ROLES: Record<Alert, string[]> = {
	low_stock: ['Manager', 'Roaster'],
	sales_daily: ['Owner', 'Manager', 'Accountant'],
	inbox_stale: ['Manager']
};

/** Local times (Addis Ababa) each daily alert goes out from. */
const LOW_STOCK_AT = '07:00';
const SALES_AT = '21:00';
const INBOX_AT = '09:00';

async function recipients(alert: Alert) {
	const setting = await readSetting<Record<string, string[]>>('alerts.roles', DEFAULT_ROLES);
	const names = Array.isArray(setting[alert]) ? setting[alert] : DEFAULT_ROLES[alert];
	if (!names.length) return [];
	return db
		.select({ id: user.id, email: user.email, locale: user.locale })
		.from(user)
		.innerJoin(roles, eq(user.roleId, roles.id))
		.where(
			and(inArray(roles.name, names), eq(user.kind, 'staff'), eq(user.isActive, true), isNull(user.deletedAt), isNotNull(user.email))
		);
}

/** Queues `key` by email to everyone the alert goes to; returns how many were queued. */
async function tellStaff(alert: Alert, key: string, payload: Payload, day: string) {
	let queued = 0;
	for (const r of await recipients(alert)) {
		queued += await queueMessage(db, key, { email: r.email, locale: r.locale, userId: r.id }, payload, {
			refType: 'alert',
			refId: alert,
			dedupe: `alert:${alert}:${day}:${r.id}`
		});
	}
	return queued;
}

export async function lowStockAlert(): Promise<number> {
	if (localClock(new Date()) < LOW_STOCK_AT) return 0;
	const items = await lowStock(await stockLevels());
	if (!items.length) return 0;
	const list = items.map((i) => `${i.kind}: ${i.name} — ${i.have} ${i.unit} (level ${i.level})`).join('\n');
	return tellStaff('low_stock', 'staff.low_stock', { count: items.length, list }, localToday());
}

export async function dailySalesAlert(): Promise<number> {
	if (localClock(new Date()) < SALES_AT) return 0;
	const today = localToday();
	const [row] = await db
		.select({ orders: count(), sales: netSales(), vat: netVat() })
		.from(order)
		.where(and(soldOrder(), eq(paidDay(), today)));
	const money = (v: unknown) => Number(v ?? 0).toFixed(2);
	return tellStaff(
		'sales_daily',
		'staff.sales_daily',
		{ date: today, orders: row?.orders ?? 0, sales: money(row?.sales), vat: money(row?.vat) },
		today
	);
}

export async function staleInboxAlert(): Promise<number> {
	if (localClock(new Date()) < INBOX_AT) return 0;
	const dayAgo = sql`NOW() - INTERVAL 24 HOUR`;
	const [[forms], [bookings]] = await Promise.all([
		db
			.select({ n: count() })
			.from(formSubmission)
			.where(and(eq(formSubmission.status, 'new'), lt(formSubmission.submittedAt, dayAgo), isNull(formSubmission.deletedAt))),
		db
			.select({ n: count() })
			.from(booking)
			.where(and(eq(booking.status, 'new'), lt(booking.createdAt, dayAgo), isNull(booking.deletedAt)))
	]);
	if (!forms.n && !bookings.n) return 0;
	return tellStaff('inbox_stale', 'staff.inbox_stale', { forms: forms.n, bookings: bookings.n }, localToday());
}
