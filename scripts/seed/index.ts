/**
 * Fills the dev database with a believable Kebena Coffee: run `npm run db:seed`.
 *
 * **Wipes every table first** — dev only. Each module's seed reads what earlier ones wrote by code
 * or name (`lot.code = 'KGT-LIM-2025-001'`), so they run in this order.
 */
import { sql } from 'drizzle-orm';
import { db, pool } from './db.ts';
import { seedBase } from './base.ts';

const MODULES: { name: string; load: () => Promise<{ seed: () => Promise<void> }> }[] = [
	{ name: 'inventory', load: () => import('./inventory.ts') },
	{ name: 'visits', load: () => import('./visits.ts') },
	{ name: 'memberships', load: () => import('./memberships.ts') },
	{ name: 'bookings', load: () => import('./bookings.ts') },
	{ name: 'wholesale', load: () => import('./wholesale.ts') },
	{ name: 'bankAccounts', load: () => import('./bankAccounts.ts') },
	{ name: 'orders', load: () => import('./orders.ts') },
	{ name: 'content', load: () => import('./content.ts') },
	{ name: 'system', load: () => import('./system.ts') },
	{ name: 'paymentMessages', load: () => import('./paymentMessages.ts') },
	// Last: experiences and events exist once `bookings` and `visits` have run.
	{ name: 'pictures', load: () => import('./pictures.ts') }
];

async function wipe() {
	const [rows] = await pool.query<import('mysql2').RowDataPacket[]>(
		`select table_name as name from information_schema.tables where table_schema = database() and table_name <> '__drizzle_migrations'`
	);
	await db.execute(sql`set foreign_key_checks = 0`);
	for (const { name } of rows) await db.execute(sql.raw(`truncate table \`${name}\``));
	await db.execute(sql`set foreign_key_checks = 1`);
}

/**
 * Things that have happened cannot be later than now. Seeds place "today" events at fixed hours
 * (`daysFrom(0, 20)`), which run ahead of the clock when seeding early in the day; scheduled times
 * (slots, sessions, roast days) are left alone.
 */
const HAPPENED: [string, string][] = [
	['orders', 'placed_at'],
	['orders', 'paid_at'],
	['orders', 'dispatched_at'],
	['orders', 'completed_at'],
	['orders', 'cancelled_at'],
	['order_status_history', 'created_at'],
	['payment', 'paid_at'],
	['payment', 'created_at'],
	['refund', 'created_at'],
	['refund', 'processed_at'],
	['ticket', 'issued_at'],
	['ticket', 'first_checked_in_at'],
	['ticket_scan', 'scanned_at'],
	['ticket_change', 'created_at'],
	['stock_movement', 'occurred_at'],
	['roast_batch', 'roasted_at'],
	['packing_run', 'packed_at'],
	['audit_log', 'created_at'],
	['notification', 'sent_at'],
	['webhook_event', 'received_at'],
	['ai_message', 'created_at'],
	['ai_conversation', 'last_message_at'],
	['form_submission', 'submitted_at'],
	['workflow_history', 'created_at'],
	['marketing_consent', 'recorded_at'],
	['store_credit', 'created_at']
];

async function noFutureEvents() {
	for (const [table, column] of HAPPENED) {
		await db.execute(
			sql.raw(
				`update \`${table}\` set \`${column}\` = date_sub(now(), interval (id % 180 + 5) minute) where \`${column}\` > now()`
			)
		);
	}
}

async function main() {
	if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production');
	console.log('Wiping…');
	await wipe();
	console.log('Seeding base…');
	await seedBase();
	for (const m of MODULES) {
		let mod: { seed: () => Promise<void> };
		try {
			mod = await m.load();
		} catch (err) {
			if ((err as { code?: string }).code === 'ERR_MODULE_NOT_FOUND') {
				console.log(`  (no ${m.name} seed yet)`);
				continue;
			}
			throw err;
		}
		console.log(`Seeding ${m.name}…`);
		await mod.seed();
	}
	await noFutureEvents();
	console.log('Done. Sign in as owner@kebena.coffee / Kebena2026!');
}

main()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(() => pool.end());
