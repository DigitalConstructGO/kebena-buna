/**
 * The public visit forms: entry tickets (`/visit`), event tickets and registrations
 * (`/events/{slug}`), and booking requests for tours, ceremonies and cuppings
 * (`/experiences/{slug}`). Client-safe, so each form checks itself before posting.
 */
import { z } from 'zod/v4';
import { m } from '#lib/paraglide/messages.js';
import {
	buyerFields,
	siteCount,
	siteFormBase,
	siteOptionalDate,
	siteOptionalEmail,
	siteOptionalText,
	sitePhone,
	siteText
} from '#lib/schemas/site.ts';

/** How many of each ticket type: one row per type on sale, most left at 0. */
const ticketItems = z
	.array(z.object({ ticketTypeId: z.number().int().positive(), quantity: z.number().int().min(0).max(100) }))
	.default([]);

const atLeastOne = (d: { items: { quantity: number }[] }) => d.items.some((i) => i.quantity > 0);

/** Museum entry: an arrival slot, an audience, tickets per type, and the buyer. */
export const ticketOrderSchema = z
	.object({
		...buyerFields,
		...siteFormBase,
		slotId: z.coerce.number({ error: () => m.visit_err_slot() }).int().positive({ error: () => m.visit_err_slot() }),
		audienceId: z.coerce.number().int().positive(),
		/** The audience's ID declaration (6.2), when it has one. */
		declared: z.boolean().default(false),
		items: ticketItems
	})
	.refine(atLeastOne, { path: ['items'], error: () => m.visit_err_none() });

/** An event's own tickets: like entry, without a slot. */
export const eventOrderSchema = z
	.object({
		...buyerFields,
		...siteFormBase,
		audienceId: z.coerce.number().int().positive(),
		declared: z.boolean().default(false),
		items: ticketItems
	})
	.refine(atLeastOne, { path: ['items'], error: () => m.visit_err_none() });

/** An event with no ticket types of its own: a registration for the inbox (8.4). */
export const eventRegisterSchema = z.object({
	name: siteText(150),
	phone: sitePhone,
	email: siteOptionalEmail,
	seats: siteCount(1, 20).default(1),
	...siteFormBase
});

/** A booking request for a tour, ceremony or cupping (8.4): staff confirm it from the inbox. */
export const bookingRequestSchema = z.object({
	name: siteText(150),
	phone: sitePhone,
	email: siteOptionalEmail,
	/** A session, for bookables that run them; enquiry-only ones ask for a date instead. */
	sessionId: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.coerce.number().int().positive().nullable()).default(null),
	preferredDate: siteOptionalDate,
	partySize: siteCount(1, 250).default(1),
	language: siteOptionalText(8),
	specialRequests: siteOptionalText(2000),
	accessibilityNeeds: siteOptionalText(1000),
	...siteFormBase
});
