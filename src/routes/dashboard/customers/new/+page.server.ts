import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import { customer } from '#lib/server/db/schema.ts';
import { customerByPhone } from '#lib/server/customers.ts';
import { customerSchema } from '#lib/schemas/customers.ts';

export const load = async ({ locals }) => {
	requirePermission(locals, 'customers.manage');
	return {
		form: await superValidate({ locale: 'am', source: 'desk' }, zod4(customerSchema), {
			errors: false
		})
	};
};

export const actions = {
	default: async (event) => {
		requirePermission(event.locals, 'customers.manage');
		const form = await superValidate(event.request, zod4(customerSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });

		// One person, one customer: a phone already on someone is refused, naming them.
		const known = await customerByPhone(form.data.phone);
		if (known) {
			const text = `${known.name ?? 'Another customer'} already has this number.`;
			setError(form, 'phone', text);
			return message(form, { type: 'error', text }, { status: 400 });
		}

		const id = await db.transaction(async (tx) => {
			const [res] = await tx
				.insert(customer)
				.values({ ...form.data, createdBy: event.locals.user?.id, lastActivityAt: new Date() });
			await recordAudit(tx, event, { table: 'customer', recordId: res.insertId, action: 'create' });
			return res.insertId;
		});
		redirect(
			`/dashboard/customers/${id}`,
			{ type: 'success', message: `${form.data.name} added` },
			event.cookies
		);
	}
};
