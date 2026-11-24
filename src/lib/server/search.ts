/**
 * The top bar's search: one box for the numbers and names staff are handed at the desk or on the
 * phone — an order or booking number, a phone, a ticket or card code, a customer, a lot or batch
 * code. Each kind is searched only for a viewer allowed to open it, a few results each.
 *
 * A phone matches on its last nine digits, so "0911 22 33 44", "911223344" and "+251911223344"
 * all find the same customer.
 */
import { and, desc, eq, isNull, like, or, type SQL } from 'drizzle-orm';
import { hasPermission } from '@nahu/admin-kit/server/permissions';
import { db } from '#lib/server/db/index.ts';
import {
	booking,
	businessAccount,
	customer,
	formSubmission,
	invoice,
	lot,
	membership,
	membershipMember,
	order,
	packingRun,
	product,
	productVariant,
	roastBatch,
	subscription,
	ticket
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { ENTITIES } from '#lib/navigation.ts';

export type SearchHit = { kind: string; label: string; detail: string | null; url: string };

const PER_KIND = 5;

/** `%term%`, with the LIKE wildcards in what was typed taken literally. */
const contains = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** The last nine digits of a phone typed any way, or null when it is not one. */
export function phoneTail(q: string) {
	const digits = q.replace(/[\s()+-]/g, '');
	return /^\d{6,15}$/.test(digits) ? digits.slice(-9) : null;
}

const url = (entity: string, id: number) => `${ENTITIES[entity]}/${id}`;

export async function searchRecords(
	locals: App.Locals,
	raw: string
): Promise<{ group: string; hits: SearchHit[] }[]> {
	const q = raw.trim().slice(0, 64);
	if (q.length < 2) return [];
	const term = contains(q);
	const code = contains(q.toUpperCase());
	const tail = phoneTail(q);
	const phone = (column: Parameters<typeof like>[0]) =>
		tail ? like(column, `%${tail}`) : undefined;
	const may = (p: Parameters<typeof hasPermission>[1]) => hasPermission(locals, p);

	const groups: { group: string; run: () => Promise<SearchHit[]> }[] = [];
	const add = (group: string, ok: boolean, run: () => Promise<SearchHit[]>) => {
		if (ok) groups.push({ group, run });
	};
	const anyOf = (...conds: (SQL | undefined)[]) => or(...conds.filter(Boolean));

	add('Orders', may('orders.view'), async () =>
		(
			await db
				.select({
					id: order.id,
					number: order.number,
					name: order.contactName,
					phone: order.contactPhone,
					status: order.status
				})
				.from(order)
				.where(
					and(
						isNull(order.deletedAt),
						anyOf(
							like(order.number, code),
							like(order.trackingNumber, term),
							like(order.receiptNumber, term),
							like(order.contactName, term),
							phone(order.contactPhone)
						)
					)
				)
				.orderBy(desc(order.id))
				.limit(PER_KIND)
		).map((r) => ({
			kind: 'order',
			label: r.number,
			detail: [r.name, r.phone, r.status.replaceAll('_', ' ')].filter(Boolean).join(' · '),
			url: url('order', r.id)
		}))
	);

	add('Customers', may('customers.view'), async () =>
		(
			await db
				.select({
					id: customer.id,
					name: customer.name,
					phone: customer.phone,
					email: customer.email
				})
				.from(customer)
				.where(
					and(
						isNull(customer.deletedAt),
						anyOf(
							like(customer.name, term),
							like(customer.email, term),
							like(customer.tin, term),
							phone(customer.phone)
						)
					)
				)
				.orderBy(desc(customer.id))
				.limit(PER_KIND)
		).map((r) => ({
			kind: 'customer',
			label: r.name || r.phone || `Customer #${r.id}`,
			detail: [r.phone, r.email].filter(Boolean).join(' · ') || null,
			url: url('customer', r.id)
		}))
	);

	add('Tickets', may('visits.view'), async () =>
		(
			await db
				.select({
					id: ticket.id,
					code: ticket.code,
					holder: ticket.holderName,
					date: ticket.visitDate,
					status: ticket.status
				})
				.from(ticket)
				.where(like(ticket.code, code))
				.orderBy(desc(ticket.id))
				.limit(PER_KIND)
		).map((r) => ({
			kind: 'ticket',
			label: r.code,
			detail: [r.holder, r.date, r.status].filter(Boolean).join(' · '),
			url: url('ticket', r.id)
		}))
	);

	add('Memberships', may('memberships.view'), async () =>
		(
			await db
				.selectDistinct({
					id: membership.id,
					number: membership.number,
					status: membership.status,
					holder: customer.name
				})
				.from(membership)
				.innerJoin(customer, eq(membership.customerId, customer.id))
				.leftJoin(membershipMember, eq(membershipMember.membershipId, membership.id))
				.where(
					and(
						isNull(membership.deletedAt),
						anyOf(
							like(membership.number, code),
							like(membershipMember.cardCode, code),
							like(membershipMember.name, term),
							like(customer.name, term),
							phone(customer.phone)
						)
					)
				)
				.orderBy(desc(membership.id))
				.limit(PER_KIND)
		).map((r) => ({
			kind: 'membership',
			label: r.number,
			detail: `${r.holder} · ${r.status}`,
			url: url('membership', r.id)
		}))
	);

	add('Subscriptions', may('memberships.view'), async () =>
		(
			await db
				.select({
					id: subscription.id,
					number: subscription.number,
					status: subscription.status,
					holder: customer.name
				})
				.from(subscription)
				.innerJoin(customer, eq(subscription.customerId, customer.id))
				.where(
					and(
						isNull(subscription.deletedAt),
						anyOf(like(subscription.number, code), phone(customer.phone))
					)
				)
				.orderBy(desc(subscription.id))
				.limit(PER_KIND)
		).map((r) => ({
			kind: 'subscription',
			label: r.number,
			detail: `${r.holder} · ${r.status}`,
			url: url('subscription', r.id)
		}))
	);

	add('Bookings', may('bookings.view'), async () =>
		(
			await db
				.select({
					id: booking.id,
					number: booking.number,
					name: booking.contactName,
					status: booking.status
				})
				.from(booking)
				.where(
					and(
						isNull(booking.deletedAt),
						anyOf(
							like(booking.number, code),
							like(booking.contactName, term),
							phone(booking.contactPhone)
						)
					)
				)
				.orderBy(desc(booking.id))
				.limit(PER_KIND)
		).map((r) => ({
			kind: 'booking',
			label: r.number,
			detail: [r.name, r.status.replaceAll('_', ' ')].filter(Boolean).join(' · '),
			url: url('booking', r.id)
		}))
	);

	add('Invoices', may('orders.view'), async () =>
		(
			await db
				.select({ id: invoice.id, number: invoice.number, status: invoice.status })
				.from(invoice)
				.where(and(isNull(invoice.deletedAt), like(invoice.number, code)))
				.orderBy(desc(invoice.id))
				.limit(PER_KIND)
		).map((r) => ({
			kind: 'invoice',
			label: r.number,
			detail: r.status,
			url: url('invoice', r.id)
		}))
	);

	add('Business accounts', may('wholesale.view'), async () =>
		(
			await db
				.select({
					id: businessAccount.id,
					name: businessAccount.name,
					contact: businessAccount.contactName,
					phone: businessAccount.contactPhone
				})
				.from(businessAccount)
				.where(
					and(
						isNull(businessAccount.deletedAt),
						anyOf(
							like(businessAccount.name, term),
							like(businessAccount.tin, term),
							like(businessAccount.contactName, term),
							phone(businessAccount.contactPhone)
						)
					)
				)
				.orderBy(desc(businessAccount.id))
				.limit(PER_KIND)
		).map((r) => ({
			kind: 'business',
			label: r.name,
			detail: [r.contact, r.phone].filter(Boolean).join(' · ') || null,
			url: url('business', r.id)
		}))
	);

	add('Inbox', may('inbox.view'), async () =>
		(
			await db
				.select({
					id: formSubmission.id,
					name: formSubmission.name,
					subject: formSubmission.subject,
					status: formSubmission.status
				})
				.from(formSubmission)
				.where(
					and(
						isNull(formSubmission.deletedAt),
						anyOf(
							like(formSubmission.name, term),
							like(formSubmission.email, term),
							like(formSubmission.subject, term),
							phone(formSubmission.phone)
						)
					)
				)
				.orderBy(desc(formSubmission.id))
				.limit(PER_KIND)
		).map((r) => ({
			kind: 'submission',
			label: r.subject || r.name || `Enquiry #${r.id}`,
			detail: [r.name, r.status.replaceAll('_', ' ')].filter(Boolean).join(' · '),
			url: url('submission', r.id)
		}))
	);

	add('Products', may('catalog.view'), async () =>
		(
			await db
				.selectDistinct({ id: product.id, name: enOf(product.name), sku: productVariant.sku })
				.from(product)
				.leftJoin(productVariant, eq(productVariant.productId, product.id))
				.where(
					and(
						isNull(product.deletedAt),
						anyOf(like(enOf(product.name), term), like(productVariant.sku, code))
					)
				)
				.limit(PER_KIND)
		).map((r) => ({
			kind: 'product',
			label: r.name,
			detail: r.sku,
			url: url('product', r.id)
		}))
	);

	add('Lots', may('origins.view'), async () =>
		(
			await db
				.select({ id: lot.id, code: lot.code })
				.from(lot)
				.where(and(isNull(lot.deletedAt), like(lot.code, code)))
				.orderBy(desc(lot.id))
				.limit(PER_KIND)
		).map((r) => ({ kind: 'lot', label: r.code, detail: null, url: url('lot', r.id) }))
	);

	add('Roasts and packing', may('stock.view'), async () => {
		const [batches, runs] = await Promise.all([
			db
				.select({ id: roastBatch.id, code: roastBatch.code })
				.from(roastBatch)
				.where(and(isNull(roastBatch.deletedAt), like(roastBatch.code, code)))
				.orderBy(desc(roastBatch.id))
				.limit(PER_KIND),
			db
				.select({ id: packingRun.id, code: packingRun.code })
				.from(packingRun)
				.where(like(packingRun.code, code))
				.orderBy(desc(packingRun.id))
				.limit(PER_KIND)
		]);
		return [
			...batches.map((r) => ({
				kind: 'roastBatch',
				label: r.code,
				detail: 'Roast batch',
				url: url('roastBatch', r.id)
			})),
			...runs.map((r) => ({
				kind: 'packingRun',
				label: r.code,
				detail: 'Packing run',
				url: url('packingRun', r.id)
			}))
		].slice(0, PER_KIND);
	});

	const found = await Promise.all(
		groups.map(async (g) => ({ group: g.group, hits: await g.run() }))
	);
	return found.filter((g) => g.hits.length);
}
