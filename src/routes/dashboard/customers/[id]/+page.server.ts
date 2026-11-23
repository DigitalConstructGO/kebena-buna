import { error } from '@sveltejs/kit';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { fromLocal } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import {
	aiConversation,
	aiMessage,
	bookable,
	booking,
	businessAccount,
	businessMember,
	customer,
	customerAddress,
	deliveryArea,
	deliveryZone,
	formSubmission,
	invoice,
	marketingConsent,
	membership,
	membershipPlan,
	notification,
	order,
	product,
	productVariant,
	storeCredit,
	subscription,
	ticket,
	ticketType,
	user
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import type { Lang } from '#lib/languages.ts';
import { stampsOf, userAlias } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { deliveryAreaOptions } from '#lib/server/options.ts';
import {
	anonymiseCustomer,
	creditBalance,
	customerByPhone,
	customerReferences
} from '#lib/server/customers.ts';
import {
	addressEditSchema,
	addressSchema,
	consentSchema,
	creditSchema,
	customerEditSchema
} from '#lib/schemas/customers.ts';
import { CONTACT_CHANNELS } from '#lib/constants.ts';

async function loadCustomer(raw: string) {
	const id = idParam(raw, 'Customer');
	const [row] = await db
		.select()
		.from(customer)
		.where(and(eq(customer.id, id), isNull(customer.deletedAt)));
	if (!row) error(404, 'Customer not found');
	return row;
}

const recorder = userAlias('recorder');
const issuer = userAlias('issuer');

export const load = async ({ params, locals }) => {
	const c = await loadCustomer(params.id);
	const id = c.id;
	const [
		account,
		addresses,
		consents,
		credits,
		orders,
		invoices,
		tickets,
		memberships,
		subscriptions,
		bookings,
		submissions,
		messages,
		chats,
		businesses,
		stamps,
		areas
	] = await Promise.all([
		c.userId
			? db
					.select({ id: user.id, name: user.name, email: user.email, isActive: user.isActive })
					.from(user)
					.where(eq(user.id, c.userId))
					.then((r) => r[0] ?? null)
			: null,
		db
			.select({
				id: customerAddress.id,
				label: customerAddress.label,
				recipientName: customerAddress.recipientName,
				phone: customerAddress.phone,
				areaId: customerAddress.areaId,
				area: enOf(deliveryArea.name),
				zone: enOf(deliveryZone.name),
				city: customerAddress.city,
				woreda: customerAddress.woreda,
				line1: customerAddress.line1,
				landmark: customerAddress.landmark,
				latitude: customerAddress.latitude,
				longitude: customerAddress.longitude,
				isDefault: customerAddress.isDefault
			})
			.from(customerAddress)
			.leftJoin(deliveryArea, eq(customerAddress.areaId, deliveryArea.id))
			.leftJoin(deliveryZone, eq(deliveryArea.zoneId, deliveryZone.id))
			.where(and(eq(customerAddress.customerId, id), isNull(customerAddress.deletedAt)))
			.orderBy(desc(customerAddress.isDefault), customerAddress.id),
		db
			.select({
				id: marketingConsent.id,
				channel: marketingConsent.channel,
				granted: marketingConsent.granted,
				source: marketingConsent.source,
				ipAddress: marketingConsent.ipAddress,
				recordedById: marketingConsent.recordedBy,
				recordedBy: recorder.name,
				recordedAt: marketingConsent.recordedAt
			})
			.from(marketingConsent)
			.leftJoin(recorder, eq(marketingConsent.recordedBy, recorder.id))
			.where(eq(marketingConsent.customerId, id))
			.orderBy(desc(marketingConsent.id)),
		db
			.select({
				id: storeCredit.id,
				amount: storeCredit.amount,
				currency: storeCredit.currency,
				reason: storeCredit.reason,
				refType: storeCredit.refType,
				refId: storeCredit.refId,
				expiresAt: storeCredit.expiresAt,
				note: storeCredit.note,
				createdById: storeCredit.createdBy,
				createdBy: issuer.name,
				createdAt: storeCredit.createdAt
			})
			.from(storeCredit)
			.leftJoin(issuer, eq(storeCredit.createdBy, issuer.id))
			.where(eq(storeCredit.customerId, id))
			.orderBy(desc(storeCredit.createdAt), desc(storeCredit.id)),
		db
			.select({
				id: order.id,
				number: order.number,
				channel: order.channel,
				placedAt: order.placedAt,
				status: order.status,
				paymentState: order.paymentState,
				total: order.total,
				paid: sql<number>`${order.amountPaid} - ${order.amountRefunded}`.mapWith(Number)
			})
			.from(order)
			.where(eq(order.customerId, id))
			.orderBy(desc(order.placedAt)),
		db
			.select({
				id: invoice.id,
				number: invoice.number,
				status: invoice.status,
				total: invoice.total,
				amountPaid: invoice.amountPaid,
				dueOn: invoice.dueOn
			})
			.from(invoice)
			.where(eq(invoice.customerId, id))
			.orderBy(desc(invoice.id)),
		db
			.select({
				id: ticket.id,
				code: ticket.code,
				visitDate: ticket.visitDate,
				ticketTypeId: ticket.ticketTypeId,
				ticketType: enOf(ticketType.name),
				admits: ticket.admits,
				checkedIn: ticket.checkedIn,
				status: ticket.status,
				orderId: ticket.orderId
			})
			.from(ticket)
			.innerJoin(ticketType, eq(ticket.ticketTypeId, ticketType.id))
			.where(eq(ticket.customerId, id))
			.orderBy(desc(ticket.visitDate)),
		db
			.select({
				id: membership.id,
				number: membership.number,
				planId: membership.planId,
				plan: enOf(membershipPlan.name),
				status: membership.status,
				startsOn: membership.startsOn,
				endsOn: membership.endsOn
			})
			.from(membership)
			.innerJoin(membershipPlan, eq(membership.planId, membershipPlan.id))
			.where(eq(membership.customerId, id))
			.orderBy(desc(membership.id)),
		db
			.select({
				id: subscription.id,
				number: subscription.number,
				status: subscription.status,
				frequency: subscription.frequency,
				variantId: subscription.variantId,
				product: enOf(product.name),
				left: sql<number>`${subscription.deliveriesPurchased} - ${subscription.deliveriesUsed}`.mapWith(
					Number
				),
				nextRoastDate: subscription.nextRoastDate
			})
			.from(subscription)
			.innerJoin(productVariant, eq(subscription.variantId, productVariant.id))
			.innerJoin(product, eq(productVariant.productId, product.id))
			.where(eq(subscription.customerId, id))
			.orderBy(desc(subscription.id)),
		db
			.select({
				id: booking.id,
				number: booking.number,
				bookableId: booking.bookableId,
				bookable: enOf(bookable.name),
				status: booking.status,
				partySize: booking.partySize,
				confirmedStartsAt: booking.confirmedStartsAt,
				createdAt: booking.createdAt
			})
			.from(booking)
			.innerJoin(bookable, eq(booking.bookableId, bookable.id))
			.where(and(eq(booking.customerId, id), isNull(booking.deletedAt)))
			.orderBy(desc(booking.id)),
		db
			.select({
				id: formSubmission.id,
				formType: formSubmission.formType,
				status: formSubmission.status,
				subject: formSubmission.subject,
				submittedAt: formSubmission.submittedAt
			})
			.from(formSubmission)
			.where(and(eq(formSubmission.customerId, id), isNull(formSubmission.deletedAt)))
			.orderBy(desc(formSubmission.submittedAt)),
		db
			.select({
				id: notification.id,
				channel: notification.channel,
				templateKey: notification.templateKey,
				recipient: notification.recipient,
				status: notification.status,
				isMarketing: notification.isMarketing,
				createdAt: notification.createdAt
			})
			.from(notification)
			.where(eq(notification.customerId, id))
			.orderBy(desc(notification.id))
			.limit(30),
		db
			.select({
				id: aiConversation.id,
				channel: aiConversation.channel,
				startedAt: aiConversation.startedAt,
				lastMessageAt: aiConversation.lastMessageAt,
				messages:
					sql<number>`(select count(*) from ${aiMessage} m where m.conversation_id = ${aiConversation.id})`.mapWith(
						Number
					)
			})
			.from(aiConversation)
			.where(eq(aiConversation.customerId, id))
			.orderBy(desc(aiConversation.startedAt)),
		db
			.select({
				id: businessAccount.id,
				name: businessAccount.name,
				type: businessAccount.type,
				approvalStatus: businessAccount.approvalStatus,
				isAdmin: businessMember.isAdmin
			})
			.from(businessMember)
			.innerJoin(businessAccount, eq(businessMember.businessAccountId, businessAccount.id))
			.where(
				and(
					eq(businessMember.customerId, id),
					isNull(businessMember.deletedAt),
					isNull(businessAccount.deletedAt)
				)
			),
		stampsOf(c),
		deliveryAreaOptions()
	]);

	// The current consent per channel is its latest row; none means never asked — not messaged.
	const consentNow = CONTACT_CHANNELS.map((channel) => {
		const latest = consents.find((x) => x.channel === channel);
		return { channel, granted: latest?.granted ?? null, at: latest?.recordedAt ?? null };
	});
	const now = Date.now();
	const creditBalance = credits
		.filter((x) => !x.expiresAt || new Date(x.expiresAt).getTime() > now)
		.reduce((sum, x) => sum + Number(x.amount), 0);

	const [editForm, addressForm, addressEditForm, consentForm, creditForm] = await Promise.all([
		superValidate(
			{
				id: c.id,
				name: c.name ?? '',
				phone: c.phone,
				email: c.email,
				locale: c.locale as Lang,
				tin: c.tin,
				businessName: c.businessName,
				telegramChatId: c.telegramChatId,
				source: c.source,
				notes: c.notes,
				isActive: c.isActive
			},
			zod4(customerEditSchema),
			{ errors: false }
		),
		superValidate(
			{ recipientName: c.name, phone: c.phone, city: 'Addis Ababa', isDefault: !addresses.length },
			zod4(addressSchema),
			{ errors: false, id: 'address' }
		),
		superValidate(zod4(addressEditSchema), { errors: false, id: 'addressEdit' }),
		superValidate({ source: 'staff', granted: 'granted' }, zod4(consentSchema), {
			errors: false,
			id: 'consent'
		}),
		superValidate({ direction: 'credit', reason: 'goodwill' }, zod4(creditSchema), {
			errors: false,
			id: 'credit'
		})
	]);

	return {
		customer: c,
		account,
		addresses,
		consents,
		consentNow,
		credits,
		creditBalance,
		orders,
		invoices,
		tickets,
		memberships,
		subscriptions,
		bookings,
		submissions,
		messages,
		chats,
		businesses,
		stamps,
		areas,
		spent: orders.reduce((sum, o) => sum + Number(o.paid), 0),
		canManage: hasPermission(locals, 'customers.manage'),
		editForm,
		addressForm,
		addressEditForm,
		consentForm,
		creditForm
	};
};

const manage = (event: { locals: App.Locals }) =>
	requirePermission(event.locals, 'customers.manage');

/** Only one default address: setting one clears the others. */
async function clearDefault(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	customerId: number
) {
	await tx
		.update(customerAddress)
		.set({ isDefault: false })
		.where(eq(customerAddress.customerId, customerId));
}

export const actions = {
	edit: async (event) => {
		manage(event);
		const form = await superValidate(event.request, zod4(customerEditSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		// The record saved is the one in the URL; the form's hidden id is not trusted.
		const { id: _id, ...values } = form.data;
		void _id;
		const before = await loadCustomer(event.params.id);
		const id = before.id;
		if (before.anonymizedAt) {
			return message(
				form,
				{ type: 'error', text: 'An anonymised customer cannot be edited.' },
				{ status: 400 }
			);
		}
		const known = await customerByPhone(values.phone, id);
		if (known) {
			const text = `${known.name ?? 'Another customer'} already has this number.`;
			setError(form, 'phone', text);
			return message(form, { type: 'error', text }, { status: 400 });
		}
		await db.transaction(async (tx) => {
			await tx
				.update(customer)
				.set({ ...values, updatedBy: event.locals.user?.id })
				.where(eq(customer.id, id));
			await recordAudit(tx, event, {
				table: 'customer',
				recordId: id,
				action: 'update',
				before,
				after: values
			});
		});
		return message(form, { type: 'success', text: 'Customer saved' });
	},

	addAddress: async (event) => {
		manage(event);
		const c = await loadCustomer(event.params.id);
		const form = await superValidate(event.request, zod4(addressSchema), { id: 'address' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the address' }, { status: 400 });
		await db.transaction(async (tx) => {
			if (form.data.isDefault) await clearDefault(tx, c.id);
			await tx
				.insert(customerAddress)
				.values({ ...form.data, customerId: c.id, createdBy: event.locals.user?.id });
		});
		return message(form, { type: 'success', text: 'Address added' });
	},

	editAddress: async (event) => {
		manage(event);
		const c = await loadCustomer(event.params.id);
		const form = await superValidate(event.request, zod4(addressEditSchema), { id: 'addressEdit' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the address' }, { status: 400 });
		const { id, ...values } = form.data;
		await db.transaction(async (tx) => {
			if (values.isDefault) await clearDefault(tx, c.id);
			await tx
				.update(customerAddress)
				.set({ ...values, updatedBy: event.locals.user?.id })
				.where(and(eq(customerAddress.id, id), eq(customerAddress.customerId, c.id)));
		});
		return message(form, { type: 'success', text: 'Address saved' });
	},

	deleteAddress: async (event) => {
		manage(event);
		const c = await loadCustomer(event.params.id);
		const id = Number((await event.request.formData()).get('id'));
		await db
			.update(customerAddress)
			.set(deletionStamp(event.locals.user?.id))
			.where(and(eq(customerAddress.id, id), eq(customerAddress.customerId, c.id)));
		return { message: { type: 'success', text: 'Address removed' } };
	},

	/** Consent is append-only (9.3): a grant or a withdrawal is a new row, the proof of it. */
	consent: async (event) => {
		manage(event);
		const c = await loadCustomer(event.params.id);
		const form = await superValidate(event.request, zod4(consentSchema), { id: 'consent' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		await db.insert(marketingConsent).values({
			customerId: c.id,
			channel: form.data.channel,
			granted: form.data.granted === 'granted',
			source: form.data.source,
			ipAddress: event.getClientAddress(),
			recordedBy: event.locals.user?.id
		});
		return message(form, {
			type: 'success',
			text: `${form.data.channel.toUpperCase()} consent ${form.data.granted}`
		});
	},

	/** A credit or debit on the store-credit ledger; the balance is its sum. Audited. */
	credit: async (event) => {
		manage(event);
		const c = await loadCustomer(event.params.id);
		const form = await superValidate(event.request, zod4(creditSchema), { id: 'credit' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { direction, amount, expiresAt, ...rest } = form.data;
		const signed = direction === 'debit' ? -amount : amount;
		try {
			await db.transaction(async (tx) => {
				// A debit takes no more than the customer holds; the row lock keeps two from both passing.
				if (direction === 'debit') {
					const balance = await creditBalance(tx, c.id);
					if (amount > balance + 0.005) {
						throw new WriteRefused(
							'amount',
							`The balance is ${balance.toFixed(2)}; a debit cannot take it below zero.`
						);
					}
				}
				const [res] = await tx.insert(storeCredit).values({
					...rest,
					customerId: c.id,
					amount: signed,
					// The end of that day in Addis Ababa, whatever the server's time zone.
					expiresAt: expiresAt ? fromLocal(expiresAt, '23:59') : null,
					createdBy: event.locals.user?.id
				});
				await recordAudit(tx, event, {
					table: 'store_credit',
					recordId: res.insertId,
					action: 'create',
					detail: { customerId: c.id, amount: signed }
				});
			});
		} catch (err) {
			if (!(err instanceof WriteRefused)) throw err;
			if (err.field) setError(form, err.field as never, err.message);
			return message(form, { type: 'error', text: err.message }, { status: 400 });
		}
		return message(form, {
			type: 'success',
			text: `${direction === 'debit' ? 'Debit' : 'Credit'} recorded`
		});
	},

	anonymise: async (event) => {
		manage(event);
		const c = await loadCustomer(event.params.id);
		if (c.anonymizedAt) return { message: { type: 'error', text: 'Already anonymised.' } };
		await db.transaction(async (tx) => {
			await anonymiseCustomer(tx, c.id, event.locals.user?.id);
			await recordAudit(tx, event, {
				table: 'customer',
				recordId: c.id,
				action: 'update',
				detail: { anonymised: true }
			});
		});
		return { message: { type: 'success', text: 'Personal data wiped; orders and tickets kept.' } };
	},

	/** Only a customer nothing names; otherwise the refusal says what does. */
	delete: async (event) => {
		manage(event);
		const c = await loadCustomer(event.params.id);
		const refs = await customerReferences(c.id);
		if (refs.length) {
			return {
				message: {
					type: 'error',
					text: `Has ${refs.map((r) => `${r.n} ${r.label}`).join(', ')} — switch off or anonymise instead.`
				}
			};
		}
		await db.transaction(async (tx) => {
			await tx
				.update(customer)
				.set(deletionStamp(event.locals.user?.id))
				.where(eq(customer.id, c.id));
			await recordAudit(tx, event, { table: 'customer', recordId: c.id, action: 'delete' });
		});
		redirect(
			'/dashboard/customers',
			{ type: 'success', message: `${c.name ?? 'Customer'} deleted` },
			event.cookies
		);
	}
};
