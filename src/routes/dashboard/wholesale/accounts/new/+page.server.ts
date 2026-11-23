import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { postedForm, storeFileFields, UploadRefused } from '@nahu/admin-kit/server/files';
import { db } from '#lib/server/db/index.ts';
import { businessAccount } from '#lib/server/db/schema.ts';
import { accountSchema } from '#lib/schemas/wholesale.ts';

export const load = async ({ locals }) => {
	requirePermission(locals, 'wholesale.manage');
	return { form: await superValidate({ type: 'cafe' }, zod4(accountSchema), { errors: false }) };
};

export const actions = {
	/** An application entered by staff: pending until someone else approves it. */
	default: async (event) => {
		requirePermission(event.locals, 'wholesale.manage');
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(accountSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });

		const values: Record<string, unknown> = { ...form.data };
		let id: number;
		try {
			await storeFileFields(values, ['tradeLicenceFile'], posted);
			id = await db.transaction(async (tx) => {
				const [res] = await tx.insert(businessAccount).values({
					...(values as typeof businessAccount.$inferInsert),
					approvalStatus: 'pending',
					requestedBy: event.locals.user?.id,
					createdBy: event.locals.user?.id
				});
				await recordAudit(tx, event, { table: 'business_account', recordId: res.insertId, action: 'create' });
				return res.insertId;
			});
		} catch (err) {
			if (err instanceof UploadRefused) {
				setError(form, 'tradeLicenceFile', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			if (isDuplicateKey(err)) {
				setError(form, 'tin', 'A business with this TIN already exists.');
				return message(form, { type: 'error', text: 'A business with this TIN already exists.' }, { status: 400 });
			}
			throw err;
		}
		redirect(
			`/dashboard/wholesale/accounts/${id}`,
			{ type: 'success', message: `${form.data.name} entered — awaiting approval` },
			event.cookies
		);
	}
};
