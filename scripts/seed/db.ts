/**
 * The seed's own connection: scripts run outside Vite, so `$app/env/private` (and with it
 * `#lib/server/db`) is not available. Same schema, same driver.
 */
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../../src/lib/server/db/schema.ts';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (run with --env-file=.env)');

export const pool = mysql.createPool(process.env.DATABASE_URL);
// UTC sessions, as the app's own pool (`src/lib/server/db/index.ts`).
pool.pool.on('connection', (connection) => {
	connection.query("SET time_zone = '+00:00'");
});
export const db = drizzle(pool, { schema, mode: 'default' });
export type SeedDb = typeof db;
export { schema };

/** Inserts one row and returns its id. */
export async function insertId(table: Parameters<SeedDb['insert']>[0], values: object) {
	const [res] = await db.insert(table).values(values as never);
	return (res as { insertId: number }).insertId;
}

/** Deterministic pseudo-random numbers, so a re-seed gives the same data. */
let state = 20261120;
export function rand() {
	state = (state * 1664525 + 1013904223) % 4294967296;
	return state / 4294967296;
}
export const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
export const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

/** A Date `days` from today (negative for the past) at `hour:minute` local time. */
export function daysFrom(days: number, hour = 10, minute = 0) {
	const d = new Date();
	d.setDate(d.getDate() + days);
	d.setHours(hour, minute, 0, 0);
	return d;
}
/** `YYYY-MM-DD` `days` from today. */
export const isoFrom = (days: number) => {
	const d = daysFrom(days);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** `{ en, am }`. */
export const L = (en: string, am?: string) => (am ? { en, am } : { en });

/** A short random code (tickets, cards, pickup). */
export function shortCode(len = 8) {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	return Array.from({ length: len }, () => chars[Math.floor(rand() * chars.length)]).join('');
}
