import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import type { RequestHandler } from './$types';

/**
 * What a reverse proxy or an uptime check asks. It touches the database, because "the Node
 * process is listening" is not the real question: an app that cannot reach MySQL serves 500s from
 * every route while answering a plain TCP check perfectly. Says nothing else: `ok` or `degraded`,
 * and the round-trip time.
 */
export const GET: RequestHandler = async () => {
	const started = Date.now();
	const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };

	try {
		await db.execute(sql`select 1`);
	} catch {
		return new Response(JSON.stringify({ status: 'degraded', database: 'unreachable' }), {
			status: 503,
			headers
		});
	}

	return new Response(
		JSON.stringify({ status: 'ok', database: 'ok', latencyMs: Date.now() - started }),
		{ headers }
	);
};
