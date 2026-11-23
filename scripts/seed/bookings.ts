/**
 * What visitors book (questionnaire 8): bookables with audience prices and weekly schedules,
 * sessions around today, bookings through the inbox workflow with their history and staff, and
 * the shared inbox of form submissions. Session `booked` counters match the bookings in them.
 * Orders and invoices are linked by the orders seed.
 */
import { eq } from 'drizzle-orm';
import { db, schema as s, insertId, L, between, pick, rand, daysFrom, isoFrom } from './db.ts';
import { userIdByEmail } from './base.ts';
import { FORM_TYPES } from '../../src/lib/constants.ts';

type Status = 'new' | 'in_progress' | 'confirmed' | 'done' | 'cancelled' | 'declined';

/** The path a status took through the inbox, for its history rows. */
const PATHS: Record<Status, Status[]> = {
	new: ['new'],
	in_progress: ['new', 'in_progress'],
	confirmed: ['new', 'in_progress', 'confirmed'],
	done: ['new', 'in_progress', 'confirmed', 'done'],
	cancelled: ['new', 'confirmed', 'cancelled'],
	declined: ['new', 'in_progress', 'declined']
};

const at = (date: Date, hhmm: string) => {
	const [h, m] = hhmm.split(':').map(Number);
	const d = new Date(date);
	d.setHours(h, m, 0, 0);
	return d;
};

export async function seed() {
	const manager = await userIdByEmail('manager@kebena.coffee');
	const desk = await userIdByEmail('desk@kebena.coffee');
	const guides = [await userIdByEmail('guide1@kebena.coffee'), await userIdByEmail('guide2@kebena.coffee')];
	const staff = [desk, ...guides, manager];
	const loc = async (code: string) => (await db.select({ id: s.location.id }).from(s.location).where(eq(s.location.code, code)))[0].id;
	const aud = async (code: string) => (await db.select({ id: s.audience.id }).from(s.audience).where(eq(s.audience.code, code)))[0].id;
	const [vat] = await db.select({ id: s.taxRate.id }).from(s.taxRate).where(eq(s.taxRate.code, 'VAT15'));
	const RES = await aud('RES');
	const FOR = await aud('FOR');
	const siteA = await loc('SITE-A');
	const siteB = await loc('SITE-B');
	const cafe = await loc('CAFE');

	// ── Bookables ─────────────────────────────────────────────────────────────────────────────
	type Def = { slug: string; kind: string; name: [string, string]; desc: string; location: number; duration: number; min: number; max: number | null; pricing: string; prepay: boolean; visits: boolean; enquiry: boolean; langs: string[]; prices: [number, number | null] | null; schedule: [number[], string[], number] | null; order: number };
	const defs: Def[] = [
		{ slug: 'guided-tour', kind: 'guided_tour', name: ['Guided museum tour', 'የተመራ የሙዚየም ጉብኝት'], desc: 'An hour through the halls with a guide: the birthplace of coffee to the cup.', location: siteA, duration: 60, min: 1, max: 20, pricing: 'ticket_plus', prepay: true, visits: true, enquiry: false, langs: ['am', 'en'], prices: [150, 150], schedule: [[2, 3, 4, 5, 6, 7], ['10:00', '13:00', '15:00'], 20], order: 1 },
		{ slug: 'coffee-ceremony', kind: 'ceremony', name: ['Traditional coffee ceremony', 'የቡና ሥነ ሥርዓት'], desc: 'Roasting, jebena brewing and three rounds — abol, tona, baraka.', location: cafe, duration: 75, min: 1, max: 12, pricing: 'per_person', prepay: true, visits: false, enquiry: false, langs: ['am', 'en'], prices: [300, 600], schedule: [[2, 3, 4, 5, 6, 7], ['11:00', '14:00', '16:00'], 12], order: 2 },
		{ slug: 'cupping-session', kind: 'cupping', name: ['Cupping with our Q-grader', 'የቡና ቅምሻ'], desc: 'Taste five lots side by side and learn to score them.', location: siteB, duration: 90, min: 1, max: 10, pricing: 'per_person', prepay: true, visits: false, enquiry: false, langs: ['am', 'en'], prices: [500, 500], schedule: [[6], ['10:00'], 10], order: 3 },
		{ slug: 'private-event', kind: 'private_event', name: ['Private event hire', 'የግል ዝግጅት'], desc: 'The outdoor square for weddings, launches and dinners. Quoted on request.', location: siteB, duration: 240, min: 20, max: 250, pricing: 'quote', prepay: false, visits: false, enquiry: true, langs: ['am', 'en'], prices: null, schedule: null, order: 4 },
		{ slug: 'school-visit', kind: 'school_visit', name: ['School visit', 'የትምህርት ቤት ጉብኝት'], desc: 'A guided visit for a class, invoiced to the school.', location: siteA, duration: 90, min: 10, max: 40, pricing: 'per_person', prepay: false, visits: true, enquiry: true, langs: ['am'], prices: [50, null], schedule: null, order: 5 },
		{ slug: 'roasting-class', kind: 'group_visit', name: ['Home roasting class', 'የቤት ቡና ቁሊት ትምህርት'], desc: 'Coming soon.', location: siteB, duration: 120, min: 2, max: 10, pricing: 'per_person', prepay: true, visits: false, enquiry: false, langs: ['am'], prices: [800, 1200], schedule: null, order: 6 }
	];
	const bookables: { id: number; def: Def }[] = [];
	for (const d of defs) {
		const id = await insertId(s.bookable, {
			slug: d.slug,
			kind: d.kind,
			name: L(...d.name),
			description: L(d.desc),
			locationId: d.location,
			durationMin: d.duration,
			minParty: d.min,
			maxParty: d.max,
			pricing: d.pricing,
			requiresPrepayment: d.prepay,
			usesVisitCapacity: d.visits,
			isEnquiryOnly: d.enquiry,
			languages: d.langs,
			holdDays: null,
			taxRateId: vat.id,
			publishStatus: d.slug === 'roasting-class' ? 'draft' : 'published',
			sortOrder: d.order,
			createdBy: manager
		});
		if (d.prices) {
			await db.insert(s.bookablePrice).values([
				{ bookableId: id, audienceId: RES, price: d.prices[0] },
				...(d.prices[1] === null ? [] : [{ bookableId: id, audienceId: FOR, price: d.prices[1] }])
			]);
		}
		if (d.schedule) {
			const [days, times, capacity] = d.schedule;
			for (const weekday of days)
				for (const t of times)
					await db.insert(s.bookableSchedule).values({ bookableId: id, weekday, startsAt: `${t}:00`, capacity, language: pick(d.langs) });
		}
		bookables.push({ id, def: d });
	}

	// ── Sessions, from the schedules, 20 days either side of today ────────────────────────────
	const sessions: { id: number; bookableId: number; startsAt: Date; endsAt: Date; capacity: number; booked: number; cancelled: boolean }[] = [];
	for (const { id, def } of bookables) {
		if (!def.schedule || def.slug === 'roasting-class') continue;
		const [days, times, capacity] = def.schedule;
		for (let offset = -20; offset <= 20; offset++) {
			const day = daysFrom(offset);
			const weekday = ((day.getDay() + 6) % 7) + 1;
			if (!days.includes(weekday)) continue;
			for (const t of times) {
				const startsAt = at(day, t);
				const endsAt = new Date(startsAt.getTime() + def.duration * 60000);
				const cancelled = rand() < 0.03;
				const sid = await insertId(s.bookingSession, {
					bookableId: id,
					startsAt,
					endsAt,
					language: pick(def.langs),
					capacity,
					isCancelled: cancelled,
					notes: cancelled ? 'Guide unwell' : null,
					createdBy: manager
				});
				sessions.push({ id: sid, bookableId: id, startsAt, endsAt, capacity, booked: 0, cancelled });
				// A guide or host on most sessions (8.2).
				if (!cancelled && rand() < 0.7) {
					await db.insert(s.staffAssignment).values({ userId: pick(guides), sessionId: sid, role: def.kind === 'ceremony' ? 'host' : 'guide', startsAt, endsAt, assignedBy: manager, createdAt: daysFrom(offset - 3) });
				}
			}
		}
	}

	// ── Bookings ──────────────────────────────────────────────────────────────────────────────
	const customers = await db.select({ id: s.customer.id, name: s.customer.name, phone: s.customer.phone, email: s.customer.email }).from(s.customer);
	let number = 1;
	const nextNumber = () => `BK-26-${String(number++).padStart(4, '0')}`;

	async function history(target: { bookingId?: number; submissionId?: number }, status: Status, created: Date) {
		const path = PATHS[status];
		for (let i = 0; i < path.length; i++) {
			await db.insert(s.workflowHistory).values({
				...target,
				fromStatus: i === 0 ? null : path[i - 1],
				toStatus: path[i],
				note: i === 0 ? 'Received' : path[i] === 'cancelled' ? 'Visitor cancelled' : path[i] === 'declined' ? 'No capacity on the requested dates' : null,
				changedBy: i === 0 ? null : pick(staff),
				createdAt: new Date(created.getTime() + i * 3 * 3600000)
			});
		}
	}

	const bookingIds: { id: number; status: Status; kind: string; customerId: number | null; created: Date }[] = [];
	const open = sessions.filter((x) => !x.cancelled);
	for (let i = 0; i < 46; i++) {
		const session = pick(open);
		const def = bookables.find((b) => b.id === session.bookableId)!.def;
		const party = Math.min(between(1, def.kind === 'guided_tour' ? 8 : 4), session.capacity - session.booked);
		if (party <= 0) continue;
		const past = session.startsAt.getTime() < Date.now();
		const status: Status = past ? (rand() < 0.85 ? 'done' : 'cancelled') : rand() < 0.65 ? 'confirmed' : rand() < 0.5 ? 'new' : 'in_progress';
		const customer = rand() < 0.8 ? pick(customers) : null;
		const created = new Date(session.startsAt.getTime() - between(2, 12) * 86400000);
		const audienceId = rand() < 0.7 ? RES : FOR;
		const id = await insertId(s.booking, {
			number: nextNumber(),
			bookableId: session.bookableId,
			sessionId: session.id,
			customerId: customer?.id ?? null,
			status,
			contactName: customer?.name ?? pick(['Emma Rossi', 'Lukas Schmidt', 'Aisha Okafor', 'Daniel Smith']),
			contactPhone: customer?.phone ?? `+2519${between(10000000, 99999999)}`,
			contactEmail: customer?.email ?? null,
			partySize: party,
			audienceId,
			language: session.startsAt.getHours() === 13 ? 'en' : pick(def.langs),
			specialRequests: rand() < 0.2 ? pick(['Vegetarian snacks please', 'A birthday in the group', 'Photography allowed?']) : null,
			accessibilityNeeds: rand() < 0.08 ? 'Wheelchair user' : null,
			confirmedStartsAt: status === 'confirmed' || status === 'done' ? session.startsAt : null,
			confirmedAt: status === 'confirmed' || status === 'done' ? new Date(created.getTime() + 6 * 3600000) : null,
			cancelledAt: status === 'cancelled' ? new Date(created.getTime() + 2 * 86400000) : null,
			cancelReason: status === 'cancelled' ? 'Visitor cancelled' : null,
			assignedTo: rand() < 0.6 ? desk : null,
			createdBy: rand() < 0.3 ? desk : null,
			createdAt: created
		});
		if (status !== 'cancelled') session.booked += party;
		await history({ bookingId: id }, status, created);
		bookingIds.push({ id, status, kind: def.kind, customerId: customer?.id ?? null, created });
	}
	for (const x of sessions) {
		if (x.booked) await db.update(s.bookingSession).set({ booked: x.booked }).where(eq(s.bookingSession.id, x.id));
	}

	// Enquiries: private hire and school visits, quoted and confirmed by staff.
	const ENQUIRIES = [
		{ slug: 'private-event', org: 'Ethio Telecom', type: 'Product launch', party: 120 },
		{ slug: 'private-event', org: null, type: 'Wedding reception', party: 180 },
		{ slug: 'private-event', org: 'Addis Chamber', type: 'Networking dinner', party: 60 },
		{ slug: 'private-event', org: 'Hilton Addis', type: 'Staff outing', party: 40 },
		{ slug: 'school-visit', org: 'Lycée Guébré-Mariam', type: null, party: 40 },
		{ slug: 'school-visit', org: 'Bole Community School', type: null, party: 30 },
		{ slug: 'school-visit', org: 'Sandford International', type: null, party: 36 },
		{ slug: 'school-visit', org: 'Nazareth School', type: null, party: 38 },
		{ slug: 'private-event', org: 'UNECA', type: 'Coffee tasting for delegates', party: 25 },
		{ slug: 'school-visit', org: 'Menelik II Secondary', type: null, party: 40 },
		{ slug: 'private-event', org: null, type: 'Birthday party', party: 35 },
		{ slug: 'school-visit', org: 'ICS Addis', type: null, party: 24 }
	];
	const enquiryStatuses: Status[] = ['new', 'in_progress', 'confirmed', 'confirmed', 'done', 'declined', 'in_progress', 'confirmed', 'new', 'done', 'cancelled', 'confirmed'];
	for (const [i, e] of ENQUIRIES.entries()) {
		const b = bookables.find((x) => x.def.slug === e.slug)!;
		const status = enquiryStatuses[i];
		const customer = pick(customers);
		const day = between(-25, 40);
		const created = daysFrom(Math.min(day, 0) - between(5, 20));
		const confirmed = status === 'confirmed' || status === 'done' ? at(daysFrom(day), e.slug === 'school-visit' ? '10:00' : '18:00') : null;
		const quote = e.slug === 'private-event' ? e.party * between(350, 600) : e.party * 50;
		const id = await insertId(s.booking, {
			number: nextNumber(),
			bookableId: b.id,
			customerId: customer.id,
			status,
			contactName: customer.name ?? 'Contact',
			contactPhone: customer.phone ?? '+251911000000',
			contactEmail: customer.email,
			organisationName: e.org,
			tin: e.org ? `00${between(10000000, 99999999)}` : null,
			partySize: e.party,
			audienceId: RES,
			language: 'am',
			ageRange: e.slug === 'school-visit' ? pick(['8–10', '11–14', '15–18']) : null,
			eventType: e.type,
			preferredDates: [isoFrom(day), isoFrom(day + 1), isoFrom(day + 7)],
			confirmedStartsAt: confirmed,
			confirmedAt: confirmed ? new Date(created.getTime() + 2 * 86400000) : null,
			specialRequests: e.slug === 'private-event' ? 'Catering for the guests; a small stage.' : 'Two teachers accompany the class.',
			heldPlaces: status === 'confirmed' && e.slug === 'school-visit' ? e.party : 0,
			holdExpiresAt: status === 'confirmed' && e.slug === 'school-visit' ? daysFrom(7) : null,
			quotedAmount: status === 'new' ? 0 : quote,
			depositAmount: status === 'confirmed' || status === 'done' ? Math.round(quote * 0.3) : 0,
			cancelledAt: status === 'cancelled' ? daysFrom(-2) : null,
			cancelReason: status === 'cancelled' ? 'Date moved; they will ask again' : null,
			assignedTo: status === 'new' ? null : pick([manager, desk]),
			createdAt: created
		});
		await history({ bookingId: id }, status, created);
		if (confirmed) {
			await db.insert(s.staffAssignment).values({ userId: pick(guides), bookingId: id, role: e.slug === 'school-visit' ? 'guide' : 'host', startsAt: confirmed, endsAt: new Date(confirmed.getTime() + b.def.duration * 60000), assignedBy: manager, createdAt: created });
		}
		bookingIds.push({ id, status, kind: b.def.kind, customerId: customer.id, created });
	}

	// ── Inbox: every public form ──────────────────────────────────────────────────────────────
	const SUBJECTS: Record<string, string[]> = {
		booking: ['Tour on Saturday', 'Ceremony for two'],
		group_booking: ['Group of 15 from our office', 'Church youth group visit'],
		private_event: ['Venue for a launch', 'Wedding enquiry'],
		event_registration: ['Registration: harvest talk', 'Registration: cupping night'],
		feedback: ['Loved the ceremony', 'Signage at the gate', 'Café was closed early'],
		enquiry: ['Do you ship to Hawassa?', 'Opening hours on holidays', 'Parking?'],
		green_coffee_quote: ['20 bags Limu Gr 1 FOB Djibouti', 'Sample request: Gera natural'],
		wholesale_application: ['Café in Bole wants to stock you', 'Hotel supply enquiry']
	};
	const linkable = bookingIds.filter((b) => b.kind !== 'school_visit');
	let linked = 0;
	for (let i = 0; i < 52; i++) {
		const formType = FORM_TYPES[i % FORM_TYPES.length];
		const customer = rand() < 0.6 ? pick(customers) : null;
		const status: Status = pick(['new', 'new', 'in_progress', 'done', 'done', 'confirmed', 'declined', 'cancelled'] as Status[]);
		const submitted = daysFrom(-between(0, 70), between(7, 21), between(0, 59));
		const name = customer?.name ?? pick(['Emma Rossi', 'Tsion Hailu', 'Mark Johnson', 'Bereket Alemu']);
		const data: Record<string, unknown> =
			formType === 'green_coffee_quote'
				? { origin: pick(['Limu', 'Gera', 'Djimmah']), grade: pick([1, 2, 3]), bags: between(10, 320), incoterm: 'FOB Djibouti', country: pick(['Germany', 'Korea', 'USA']) }
				: formType === 'wholesale_application'
					? { businessName: `${name.split(' ')[1] ?? 'Blue'} Café`, monthlyKg: between(10, 80), subCity: pick(['Bole', 'Kirkos', 'Yeka']) }
					: formType === 'group_booking' || formType === 'booking'
						? { partySize: between(2, 25), preferredDate: isoFrom(between(1, 30)), audience: pick(['resident', 'foreign']) }
						: formType === 'event_registration'
							? { event: pick(['Harvest talk', 'Cupping night']), seats: between(1, 4) }
							: {};
		const id = await insertId(s.formSubmission, {
			formType,
			status,
			customerId: customer?.id ?? null,
			name,
			phone: customer?.phone ?? `+2519${between(10000000, 99999999)}`,
			email: customer?.email ?? `${name.split(' ')[0].toLowerCase()}@example.com`,
			subject: pick(SUBJECTS[formType]),
			message: formType === 'feedback' ? 'Thank you for a wonderful visit. The guide was excellent.' : 'Could you get back to me with the details? Thanks.',
			rating: formType === 'feedback' ? between(3, 5) : null,
			visitDate: formType === 'feedback' ? isoFrom(-between(1, 30)) : null,
			data,
			locale: pick(['am', 'en']),
			marketingConsent: rand() < 0.4,
			assignedTo: status === 'new' ? null : pick(staff),
			spamScore: rand() < 0.1 ? between(60, 95) : between(0, 15),
			ipAddress: `196.188.${between(1, 254)}.${between(1, 254)}`,
			userAgent: 'Mozilla/5.0',
			firstHandledAt: status === 'new' ? null : new Date(submitted.getTime() + between(1, 30) * 3600000),
			submittedAt: submitted,
			createdAt: submitted
		});
		await history({ submissionId: id }, status, submitted);
		// Booking-type submissions that became bookings.
		if ((formType === 'booking' || formType === 'group_booking' || formType === 'private_event') && linked < linkable.length && rand() < 0.7) {
			await db.update(s.booking).set({ submissionId: id }).where(eq(s.booking.id, linkable[linked++].id));
		}
	}
}
