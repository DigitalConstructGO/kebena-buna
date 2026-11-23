/**
 * Runs one module's seed against whatever DATABASE_URL names, without wiping — for working on a
 * module against a database already holding the base seed:
 *
 *     DATABASE_URL=mysql://dev@localhost:3306/kc_visits npx tsx scripts/seed/one.ts visits
 */
import { pool } from './db.ts';

const name = process.argv[2];
if (!name) throw new Error('Usage: tsx scripts/seed/one.ts <module>');

const mod = (await import(`./${name}.ts`)) as { seed: () => Promise<void> };
try {
	await mod.seed();
	console.log(`Seeded ${name}`);
} finally {
	await pool.end();
}
