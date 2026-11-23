import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import { webhookEvent } from '#lib/server/db/schema.ts';
import { idParam } from '#lib/server/records.ts';

async function loadEvent(raw: string) {
	const [row] = await db
		.select()
		.from(webhookEvent)
		.where(eq(webhookEvent.id, idParam(raw, 'Webhook')));
	if (!row) error(404, 'Webhook not found');
	return row;
}

export const load = async ({ params, locals }) => ({
	event: await loadEvent(params.id),
	canManage: hasPermission(locals, 'messages.manage')
});

export const actions = {
	/** Marks it unprocessed, so the payment worker reads it again. */
	replay: async (event) => {
		requirePermission(event.locals, 'messages.manage');
		const w = await loadEvent(event.params.id);
		await db.transaction(async (tx) => {
			await tx
				.update(webhookEvent)
				.set({ processedAt: null, error: null })
				.where(eq(webhookEvent.id, w.id));
			await recordAudit(tx, event, {
				table: 'webhook_event',
				recordId: w.id,
				action: 'update',
				detail: { replay: true }
			});
		});
		return { message: { type: 'success', text: 'Queued to be processed again' } };
	}
};
