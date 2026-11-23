/**
 * Visiting the museum: entry ticket types and their prices, the slot pattern, visit days and
 * slots from a month ago to a month ahead, events with their own ticket types, ~500 tickets with
 * their scans and changes, and the scanner devices.
 *
 * Every counter (`visit_slot.sold`, `visit_day.sold`, `event.registered`) is the sum of the live
 * tickets written here, so the screens add up. Tickets carry no order yet: the orders seed links
 * them.
 */
import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
	db,
	schema as s,
	insertId,
	L,
	between,
	pick,
	rand,
	daysFrom,
	isoFrom,
	shortCode
} from './db.ts';

const byCode = async (code: string) =>
	(await db.select({ id: s.location.id }).from(s.location).where(eq(s.location.code, code)))[0].id;
const userId = async (email: string) =>
	(await db.select({ id: s.user.id }).from(s.user).where(eq(s.user.email, email)))[0].id;
const audienceId = async (code: string) =>
	(await db.select({ id: s.audience.id }).from(s.audience).where(eq(s.audience.code, code)))[0].id;

const NAMES = [
	'Abel Tesfaye',
	'Hanna Bekele',
	'Emma Schmidt',
	'Luca Rossi',
	'Saron Alemu',
	'Yared Girma',
	'Ruth Haile',
	'Daniel Okafor',
	'Mahlet Wolde',
	'Sophie Martin',
	'Kenji Sato',
	'Lidya Assefa',
	'Natnael Kebede',
	'Aisha Mohammed',
	'Tom Baker'
];

export async function seed() {
	const siteA = await byCode('SITE-A');
	const siteB = await byCode('SITE-B');
	const res = await audienceId('RES');
	const foreign = await audienceId('FOR');
	const [vat] = await db
		.select({ id: s.taxRate.id })
		.from(s.taxRate)
		.where(eq(s.taxRate.code, 'VAT15'));
	const manager = await userId('manager@kebena.coffee');
	const desk = await userId('desk@kebena.coffee');
	const scanner = await userId('scanner@kebena.coffee');
	const guides = [await userId('guide1@kebena.coffee'), await userId('guide2@kebena.coffee')];
	const customers = await db.select({ id: s.customer.id, name: s.customer.name }).from(s.customer);

	// ── Entry ticket types and the price grid ─────────────────────────────────────────────────
	type TT = { id: number; code: string; admits: number; counts: boolean; group: boolean };
	const entryTypes: TT[] = [];
	const types: {
		code: string;
		name: [string, string];
		prices: [number, number | null];
		proof?: string;
		min?: number;
		staffOnly?: boolean;
		counts?: boolean;
		group?: boolean;
	}[] = [
		{ code: 'ADULT', name: ['Adult', 'አዋቂ'], prices: [200, 1000] },
		{ code: 'STUDENT', name: ['Student', 'ተማሪ'], prices: [100, 500], proof: 'Student ID' },
		{ code: 'CHILD', name: ['Child 6–12', 'ልጅ 6–12'], prices: [75, 400] },
		{ code: 'INFANT', name: ['Child under 6', 'ከ6 ዓመት በታች'], prices: [0, 0] },
		{ code: 'GROUP', name: ['Group (10+)', 'ቡድን (10+)'], prices: [150, 800], min: 10, group: true },
		{
			code: 'SCHOOL',
			name: ['School group', 'የትምህርት ቤት ቡድን'],
			prices: [50, null],
			proof: 'School letter',
			staffOnly: true,
			group: true
		}
	];
	for (const [i, t] of types.entries()) {
		const id = await insertId(s.ticketType, {
			code: t.code,
			name: L(...t.name),
			description: L(`${t.name[0]} entry to both sites of the museum.`),
			requiresProof: t.proof ? L(t.proof) : null,
			minQuantity: t.min ?? 1,
			admitsPerTicket: 1,
			countsTowardCapacity: t.counts ?? true,
			isStaffOnly: Boolean(t.staffOnly),
			taxRateId: vat.id,
			sortOrder: i + 1,
			createdBy: manager
		});
		await db
			.insert(s.ticketPrice)
			.values([
				{ ticketTypeId: id, audienceId: res, price: t.prices[0] },
				...(t.prices[1] === null
					? []
					: [{ ticketTypeId: id, audienceId: foreign, price: t.prices[1] }])
			]);
		entryTypes.push({
			id,
			code: t.code,
			admits: 1,
			counts: t.counts ?? true,
			group: Boolean(t.group)
		});
	}

	// ── Slot pattern: Tue–Sun 09:00–17:00, hourly, 50 a slot ─────────────────────────────────
	const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
	const pad = (n: number) => String(n).padStart(2, '0');
	await db.insert(s.slotTemplate).values(
		[2, 3, 4, 5, 6, 7].flatMap((weekday) =>
			HOURS.map((h) => ({
				locationId: siteA,
				weekday,
				startsAt: `${pad(h)}:00:00`,
				endsAt: `${pad(h + 1)}:00:00`,
				capacity: 50
			}))
		)
	);

	// ── Days and slots, a month back to a month ahead ─────────────────────────────────────────
	type Slot = {
		id: number;
		dayId: number;
		offset: number;
		hour: number;
		sold: number;
		capacity: number;
	};
	const slots: Slot[] = [];
	const days = new Map<number, { id: number; sold: number; offset: number }>();
	for (let offset = -30; offset <= 30; offset++) {
		const day = daysFrom(offset);
		const weekday = day.getDay() === 0 ? 7 : day.getDay();
		if (weekday === 1) continue;
		const dayId = await insertId(s.visitDay, {
			locationId: siteA,
			date: isoFrom(offset),
			capacity: 400,
			createdBy: manager
		});
		days.set(dayId, { id: dayId, sold: 0, offset });
		for (const h of HOURS) {
			const id = await insertId(s.visitSlot, {
				visitDayId: dayId,
				startsAt: daysFrom(offset, h),
				endsAt: daysFrom(offset, h + 1),
				capacity: 50
			});
			slots.push({ id, dayId, offset, hour: h, sold: 0, capacity: 50 });
		}
	}
	// A rained-off afternoon a fortnight back, and a closed day ahead for maintenance.
	const closedSlot = slots.find((x) => x.offset === -14 && x.hour === 16);
	if (closedSlot)
		await db.update(s.visitSlot).set({ isClosed: true }).where(eq(s.visitSlot.id, closedSlot.id));
	const closedDay = [...days.values()].find((d) => d.offset === 25);
	if (closedDay) {
		await db
			.update(s.visitDay)
			.set({ isClosed: true, closedReason: L('Closed for hall maintenance', 'ለጥገና ዝግ') })
			.where(eq(s.visitDay.id, closedDay.id));
		await db
			.update(s.visitSlot)
			.set({ isClosed: true })
			.where(eq(s.visitSlot.visitDayId, closedDay.id));
	}

	// ── Scanner devices ───────────────────────────────────────────────────────────────────────
	const token = () => createHash('sha256').update(randomBytes(24)).digest('hex');
	const devices = [
		await insertId(s.scannerDevice, {
			name: 'Gate tablet 1',
			locationId: siteA,
			tokenHash: token(),
			lastSyncAt: daysFrom(0, 9, 5),
			createdBy: manager
		}),
		await insertId(s.scannerDevice, {
			name: 'Gate tablet 2',
			locationId: siteA,
			tokenHash: token(),
			lastSyncAt: daysFrom(-1, 17, 2),
			createdBy: manager
		}),
		await insertId(s.scannerDevice, {
			name: 'Site B phone',
			locationId: siteB,
			tokenHash: token(),
			lastSyncAt: daysFrom(-9, 12, 40),
			isActive: false,
			createdBy: manager
		})
	];

	// ── Entry tickets ─────────────────────────────────────────────────────────────────────────
	const codes = new Set<string>();
	const uniqueCode = () => {
		let c = shortCode(8);
		while (codes.has(c)) c = shortCode(8);
		codes.add(c);
		return c;
	};
	const weighted = (): TT => {
		const r = rand();
		const code =
			r < 0.5
				? 'ADULT'
				: r < 0.65
					? 'STUDENT'
					: r < 0.8
						? 'CHILD'
						: r < 0.87
							? 'INFANT'
							: r < 0.96
								? 'GROUP'
								: 'SCHOOL';
		return entryTypes.find((t) => t.code === code)!;
	};
	const scans: (typeof s.ticketScan.$inferInsert)[] = [];
	const changes: (typeof s.ticketChange.$inferInsert)[] = [];
	let made = 0;
	const openSlots = slots.filter((x) => x.id !== closedSlot?.id && x.dayId !== closedDay?.id);

	for (const slot of openSlots) {
		// Busier at weekends and in the late morning; ~500 tickets over the two months.
		const date = daysFrom(slot.offset);
		const weekend = date.getDay() === 0 || date.getDay() === 6;
		const n = between(0, weekend ? 3 : 1) + (slot.hour >= 10 && slot.hour <= 13 ? 1 : 0);
		for (let k = 0; k < n; k++) {
			const type = weighted();
			const admits = type.group ? between(10, 18) : 1;
			if (slot.sold + admits > slot.capacity) continue;
			const audience = type.code === 'SCHOOL' ? res : rand() < 0.7 ? res : foreign;
			const cust = rand() < 0.6 ? pick(customers) : null;
			const past = slot.offset < 0;
			const today = slot.offset === 0;
			let status: 'valid' | 'used' | 'cancelled' | 'refunded' | 'expired';
			const r = rand();
			if (past)
				status = r < 0.86 ? 'used' : r < 0.92 ? 'expired' : r < 0.96 ? 'cancelled' : 'refunded';
			else if (today) status = slot.hour < 12 ? 'used' : 'valid';
			else status = r < 0.95 ? 'valid' : 'cancelled';
			const issuedAt = daysFrom(slot.offset - between(0, 10), between(7, 21), between(0, 59));
			const checkedAt = daysFrom(slot.offset, slot.hour, between(0, 40));
			const id = await insertId(s.ticket, {
				code: uniqueCode(),
				customerId: cust?.id ?? null,
				ticketTypeId: type.id,
				audienceId: audience,
				visitSlotId: slot.id,
				visitDate: isoFrom(slot.offset),
				holderName: cust?.name ?? (rand() < 0.5 ? pick(NAMES) : null),
				admits,
				checkedIn: status === 'used' ? admits : 0,
				status,
				firstCheckedInAt: status === 'used' ? checkedAt : null,
				locale: audience === foreign ? 'en' : pick(['am', 'en']),
				issuedAt,
				cancelledAt:
					status === 'cancelled' || status === 'refunded' ? daysFrom(slot.offset - 1, 15) : null
			});
			made++;
			if (status === 'valid' || status === 'used' || status === 'expired') {
				if (type.counts) slot.sold += admits;
			}
			if (status === 'cancelled' || status === 'refunded') {
				changes.push({
					ticketId: id,
					kind: status === 'refunded' ? 'refund' : 'cancel',
					fromSlotId: slot.id,
					amount: status === 'refunded' ? -(audience === foreign ? 800 : 200) : 0,
					reason: pick(['Visitor fell ill', 'Travel plans changed', 'Booked the wrong day']),
					changedBy: desk,
					createdAt: daysFrom(slot.offset - 1, 15)
				});
			}
			if (status === 'used') {
				const device = pick(devices.slice(0, 2));
				scans.push({
					clientScanId: crypto.randomUUID(),
					scannedCode: `KCT1.${id}`,
					ticketId: id,
					deviceId: device,
					locationId: siteA,
					scannedBy: scanner,
					result: 'admitted',
					headcount: admits,
					wasOffline: rand() < 0.1,
					scannedAt: checkedAt,
					syncedAt: checkedAt
				});
				if (rand() < 0.08)
					scans.push({
						clientScanId: crypto.randomUUID(),
						scannedCode: `KCT1.${id}`,
						ticketId: id,
						deviceId: device,
						locationId: siteA,
						scannedBy: scanner,
						result: 're_entry',
						headcount: 1,
						scannedAt: daysFrom(slot.offset, slot.hour + 1, 20),
						syncedAt: daysFrom(slot.offset, slot.hour + 1, 21)
					});
				if (rand() < 0.03)
					scans.push({
						clientScanId: crypto.randomUUID(),
						scannedCode: `KCT1.${id}`,
						ticketId: id,
						deviceId: devices[1],
						locationId: siteA,
						scannedBy: scanner,
						result: 'duplicate_offline',
						headcount: admits,
						wasOffline: true,
						scannedAt: daysFrom(slot.offset, slot.hour, 41),
						syncedAt: daysFrom(slot.offset, slot.hour + 2)
					});
				if (rand() < 0.03)
					scans.push({
						clientScanId: crypto.randomUUID(),
						scannedCode: `KCT1.${id}`,
						ticketId: id,
						deviceId: device,
						locationId: siteA,
						scannedBy: scanner,
						result: 'wrong_date',
						headcount: admits,
						scannedAt: daysFrom(slot.offset - 1, 11),
						syncedAt: daysFrom(slot.offset - 1, 11)
					});
			}
		}
	}

	// A few reschedules: moved from an earlier slot of the day to this one.
	const movable = await db
		.select({ id: s.ticket.id, slotId: s.ticket.visitSlotId })
		.from(s.ticket)
		.where(eq(s.ticket.status, 'valid'))
		.limit(400);
	for (const t of movable.filter(() => rand() < 0.03)) {
		const to = slots.find((x) => x.id === t.slotId)!;
		const from =
			slots.find((x) => x.dayId === to.dayId && x.hour === to.hour - 1) ??
			slots.find((x) => x.offset === to.offset - 1 && x.hour === to.hour);
		if (!from) continue;
		changes.push({
			ticketId: t.id,
			kind: 'reschedule',
			fromSlotId: from.id,
			toSlotId: to.id,
			amount: 0,
			reason: 'Visitor asked for a later time',
			changedBy: desk,
			createdAt: daysFrom(to.offset - 2, 10)
		});
	}
	// An upgrade at the desk: student → adult, the difference paid.
	const [student] = await db
		.select({ id: s.ticket.id, slotId: s.ticket.visitSlotId })
		.from(s.ticket)
		.where(eq(s.ticket.ticketTypeId, entryTypes[1].id))
		.limit(1);
	if (student)
		changes.push({
			ticketId: student.id,
			kind: 'upgrade',
			fromTicketTypeId: entryTypes[1].id,
			toTicketTypeId: entryTypes[0].id,
			fromAudienceId: res,
			toAudienceId: res,
			amount: 100,
			reason: 'No student ID at the door',
			changedBy: desk
		});
	if (student)
		await db
			.update(s.ticket)
			.set({ ticketTypeId: entryTypes[0].id })
			.where(eq(s.ticket.id, student.id));

	// Unknown codes held up to the scanner.
	for (let i = 0; i < 6; i++) {
		const at = daysFrom(-between(1, 25), between(9, 16), between(0, 59));
		scans.push({
			clientScanId: crypto.randomUUID(),
			scannedCode: `XX${shortCode(10)}`,
			deviceId: pick(devices.slice(0, 2)),
			locationId: siteA,
			scannedBy: scanner,
			result: 'unknown',
			headcount: 1,
			scannedAt: at,
			syncedAt: at
		});
	}

	// Counters match the tickets.
	for (const slot of slots) {
		if (slot.sold)
			await db.update(s.visitSlot).set({ sold: slot.sold }).where(eq(s.visitSlot.id, slot.id));
		days.get(slot.dayId)!.sold += slot.sold;
	}
	for (const day of days.values()) {
		if (day.sold)
			await db.update(s.visitDay).set({ sold: day.sold }).where(eq(s.visitDay.id, day.id));
	}
	// A school group's places held on a slot next week while their invoice is unpaid.
	const holdSlot = slots.find((x) => x.offset === 6 && x.hour === 10 && x.sold <= 25);
	if (holdSlot) {
		await db.update(s.visitSlot).set({ held: 25 }).where(eq(s.visitSlot.id, holdSlot.id));
		const day = days.get(holdSlot.dayId)!;
		await db.update(s.visitDay).set({ held: 25 }).where(eq(s.visitDay.id, day.id));
	}

	// ── Events with their own ticket types ────────────────────────────────────────────────────
	const events: {
		slug: string;
		title: [string, string];
		summary: string;
		offset: number;
		hour: number;
		hours: number;
		loc: number;
		cap: number;
		visibility: 'public' | 'members_only' | 'private';
		free: boolean;
		entry: boolean;
		publish: 'draft' | 'published';
		prices: [string, string, number, number][];
	}[] = [
		{
			slug: 'birthplace-of-coffee-talk',
			title: ['The birthplace of coffee: a talk', 'የቡና መገኛ፦ ንግግር'],
			summary: 'How coffee left the forests of Kaffa and Jimma for the world.',
			offset: -12,
			hour: 15,
			hours: 2,
			loc: siteA,
			cap: 80,
			visibility: 'public',
			free: true,
			entry: false,
			publish: 'published',
			prices: [['REG', 'Registration', 0, 0]]
		},
		{
			slug: 'ceremony-masterclass',
			title: ['Coffee ceremony masterclass', 'የቡና ሥነ ሥርዓት ትምህርት'],
			summary: 'Roast, grind and brew in a jebena with our ceremony hosts.',
			offset: -20,
			hour: 14,
			hours: 3,
			loc: siteB,
			cap: 30,
			visibility: 'public',
			free: false,
			entry: true,
			publish: 'published',
			prices: [['STD', 'Standard', 300, 900]]
		},
		{
			slug: 'cupping-evening-gera',
			title: ['Cupping evening: the Gera lots', 'የገራ ቡና ቅምሻ'],
			summary: 'Cup this harvest’s Gera washed and anaerobic lots with our roaster.',
			offset: 9,
			hour: 17,
			hours: 2,
			loc: siteB,
			cap: 24,
			visibility: 'public',
			free: false,
			entry: false,
			publish: 'published',
			prices: [
				['STD', 'Standard', 350, 900],
				['STU', 'Student', 200, 500]
			]
		},
		{
			slug: 'members-limu-preview',
			title: ['Members’ preview: the new Limu harvest', 'ለአባላት፦ አዲሱ የሊሙ ምርት'],
			summary: 'First taste of the new washed Limu, for members only.',
			offset: 16,
			hour: 16,
			hours: 2,
			loc: siteA,
			cap: 40,
			visibility: 'members_only',
			free: true,
			entry: false,
			publish: 'published',
			prices: [['MEM', 'Member registration', 0, 0]]
		},
		{
			slug: 'timket-exhibition',
			title: ['Timket: water, faith and coffee', 'ጥምቀት፦ ውሃ፣ እምነት እና ቡና'],
			summary: 'A photo exhibition around Timket, with ceremony coffee in the square.',
			offset: 28,
			hour: 10,
			hours: 7,
			loc: siteB,
			cap: 200,
			visibility: 'public',
			free: false,
			entry: true,
			publish: 'published',
			prices: [['DAY', 'Day pass', 250, 900]]
		},
		{
			slug: 'roasting-at-home',
			title: ['Roasting at home workshop', 'ቤት ውስጥ ቡና ማቁላት'],
			summary: 'Pan-roast green coffee the way it is done in Jimma kitchens.',
			offset: 40,
			hour: 10,
			hours: 3,
			loc: siteB,
			cap: 16,
			visibility: 'public',
			free: false,
			entry: false,
			publish: 'draft',
			prices: [['STD', 'Standard', 600, 1500]]
		}
	];
	for (const e of events) {
		const startsAt = daysFrom(e.offset, e.hour);
		const eventId = await insertId(s.event, {
			slug: e.slug,
			title: L(...e.title),
			summary: L(e.summary),
			description: L(
				`<p>${e.summary}</p><p>Places are limited to ${e.cap}. Registration closes the day before.</p>`
			),
			locationId: e.loc,
			startsAt,
			endsAt: daysFrom(e.offset, e.hour + e.hours),
			capacity: e.cap,
			visibility: e.visibility,
			isFree: e.free,
			includesEntry: e.entry,
			registrationClosesAt: daysFrom(e.offset - 1, 18),
			publishStatus: e.publish,
			createdBy: manager,
			createdAt: daysFrom(Math.min(e.offset, 0) - 30)
		});
		const typeIds: number[] = [];
		for (const [i, [code, name, resPrice, forPrice]] of e.prices.entries()) {
			const id = await insertId(s.ticketType, {
				code,
				name: L(name),
				eventId,
				taxRateId: vat.id,
				isMemberOnly: e.visibility === 'members_only',
				sortOrder: i,
				createdBy: manager
			});
			await db.insert(s.ticketPrice).values([
				{ ticketTypeId: id, audienceId: res, price: resPrice },
				{ ticketTypeId: id, audienceId: foreign, price: forPrice }
			]);
			typeIds.push(id);
		}
		if (e.publish === 'draft') continue;
		const sold = Math.min(
			e.cap,
			Math.round(e.cap * (e.offset < 0 ? 0.6 + rand() * 0.35 : 0.2 + rand() * 0.5))
		);
		let registered = 0;
		for (let k = 0; k < sold; k++) {
			const cust = rand() < 0.8 ? pick(customers) : null;
			const audience = rand() < 0.75 ? res : foreign;
			const past = e.offset < 0;
			const status = past
				? rand() < 0.88
					? 'used'
					: 'expired'
				: rand() < 0.95
					? 'valid'
					: 'cancelled';
			const id = await insertId(s.ticket, {
				code: uniqueCode(),
				customerId: cust?.id ?? null,
				ticketTypeId: pick(typeIds),
				audienceId: audience,
				eventId,
				visitDate: isoFrom(e.offset),
				holderName: cust?.name ?? pick(NAMES),
				admits: 1,
				checkedIn: status === 'used' ? 1 : 0,
				status,
				firstCheckedInAt: status === 'used' ? daysFrom(e.offset, e.hour, between(0, 20)) : null,
				locale: audience === foreign ? 'en' : 'am',
				issuedAt: daysFrom(e.offset - between(1, 20), between(8, 20)),
				cancelledAt: status === 'cancelled' ? daysFrom(-1, 12) : null
			});
			if (status !== 'cancelled') registered++;
			else
				changes.push({
					ticketId: id,
					kind: 'cancel',
					amount: 0,
					reason: 'Cannot attend',
					changedBy: desk
				});
			if (status === 'used') {
				const at = daysFrom(e.offset, e.hour, between(0, 20));
				scans.push({
					clientScanId: crypto.randomUUID(),
					scannedCode: `KCT1.${id}`,
					ticketId: id,
					deviceId: e.loc === siteB ? devices[2] : devices[0],
					locationId: e.loc,
					scannedBy: scanner,
					result: 'admitted',
					headcount: 1,
					scannedAt: at,
					syncedAt: at
				});
			}
		}
		await db.update(s.event).set({ registered }).where(eq(s.event.id, eventId));
		// Who runs it.
		await db.insert(s.staffAssignment).values(
			guides.map((g, i) => ({
				userId: g,
				eventId,
				role: i === 0 ? 'host' : 'guide',
				startsAt,
				endsAt: daysFrom(e.offset, e.hour + e.hours),
				assignedBy: manager
			}))
		);
		made += sold;
	}

	for (let i = 0; i < scans.length; i += 200)
		await db.insert(s.ticketScan).values(scans.slice(i, i + 200));
	if (changes.length) await db.insert(s.ticketChange).values(changes);
	console.log(
		`  ${made} tickets, ${scans.length} scans, ${changes.length} changes, ${slots.length} slots`
	);
}
