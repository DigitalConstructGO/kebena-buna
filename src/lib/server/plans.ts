/** Writing a membership plan: translated fields, the image, and an audited price (5.1). */
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { storeFileFields } from '@nahu/admin-kit/server/files';
import { db } from '#lib/server/db/index.ts';
import { membershipPlan } from '#lib/server/db/schema.ts';
import { packLocalized } from '#lib/server/localized.ts';

export const PLAN_LOCALIZED = ['name', 'description', 'benefits', 'requiresProof'];

export async function savePlan(
	event: RequestEvent,
	data: Record<string, unknown>,
	posted: FormData,
	id?: number
): Promise<number> {
	const values = packLocalized({ ...data }, PLAN_LOCALIZED);
	delete values.id;
	await storeFileFields(values, ['image'], posted);
	return db.transaction(async (tx) => {
		if (id) {
			const [before] = await tx.select().from(membershipPlan).where(eq(membershipPlan.id, id));
			await tx
				.update(membershipPlan)
				.set({ ...values, updatedBy: event.locals.user?.id })
				.where(eq(membershipPlan.id, id));
			await recordAudit(tx, event, { table: 'membership_plan', recordId: id, action: 'update', before, after: values });
			return id;
		}
		const [res] = await tx
			.insert(membershipPlan)
			.values({ ...(values as typeof membershipPlan.$inferInsert), createdBy: event.locals.user?.id });
		await recordAudit(tx, event, { table: 'membership_plan', recordId: res.insertId, action: 'create' });
		return res.insertId;
	});
}
