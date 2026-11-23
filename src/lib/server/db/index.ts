import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import { DATABASE_URL } from '$app/env/private';

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = mysql.createPool(DATABASE_URL);

/**
 * Every session in UTC. Drizzle writes and reads `datetime`/`timestamp` values as UTC, so a column
 * defaulted by MySQL (`CURRENT_TIMESTAMP`, `NOW()` in a soft delete) must be UTC too — on the
 * server's own zone (EAT) those came back three hours late.
 */
client.pool.on('connection', (connection) => {
	connection.query("SET time_zone = '+00:00'");
});

export const db = drizzle(client, { schema, mode: 'default' });
