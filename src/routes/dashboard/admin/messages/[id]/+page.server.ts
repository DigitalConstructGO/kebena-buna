import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import { customer, notification, notificationTemplate, user } from '#lib/server/db/schema.ts';
import { idParam } from '#lib/server/records.ts';

async function loadMessage(raw: string) {
	const id = idParam(raw, 'Message');
	const [row] = await db
		.select({ n: notification, customer: customer.name, userName: user.name })
		.from(notification)
		.leftJoin(customer, eq(notification.customerId, customer.id))
		.leftJoin(user, eq(notification.userId, user.id))
		.where(eq(notification.id, id));
	if (!row) error(404, 'Message not found');
	return row;
}

export const load = async ({ params, locals }) => {
	const row = await loadMessage(params.id);
	const [template] = await db
		.select({
			id: notificationTemplate.id,
			subject: notificationTemplate.subject,
			body: notificationTemplate.body
		})
		.from(notificationTemplate)
		.where(
			and(
				eq(notificationTemplate.key, row.n.templateKey),
				eq(notificationTemplate.channel, row.n.channel),
				eq(notificationTemplate.locale, row.n.locale)
			)
		);
	return {
		message: row.n,
		customer: row.customer,
		userName: row.userName,
		template: template ?? null,
		canManage: hasPermission(locals, 'messages.manage')
	};
};

/**
 * Retrying puts a failed or skipped message back in the queue, due now; skipping takes a queued or
 * failed one out. One the worker is sending (or has sent) is left alone, and the update only lands
 * if the status is still the one read, so two clicks cannot queue it twice.
 */
const FROM = {
	queued: ['failed', 'skipped'],
	skipped: ['queued', 'failed']
} as const;

async function setStatus(event: RequestEvent<{ id: string }>, to: 'queued' | 'skipped') {
	requirePermission(event.locals, 'messages.manage');
	const { n } = await loadMessage(event.params.id);
	const from: readonly string[] = FROM[to];
	const refused = () =>
		fail(400, {
			message: {
				type: 'error',
				text:
					to === 'queued'
						? 'Only a failed or skipped message can be sent again.'
						: 'Only a queued or failed message can be skipped.'
			}
		});
	if (!from.includes(n.status)) return refused();
	const moved = await db.transaction(async (tx) => {
		const [res] = await tx
			.update(notification)
			.set(
				to === 'queued'
					? { status: 'queued', scheduledFor: sql`NOW()`, lastError: null }
					: { status: 'skipped' }
			)
			.where(and(eq(notification.id, n.id), inArray(notification.status, FROM[to])));
		if (!res.affectedRows) return false;
		await recordAudit(tx, event, {
			table: 'notification',
			recordId: n.id,
			action: 'update',
			before: { status: n.status },
			after: { status: to }
		});
		return true;
	});
	if (!moved) return refused();
	return {
		message: {
			type: 'success',
			text: to === 'queued' ? 'Queued to send again' : 'Skipped: it will not be sent'
		}
	};
}

export const actions = {
	retry: (event) => setStatus(event, 'queued'),
	skip: (event) => setStatus(event, 'skipped')
};
