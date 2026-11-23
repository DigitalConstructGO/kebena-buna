/**
 * Buying tickets on the public site: timed-entry tickets (`/visit`) and event tickets
 * (`/events/{slug}`). Both price per audience (6.1), hold their places at checkout and are paid
 * through the order; a zero-total order is completed at once (`completeFreeOrder`), so free
 * tickets come with their QR codes straight away.
 */
import { and, asc, eq, gt, isNull, or } from 'drizzle-orm';
import { redirect, type RequestEvent } from '@sveltejs/kit';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { db } from '#lib/server/db/index.ts';
import { audience, event, ticketPrice, ticketType, visitDay, visitSlot } from '#lib/server/db/schema.ts';
import type { Localized } from '#lib/server/db/fields.ts';
import {
	createWebOrder,
	customerFor,
	orderByIdempotencyKey,
	paymentsOn,
	recordConsent,
	startPayment,
	trackHref,
	toCheckout
} from '#lib/server/site.ts';
import { holdTicketPlaces } from '#lib/server/tickets.ts';
import { completeFreeOrder } from '#lib/server/freeOrders.ts';
import { m } from '#lib/paraglide/messages.js';

/** A refusal to show under one form field. */
export class OrderRefused extends Error {
	constructor(
		public field: string,
		message: string
	) {
		super(message);
	}
}

/** The audiences a visitor can buy as: resident, foreign… in their order. */
export function activeAudiences() {
	return db
		.select({
			id: audience.id,
			code: audience.code,
			name: audience.name,
			colour: audience.colour,
			requiresIdCheck: audience.requiresIdCheck,
			declaration: audience.declaration,
			isDefault: audience.isDefault
		})
		.from(audience)
		.where(and(eq(audience.status, true), isNull(audience.deletedAt)))
		.orderBy(asc(audience.sortOrder), asc(audience.id));
}

/**
 * The ticket types on sale to `audienceId`: museum entry (`eventId` null) or one event's own.
 * A type with no price for the audience is not sold to it; staff-only and members-only types are
 * never sold here.
 */
export function ticketTypesFor(audienceId: number, eventId: number | null) {
	return db
		.select({
			id: ticketType.id,
			code: ticketType.code,
			name: ticketType.name,
			description: ticketType.description,
			requiresProof: ticketType.requiresProof,
			minQuantity: ticketType.minQuantity,
			maxQuantity: ticketType.maxQuantity,
			admits: ticketType.admitsPerTicket,
			taxRateId: ticketType.taxRateId,
			price: ticketPrice.price
		})
		.from(ticketType)
		.innerJoin(
			ticketPrice,
			and(
				eq(ticketPrice.ticketTypeId, ticketType.id),
				eq(ticketPrice.audienceId, audienceId),
				eq(ticketPrice.status, true),
				isNull(ticketPrice.deletedAt)
			)
		)
		.where(
			and(
				eventId === null ? isNull(ticketType.eventId) : eq(ticketType.eventId, eventId),
				eq(ticketType.isActive, true),
				isNull(ticketType.deletedAt),
				eq(ticketType.isStaffOnly, false),
				eq(ticketType.isMemberOnly, false)
			)
		)
		.orderBy(asc(ticketType.sortOrder), asc(ticketType.id));
}

/** An event open for registration on the public site, or null. */
export async function openEvent(id: number) {
	const now = new Date();
	const [e] = await db
		.select()
		.from(event)
		.where(
			and(
				eq(event.id, id),
				eq(event.publishStatus, 'published'),
				eq(event.visibility, 'public'),
				eq(event.isActive, true),
				isNull(event.deletedAt),
				gt(event.startsAt, now),
				or(isNull(event.registrationClosesAt), gt(event.registrationClosesAt, now))
			)
		)
		.limit(1);
	return e ?? null;
}

/** A timed-entry slot still open for arrivals, with its day. */
async function openSlot(slotId: number) {
	const [s] = await db
		.select({ id: visitSlot.id, endsAt: visitSlot.endsAt })
		.from(visitSlot)
		.innerJoin(visitDay, eq(visitSlot.visitDayId, visitDay.id))
		.where(
			and(
				eq(visitSlot.id, slotId),
				eq(visitSlot.isClosed, false),
				eq(visitDay.isClosed, false),
				eq(visitDay.isActive, true),
				isNull(visitDay.deletedAt),
				gt(visitSlot.endsAt, new Date())
			)
		)
		.limit(1);
	return s ?? null;
}

export type TicketOrderInput = {
	name: string;
	phone: string;
	email?: string | null;
	audienceId: number;
	/** Museum entry: the arrival slot. */
	slotId?: number | null;
	/** An event's tickets. */
	eventId?: number | null;
	items: { ticketTypeId: number; quantity: number }[];
	declared: boolean;
	marketingConsent: boolean;
	idempotencyKey?: string | null;
};

/**
 * Places a ticket order: checks the audience's declaration, every type and quantity, holds the
 * places and writes the order. Throws `OrderRefused` (with the field to show it under) when
 * something is not on sale or there is no room. Returns the order, `free` when it needed no
 * payment and is already complete.
 */
export async function placeTicketOrder(evt: RequestEvent, input: TicketOrderInput) {
	const again = await orderByIdempotencyKey(input.idempotencyKey);
	if (again) return { ...again, id: null, free: false, existing: true };

	const eventId = input.eventId ?? null;
	const aud = (await activeAudiences()).find((a) => a.id === input.audienceId);
	if (!aud) throw new OrderRefused('audienceId', m.visit_err_audience());
	if (aud.requiresIdCheck && !input.declared) throw new OrderRefused('declared', m.visit_err_declare());

	let slotId: number | null = null;
	let description: Localized | null = null;
	if (eventId) {
		const e = await openEvent(eventId);
		if (!e) throw new OrderRefused('items', m.events_err_closed());
		description = e.title;
	} else {
		if (!input.slotId || !(await openSlot(input.slotId))) throw new OrderRefused('slotId', m.visit_err_slot());
		slotId = input.slotId;
	}

	const types = await ticketTypesFor(aud.id, eventId);
	const picked = input.items.filter((i) => i.quantity > 0);
	if (!picked.length) throw new OrderRefused('items', m.visit_err_none());
	const lines = picked.map((i) => {
		const t = types.find((x) => x.id === i.ticketTypeId);
		if (!t) throw new OrderRefused('items', m.visit_err_type());
		if (i.quantity < t.minQuantity) throw new OrderRefused('items', m.visit_err_min_type({ min: t.minQuantity }));
		if (t.maxQuantity !== null && i.quantity > t.maxQuantity)
			throw new OrderRefused('items', m.visit_err_max_type({ max: t.maxQuantity }));
		return {
			itemType: eventId ? ('event_ticket' as const) : ('ticket' as const),
			description: description ? joinNames(description, t.name) : t.name,
			ticketTypeId: t.id,
			audienceId: aud.id,
			visitSlotId: slotId,
			eventId,
			taxRateId: t.taxRateId,
			quantity: i.quantity,
			unitPrice: Number(t.price)
		};
	});

	try {
		return await db.transaction(async (tx) => {
			const customerId = await customerFor(tx, { name: input.name, phone: input.phone, email: input.email });
			await holdTicketPlaces(
				tx,
				lines.map((l) => ({ quantity: l.quantity, ticketTypeId: l.ticketTypeId, visitSlotId: l.visitSlotId, eventId: l.eventId })),
				eventId ? 'items' : 'slotId'
			);
			const placed = await createWebOrder(tx, evt, {
				customerId,
				contact: { name: input.name, phone: input.phone, email: input.email },
				lines,
				deliveryMethod: 'none',
				residencyDeclared: aud.requiresIdCheck && input.declared,
				idempotencyKey: input.idempotencyKey
			});
			if (input.marketingConsent) await recordConsent(tx, evt, customerId, input, 'ticket_checkout');
			const free = placed.total < 0.005 && (await completeFreeOrder(tx, placed.id));
			return { ...placed, free, existing: false };
		});
	} catch (err) {
		if (err instanceof WriteRefused) {
			throw new OrderRefused(eventId ? 'items' : 'slotId', eventId ? m.events_err_full() : m.visit_err_full());
		}
		// The same form sent twice at once: the second finds the first one's order.
		if ((err as { code?: string })?.code === 'ER_DUP_ENTRY' || (err as { cause?: { code?: string } })?.cause?.code === 'ER_DUP_ENTRY') {
			const first = await orderByIdempotencyKey(input.idempotencyKey);
			if (first) return { ...first, id: null, free: false, existing: true };
		}
		throw err;
	}
}

/** "Cupping evening — Standard", in every language either name has. */
function joinNames(a: Localized, b: Localized): Localized {
	const out: Localized = {};
	for (const lang of new Set([...Object.keys(a), ...Object.keys(b)])) {
		const x = a[lang] || a.en || '';
		const y = b[lang] || b.en || '';
		out[lang] = x && y ? `${x} — ${y}` : x || y;
	}
	return out;
}

/**
 * Where a placed order goes next: Chapa's checkout when there is money to take and Chapa is set
 * up, else the order's own page (its tickets, if it was free; "we will call you", if not).
 */
export async function afterOrder(
	evt: RequestEvent,
	placed: { id: number | null; number: string; payToken: string | null; free: boolean; existing: boolean }
): Promise<never> {
	if (placed.id && !placed.free && !placed.existing && paymentsOn()) {
		let url: string | null = null;
		try {
			url = await startPayment(evt, placed.id);
		} catch (err) {
			// The order stands; its page offers "Pay now" again.
			console.error('[tickets] could not start the Chapa checkout:', err);
		}
		if (url) toCheckout(url);
	}
	redirect(303, trackHref(placed));
}
