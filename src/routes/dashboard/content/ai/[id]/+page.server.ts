import { error, fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import { aiConversation, aiMessage, customer } from '#lib/server/db/schema.ts';
import { namesOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';

async function found(raw: string) {
	const id = idParam(raw, 'Conversation');
	const [row] = await db
		.select({ conversation: aiConversation, customer: customer.name, phone: customer.phone })
		.from(aiConversation)
		.leftJoin(customer, eq(aiConversation.customerId, customer.id))
		.where(eq(aiConversation.id, id));
	if (!row) error(404, 'Conversation not found');
	return row;
}

/** One chat, message by message, with what each answer cost and how it was rated. */
export const load = async ({ params, locals }) => {
	const row = await found(params.id);
	const c = row.conversation;
	const [messages, names] = await Promise.all([
		db
			.select()
			.from(aiMessage)
			.where(eq(aiMessage.conversationId, c.id))
			.orderBy(asc(aiMessage.id)),
		namesOf([c.handedOffTo])
	]);
	const tokens = messages.reduce(
		(sum, m) => ({
			input: sum.input + (m.inputTokens ?? 0),
			output: sum.output + (m.outputTokens ?? 0)
		}),
		{ input: 0, output: 0 }
	);
	return {
		conversation: c,
		customer: row.customer,
		phone: row.phone,
		handedOffToName: c.handedOffTo ? (names[c.handedOffTo] ?? null) : null,
		canManage: hasPermission(locals, 'ai.manage'),
		messages,
		tokens,
		ratings: {
			up: messages.filter((m) => (m.rating ?? 0) > 0).length,
			down: messages.filter((m) => (m.rating ?? 0) < 0).length
		}
	};
};

export const actions = {
	/** Staff take the chat from the agent: it stops answering, and the next reply is theirs. */
	takeOver: async (event) => {
		requirePermission(event.locals, 'ai.manage');
		const { conversation: c } = await found(event.params.id);
		const userId = event.locals.user?.id ?? null;
		// Someone else's chat is theirs until they hand it back: taking it would cut them off unseen.
		if (c.handedOffTo && c.handedOffTo !== userId) {
			const names = await namesOf([c.handedOffTo]);
			const who = names[c.handedOffTo] ?? 'Someone else';
			return fail(409, {
				message: { type: 'error', text: `${who} has taken over this chat already` }
			});
		}
		await db.transaction(async (tx) => {
			await tx
				.update(aiConversation)
				.set({ handedOffTo: userId })
				.where(eq(aiConversation.id, c.id));
			await recordAudit(tx, event, {
				table: 'ai_conversation',
				recordId: c.id,
				action: 'update',
				before: { handedOffTo: c.handedOffTo },
				after: { handedOffTo: userId }
			});
		});
		return { message: { type: 'success', text: 'You have taken over this chat' } };
	},
	/** Back to the agent. */
	handBack: async (event) => {
		requirePermission(event.locals, 'ai.manage');
		const { conversation: c } = await found(event.params.id);
		await db.transaction(async (tx) => {
			await tx.update(aiConversation).set({ handedOffTo: null }).where(eq(aiConversation.id, c.id));
			await recordAudit(tx, event, {
				table: 'ai_conversation',
				recordId: c.id,
				action: 'update',
				before: { handedOffTo: c.handedOffTo },
				after: { handedOffTo: null }
			});
		});
		return { message: { type: 'success', text: 'The agent answers this chat again' } };
	}
};
