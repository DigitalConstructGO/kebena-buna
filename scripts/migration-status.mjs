/**
 * Prints which migrations the database at DATABASE_URL has already recorded.
 *
 * Read-only, and separate from `migrate.ts` so that "what would this do?" can
 * be answered against production without loading the migrator — which, given
 * the chance, would answer by doing it.
 *
 * Matching is by SHA-256 of each migration's SQL, the same key drizzle records,
 * so a file edited after it was applied shows as pending rather than silently
 * agreeing with a row that no longer describes it.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import journal from '../drizzle/meta/_journal.json' with { type: 'json' };

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const connection = await mysql.createConnection(url);

/** @type {Set<string>} */
let applied = new Set();
try {
	const [rows] = /** @type {[import('mysql2').RowDataPacket[], unknown]} */ (
		await connection.query('SELECT hash FROM `__drizzle_migrations`')
	);
	applied = new Set(rows.map((row) => String(row.hash)));
} catch (error) {
	if (/** @type {{ code?: string }} */ (error).code !== 'ER_NO_SUCH_TABLE') {
		await connection.end();
		throw error;
	}
	console.log('   (no __drizzle_migrations table — nothing has been applied)');
}

let pending = 0;
for (const entry of journal.entries) {
	const sql = fs.readFileSync(`drizzle/${entry.tag}.sql`, 'utf8');
	const hash = crypto.createHash('sha256').update(sql).digest('hex');
	const done = applied.has(hash);
	if (!done) pending += 1;
	console.log(`   ${done ? '· applied' : '+ PENDING'}  ${entry.tag}`);
}

console.log(`   ${pending} pending`);
await connection.end();

if (process.argv.includes('--check') && pending) process.exitCode = 1;
