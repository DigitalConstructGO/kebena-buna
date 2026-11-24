/** Writing an event: its words (the description sanitised), its times, its picture. */
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { storeFileFields } from '@nahu/admin-kit/server/files';
import { localDate } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { shiftAssignments } from '#lib/server/bookings.ts';
import { customer, event, order, orderLine, ticket } from '#lib/server/db/schema.ts';
import { eventHeld } from '#lib/server/tickets.ts';
import { voidTicket } from '#lib/server/visits.ts';
import { moveOrder, refundClaims, refundable, requestRefund } from '#lib/server/orders.ts';
import { releaseDiscount } from '#lib/server/discounts.ts';
import { queueMessage } from '#lib/server/notify.ts';
import { flatLocalized, packLocalized, toRichLocalized } from '#lib/server/localized.ts';
import { tr } from '#lib/format.ts';
import { joinDateTime, splitDateTime } from '#lib/server/records.ts';
import type { eventEditSchema } from '#lib/schemas/visits.ts';
import type { z } from 'zod/v4';

type EventForm = z.infer<typeof eventEditSchema>;

/** The form's fields for an event row: date + time pairs, one field per language. */
export function eventFormValues(e: typeof event.$inferSelect) {
	const start = splitDateTime(e.startsAt);
	const end = splitDateTime(e.endsAt);
	const closes = splitDateTime(e.registrationClosesAt);
	return {
		slug: e.slug,
		...flatLocalized(e, ['title', 'summary', 'description']),
		locationId: e.locationId,
		startDate: start.date,
		startTime: start.time,
		endDate: end.date,
		endTime: end.time,
		capacity: e.capacity,
		visibility: e.visibility,
		isFree: e.isFree,
		includesEntry: e.includesEntry,
		closesDate: closes.date || null,
		closesTime: closes.time || null,
		publishStatus: e.publishStatus,
		isActive: e.isActive
	};
}

/**
 * Adds (no `id`) or updates an event, audited; returns its id. Refuses an end before the start,
 * and a capacity below the people already registered. Staff on it move with its times.
 */
export async function saveEvent(
	req: RequestEvent,
	data: Partial<EventForm> & Omit<EventForm, 'isActive'>,
	posted: FormData,
	id?: number
): Promise<number> {
	const startsAt = joinDateTime(data.startDate, data.startTime);
	const endsAt = joinDateTime(data.endDate, data.endTime);
	if (endsAt <= startsAt) throw new WriteRefused('endTime', 'It must end after it starts');
	const values: Record<string, unknown> = packLocalized(
		{
			slug: data.slug,
			titleEn: data.titleEn,
			titleAm: data.titleAm,
			titleOm: data.titleOm,
			titleAr: data.titleAr,
			titleIt: data.titleIt,
			titleFr: data.titleFr,
			summaryEn: data.summaryEn,
			summaryAm: data.summaryAm,
			summaryOm: data.summaryOm,
			summaryAr: data.summaryAr,
			summaryIt: data.summaryIt,
			summaryFr: data.summaryFr,
			image: data.image,
			locationId: data.locationId,
			capacity: data.capacity,
			visibility: data.visibility,
			isFree: data.isFree,
			includesEntry: data.includesEntry,
			publishStatus: data.publishStatus,
			...(data.isActive === undefined ? {} : { isActive: data.isActive })
		},
		['title', 'summary']
	);
	values.description = toRichLocalized(data, 'description');
	values.startsAt = startsAt;
	values.endsAt = endsAt;
	values.registrationClosesAt = data.closesDate
		? joinDateTime(data.closesDate, data.closesTime)
		: null;
	await storeFileFields(values, ['image'], posted);

	return db.transaction(async (tx) => {
		if (id) {
			const [before] = await tx.select().from(event).where(eq(event.id, id)).for('update');
			// Places in unpaid orders are spoken for as well, until those orders are paid or lapse.
			const taken = before.registered + (await eventHeld(tx, id));
			if (data.capacity < taken)
				throw new WriteRefused(
					'capacity',
					`${taken} places are taken already (registered or in unpaid orders)`
				);
			await tx
				.update(event)
				.set({ ...(values as Partial<typeof event.$inferInsert>), updatedBy: req.locals.user?.id })
				.where(eq(event.id, id));
			// Its staff move with it, so the double-booking check reads the real times…
			await shiftAssignments(tx, { eventId: id }, before, { startsAt, endsAt });
			// …and so do its tickets, which the scanner admits only on their date.
			if (localDate(before.startsAt) !== localDate(startsAt))
				await tx
					.update(ticket)
					.set({ visitDate: localDate(startsAt) })
					.where(and(eq(ticket.eventId, id), eq(ticket.status, 'valid')));
			await recordAudit(tx, req, {
				table: 'event',
				recordId: id,
				action: 'update',
				before,
				after: values
			});
			return id;
		}
		const [res] = await tx.insert(event).values({
			...(values as unknown as typeof event.$inferInsert),
			createdBy: req.locals.user?.id
		});
		await recordAudit(tx, req, { table: 'event', recordId: res.insertId, action: 'create' });
		return res.insertId;
	});
}

/**
 * Calls an event off (8.3): it comes off the website, its unpaid orders are cancelled, every ticket
 * not yet used is cancelled so the scanner turns it away, each paid order gets a refund request for
 * its event tickets — approved and paid back as any refund — and every buyer is told. Returns how
 * many orders were touched and refunds asked for.
 */
export async function cancelEvent(req: RequestEvent, eventId: number, reason: string) {
	const userId = req.locals.user?.id ?? null;
	return db.transaction(async (tx) => {
		const [e] = await tx.select().from(event).where(eq(event.id, eventId)).for('update');
		if (!e) throw new WriteRefused(null, 'Event not found');
		const values = { publishStatus: 'archived' as const, isActive: false, updatedBy: userId };
		await tx.update(event).set(values).where(eq(event.id, e.id));

		const lines = await tx
			.select({ line: orderLine, o: order })
			.from(orderLine)
			.innerJoin(order, eq(orderLine.orderId, order.id))
			.where(
				and(eq(orderLine.eventId, e.id), ne(order.status, 'cancelled'), isNull(order.deletedAt))
			);
		const note = `${tr(e.title, 'en')} cancelled: ${reason}`.slice(0, 255);

		// Unpaid orders simply end: nothing was paid and no ticket was issued.
		const unpaid = [
			...new Map(
				lines.filter((l) => l.o.status === 'pending_payment').map((l) => [l.o.id, l.o])
			).values()
		];
		for (const o of unpaid) {
			await moveOrder(tx, req, o, 'cancelled', {
				force: true,
				note,
				extra: { cancelReason: note }
			});
			await releaseDiscount(tx, o.id);
		}

		const tickets = await tx
			.select({
				id: ticket.id,
				code: ticket.code,
				orderId: ticket.orderId,
				customerId: ticket.customerId
			})
			.from(ticket)
			.where(and(eq(ticket.eventId, e.id), eq(ticket.status, 'valid')));
		for (const t of tickets) await voidTicket(tx, t.id, 'cancelled', note, userId);

		// Paid orders: the event's lines are asked back, each for what is left of it.
		let refunds = 0;
		const paid = lines.filter((l) => l.o.status !== 'pending_payment');
		for (const { line, o } of paid) {
			try {
				const claims = await refundClaims(tx, o.id);
				const [left] = refundable([line], claims.pending);
				if (!left) continue;
				await requestRefund(tx, req, o.id, {
					whole: false,
					orderLineId: line.id,
					quantity: left.left,
					restock: false,
					toStoreCredit: false,
					feeRetained: 0,
					reason: note
				});
				refunds++;
			} catch (err) {
				// A free registration has nothing to give back.
				if (!(err instanceof WriteRefused)) throw err;
			}
		}

		// Everyone who had places is told, once per order.
		const told = new Map(lines.map((l) => [l.o.id, l.o]));
		for (const o of told.values()) {
			await queueMessage(
				tx,
				'event.cancelled',
				{
					phone: o.contactPhone,
					email: o.contactEmail,
					locale: o.locale,
					customerId: o.customerId
				},
				{
					name: o.contactName,
					event: tr(e.title, o.locale),
					date: localDate(e.startsAt),
					reason,
					order_number: o.number
				},
				{ refType: 'event', refId: e.id, dedupe: `event:${e.id}:cancelled:${o.id}` }
			);
		}
		// Places given at the desk have no order: their holders are told by the ticket's code.
		const loose = new Map<number, string>();
		for (const t of tickets)
			if (!t.orderId && t.customerId && !loose.has(t.customerId)) loose.set(t.customerId, t.code);
		const holders = loose.size
			? await tx
					.select()
					.from(customer)
					.where(inArray(customer.id, [...loose.keys()]))
			: [];
		for (const c of holders) {
			await queueMessage(
				tx,
				'event.cancelled',
				{ phone: c.phone, email: c.email, locale: c.locale, customerId: c.id },
				{
					name: c.name,
					event: tr(e.title, c.locale),
					date: localDate(e.startsAt),
					reason,
					order_number: loose.get(c.id) ?? ''
				},
				{ refType: 'event', refId: e.id, dedupe: `event:${e.id}:cancelled:c${c.id}` }
			);
		}
		await recordAudit(tx, req, {
			table: 'event',
			recordId: e.id,
			action: 'update',
			before: e,
			after: values,
			detail: { cancelled: reason, orders: told.size, holders: holders.length, refunds }
		});
		return { orders: told.size + holders.length, refunds, tickets: tickets.length };
	});
}
