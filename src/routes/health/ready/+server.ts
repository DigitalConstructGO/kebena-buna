import { json } from '@sveltejs/kit';
import { schemaReady } from '#lib/server/readiness.ts';
import type { RequestHandler } from './$types';

/**
 * Ready means the database answers *and* holds every migration this build expects. The deploy
 * script polls this after a restart; `/health` alone answers 200 while pages 500 on a missing
 * column.
 */
export const GET: RequestHandler = async () => {
	const headers = { 'cache-control': 'no-store' };
	try {
		if (await schemaReady()) return json({ status: 'ok' }, { headers });
	} catch {
		/* A missing migration table or an unreachable database is simply not ready. */
	}
	return json({ status: 'degraded' }, { status: 503, headers });
};
