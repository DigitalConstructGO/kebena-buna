/**
 * Customers: what a list shows about each (orders, spend, credit), the references that keep one
 * from being deleted, and wiping a person's data while their orders stay (questionnaire 9.4).
 */
import { and, count, eq, isNull, ne, sql } from 'drizzle-orm';
import type { AnyMySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import type { Writer } from '@nahu/admin-kit/server/db';
import { db } from '#lib/server/db/index.ts';
import {
	aiConversation,
	booking,
	businessMember,
	customer,
	customerAddress,
	formSubmission,
	invoice,
	membership,
	order,
	storeCredit,
	subscription,
	ticket
} from '#lib/server/db/schema.ts';

/** Orders placed, as SQL over `customer`. Cancelled orders are not counted. */
export const ordersCountOf =
	sql<number>`(select count(*) from ${order} o where o.customer_id = ${customer.id} and o.status <> 'cancelled')`.mapWith(
		Number
	);

/** What they have paid, less refunds, as SQL over `customer`. */
export const spentOf =
	sql<number>`(select coalesce(sum(o.amount_paid - o.amount_refunded), 0) from ${order} o where o.customer_id = ${customer.id})`.mapWith(
		Number
	);

/** Store credit they can still spend: the ledger's sum, less lines that have expired. */
export const creditOf =
	sql<number>`(select coalesce(sum(sc.amount), 0) from ${storeCredit} sc where sc.customer_id = ${customer.id} and (sc.expires_at is null or sc.expires_at > now()))`.mapWith(
		Number
	);

/**
 * What a customer can spend now, with their row locked so two spends in flight cannot both pass
 * the check. Call it first, then write the debit in the same transaction.
 */
export async function creditBalance(tx: Writer, customerId: number) {
	await tx
		.select({ id: customer.id })
		.from(customer)
		.where(eq(customer.id, customerId))
		.for('update');
	const [row] = await tx
		.select({ balance: sql<number>`coalesce(sum(${storeCredit.amount}), 0)`.mapWith(Number) })
		.from(storeCredit)
		.where(
			and(
				eq(storeCredit.customerId, customerId),
				sql`(${storeCredit.expiresAt} is null or ${storeCredit.expiresAt} > now())`
			)
		);
	return Math.round((row?.balance ?? 0) * 100) / 100;
}

/** Another customer with this phone, if any. */
export async function customerByPhone(phone: string | null | undefined, exceptId?: number) {
	if (!phone) return null;
	const [row] = await db
		.select({ id: customer.id, name: customer.name })
		.from(customer)
		.where(
			and(
				eq(customer.phone, phone),
				isNull(customer.deletedAt),
				exceptId ? ne(customer.id, exceptId) : undefined
			)
		);
	return row ?? null;
}

/**
 * What names this customer, by kind: a customer with any of it is switched off or anonymised,
 * never deleted — their orders, tickets and memberships must keep someone to point at.
 */
export async function customerReferences(id: number) {
	const tally = (table: MySqlTable & { customerId: AnyMySqlColumn }, label: string) =>
		db
			.select({ n: count() })
			.from(table)
			.where(eq(table.customerId, id))
			.then(([r]) => ({ label, n: r.n }));
	const counts = await Promise.all([
		tally(order, 'orders'),
		tally(invoice, 'invoices'),
		tally(ticket, 'tickets'),
		tally(membership, 'memberships'),
		tally(subscription, 'subscriptions'),
		tally(booking, 'bookings'),
		tally(formSubmission, 'form submissions'),
		tally(aiConversation, 'chats'),
		tally(businessMember, 'business accounts'),
		tally(storeCredit, 'store-credit lines')
	]);
	return counts.filter((c) => c.n > 0);
}

/**
 * Wipes what identifies the person (9.4): name, phone, email, TIN, notes and their addresses, and
 * the copies of them on their orders, invoices and tickets. Orders, tickets and payments stay,
 * with no name attached; the sign-in is unlinked.
 */
export async function anonymiseCustomer(tx: Writer, id: number, userId: string | undefined) {
	await tx
		.update(customer)
		.set({
			name: null,
			phone: null,
			email: null,
			tin: null,
			businessName: null,
			telegramChatId: null,
			notes: null,
			userId: null,
			extra: null,
			anonymizedAt: new Date(),
			isActive: false,
			updatedBy: userId ?? null
		})
		.where(eq(customer.id, id));
	await tx
		.update(customerAddress)
		.set({
			recipientName: null,
			phone: null,
			line1: 'Removed',
			landmark: null,
			latitude: null,
			longitude: null,
			deletedAt: new Date(),
			deletedBy: userId ?? null
		})
		.where(eq(customerAddress.customerId, id));
	// What checkout copied onto each order, and the billing details on their own invoices (a
	// business account's invoices bill the business, not the person).
	await tx
		.update(order)
		.set({
			contactName: null,
			contactPhone: null,
			contactEmail: null,
			customerTin: null,
			customerBusinessName: null,
			deliveryAddress: null,
			ipAddress: null,
			customerNote: null
		})
		.where(eq(order.customerId, id));
	await tx
		.update(invoice)
		.set({ billingName: 'Removed', billingTin: null, billingAddress: null })
		.where(and(eq(invoice.customerId, id), isNull(invoice.businessAccountId)));
	await tx.update(ticket).set({ holderName: null }).where(eq(ticket.customerId, id));
}
