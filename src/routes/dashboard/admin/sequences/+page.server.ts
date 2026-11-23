import { asc } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { documentSequence } from '#lib/server/db/schema.ts';

/** Read-only: the next number of every gap-free document series. */
export const load = async () => ({
	rows: await db.select().from(documentSequence).orderBy(asc(documentSequence.key))
});
