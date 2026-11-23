import { error } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { bad, ok } from '@nahu/admin-kit/server/actionResults';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { addLocalDays, fromLocal, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import {
	booking,
	businessAccount,
	customer,
	invoice,
	order,
	payment
} from '#lib/server/db/schema.ts';
import { stampsOf, userAlias } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { recordInvoicePayment } from '#lib/server/orders.ts';
import { invoiceEditSchema, paymentSchema } from '#lib/schemas/orders.ts';

async function loadInvoice(raw: string) {
	const id = idParam(raw, 'Invoice');
	const [inv] = await db.select().from(invoice).where(eq(invoice.id, id));
	if (!inv) error(404, 'Invoice not found');
	return inv;
}

const recorder = userAlias('recorder');

export const load = async ({ params, locals }) => {
	const inv = await loadInvoice(params.id);
	const [[names], payments, bookings, stamps] = await Promise.all([
		db
			.select({
				customer: customer.name,
				customerPhone: customer.phone,
				business: businessAccount.name,
				orderNumber: order.number
			})
			.from(invoice)
			.innerJoin(customer, eq(invoice.customerId, customer.id))
			.leftJoin(businessAccount, eq(invoice.businessAccountId, businessAccount.id))
			.leftJoin(order, eq(invoice.orderId, order.id))
			.where(eq(invoice.id, inv.id)),
		db
			.select({
				id: payment.id,
				txRef: payment.txRef,
				provider: payment.provider,
				status: payment.status,
				amount: payment.amount,
				reference: payment.reference,
				paidAt: payment.paidAt,
				byId: payment.recordedBy,
				by: recorder.name
			})
			.from(payment)
			.leftJoin(recorder, eq(payment.recordedBy, recorder.id))
			.where(eq(payment.invoiceId, inv.id))
			.orderBy(desc(payment.createdAt)),
		db
			.select({ id: booking.id, number: booking.number, status: booking.status })
			.from(booking)
			.where(eq(booking.invoiceId, inv.id)),
		stampsOf(inv)
	]);
	const balance = Math.max(0, Number(inv.total) - Number(inv.amountPaid));
	return {
		invoice: inv,
		names: names,
		payments,
		bookings,
		stamps,
		balance,
		today: localToday(),
		canManage: hasPermission(locals, 'orders.manage'),
		editForm: await superValidate(
			{
				billingName: inv.billingName,
				billingTin: inv.billingTin,
				billingAddress: inv.billingAddress,
				dueOn: inv.dueOn,
				notes: inv.notes
			},
			zod4(invoiceEditSchema),
			{ id: 'edit', errors: false }
		),
		paymentForm: await superValidate(
			{ provider: 'bank_transfer', amount: balance, paidOn: localToday() },
			zod4(paymentSchema),
			{ id: 'payment', errors: false }
		)
	};
};

export const actions = {
	edit: async (event) => {
		requirePermission(event.locals, 'orders.manage');
		const form = await superValidate(event.request, zod4(invoiceEditSchema), { id: 'edit' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const inv = await loadInvoice(event.params.id);
		if (inv.status === 'paid' || inv.status === 'void') {
			return message(
				form,
				{ type: 'error', text: `A ${inv.status} invoice is not edited.` },
				{ status: 400 }
			);
		}
		const values = { ...form.data, updatedBy: event.locals.user?.id ?? null };
		await db.transaction(async (tx) => {
			await tx.update(invoice).set(values).where(eq(invoice.id, inv.id));
			await recordAudit(tx, event, {
				table: 'invoice',
				recordId: inv.id,
				action: 'update',
				before: inv,
				after: values
			});
		});
		return message(form, { type: 'success', text: 'Invoice saved' });
	},
	payment: async (event) => {
		requirePermission(event.locals, 'orders.manage');
		const form = await superValidate(event.request, zod4(paymentSchema), { id: 'payment' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const inv = await loadInvoice(event.params.id);
		try {
			await db.transaction((tx) =>
				recordInvoicePayment(tx, event, inv, {
					provider: form.data.provider,
					amount: form.data.amount,
					reference: form.data.reference,
					paidAt: fromLocal(form.data.paidOn, '12:00')
				})
			);
		} catch (err) {
			if (!(err instanceof WriteRefused)) throw err;
			if (err.field) setError(form, err.field as never, err.message);
			return message(form, { type: 'error', text: err.message }, { status: 400 });
		}
		return message(form, { type: 'success', text: 'Payment recorded' });
	},
	/**
	 * A draft goes out, dated today. It is due on the date set, else after the business account's
	 * credit terms, else in 30 days.
	 */
	issue: async (event) => {
		requirePermission(event.locals, 'orders.manage');
		const inv = await loadInvoice(event.params.id);
		if (inv.status !== 'draft') return bad('Only a draft is issued.');
		let termDays = 30;
		if (inv.businessAccountId) {
			const [acc] = await db
				.select({
					creditApproved: businessAccount.creditApproved,
					days: businessAccount.paymentTermsDays
				})
				.from(businessAccount)
				.where(eq(businessAccount.id, inv.businessAccountId));
			if (acc?.creditApproved && acc.days > 0) termDays = acc.days;
		}
		const values = {
			status: 'open' as const,
			issuedAt: new Date(),
			dueOn: inv.dueOn ?? addLocalDays(localToday(), termDays),
			updatedBy: event.locals.user?.id ?? null
		};
		await db.transaction(async (tx) => {
			await tx.update(invoice).set(values).where(eq(invoice.id, inv.id));
			await recordAudit(tx, event, {
				table: 'invoice',
				recordId: inv.id,
				action: 'update',
				before: inv,
				after: values
			});
		});
		return ok(`${inv.number} issued`);
	},
	void: async (event) => {
		requirePermission(event.locals, 'orders.manage');
		const inv = await loadInvoice(event.params.id);
		if (Number(inv.amountPaid) > 0)
			return bad('Money was paid against this invoice; refund it before voiding.');
		if (inv.status === 'void') return bad('Already void.');
		const values = { status: 'void' as const, updatedBy: event.locals.user?.id ?? null };
		await db.transaction(async (tx) => {
			await tx.update(invoice).set(values).where(eq(invoice.id, inv.id));
			await recordAudit(tx, event, {
				table: 'invoice',
				recordId: inv.id,
				action: 'update',
				before: inv,
				after: values
			});
		});
		return ok(`${inv.number} voided`);
	}
};
