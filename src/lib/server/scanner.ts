/**
 * The gate scanner (6.4, 6.7): the day's ticket and member card lists a scanner downloads, and
 * the scans it sends back, each settled here against the database.
 *
 * A scanner works offline: it checks the QR's signature with the public key, admits from its own
 * copy of the lists, and queues the scan. On sync each scan is replayed in the order it happened.
 * `clientScanId` (made on the device) makes a retried sync harmless; a ticket two offline scanners
 * both admitted lands as `duplicate_offline`, flagged for the desk (6.7: accepted risk).
 *
 * A paired device sends its token with every sync: its scans are logged against it and its
 * location, it downloads only that location's tickets, and a ticket for another site is refused
 * there. A revoked token is refused outright.
 */
import { createHash } from 'node:crypto';
import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { localDayRange, localToday } from '@nahu/admin-kit/time';
import type { Writer } from '@nahu/admin-kit/server/db';
import { db } from '#lib/server/db/index.ts';
import {
	audience,
	customer,
	event as siteEvent,
	location,
	membership,
	membershipMember,
	membershipPlan,
	scannerDevice,
	ticket,
	ticketScan,
	ticketType,
	visitDay,
	visitSlot
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { readTicketQr } from '#lib/server/ticketQr.ts';
import { memberCardOf, parseTicketQr, ticketCodeOf } from '#lib/ticketQr.ts';
import { SCANNER_DEVICE_HEADER, type ScanResult } from '#lib/constants.ts';

export type Device = {
	id: number;
	name: string;
	locationId: number | null;
	location: string | null;
};

/** The token sent was revoked, switched off or never issued. */
export class DeviceRefused extends Error {
	constructor() {
		super('This device is not registered, or was revoked');
	}
}

/**
 * The device a sync comes from: null when the browser is not paired, `DeviceRefused` when its
 * token no longer works. Each call stamps the device's last sync.
 */
export async function deviceOf(event: RequestEvent): Promise<Device | null> {
	const token = event.request.headers.get(SCANNER_DEVICE_HEADER)?.trim();
	if (!token) return null;
	const tokenHash = createHash('sha256').update(token).digest('hex');
	const [d] = await db
		.select({
			id: scannerDevice.id,
			name: scannerDevice.name,
			locationId: scannerDevice.locationId,
			location: enOf(location.name)
		})
		.from(scannerDevice)
		.leftJoin(location, eq(scannerDevice.locationId, location.id))
		.where(
			and(
				eq(scannerDevice.tokenHash, tokenHash),
				eq(scannerDevice.isActive, true),
				isNull(scannerDevice.deletedAt)
			)
		);
	if (!d) throw new DeviceRefused();
	await db.update(scannerDevice).set({ lastSyncAt: new Date() }).where(eq(scannerDevice.id, d.id));
	return d;
}

/** Where a ticket is used: its visit day's site, else its event's; null for neither. */
const ticketPlace = sql<
	number | null
>`coalesce(${visitDay.locationId}, ${siteEvent.locationId})`.mapWith((v) =>
	v === null ? null : Number(v)
);

/** People in on a member card today: the heads its admitting scans let through. */
const cardInToday = (today: string) => {
	const { start, end } = localDayRange(today);
	return sql<number>`(select coalesce(sum(s.headcount), 0) from ticket_scan s where s.membership_member_id = ${membershipMember.id} and s.result in ('admitted', 'over_headcount') and s.scanned_at >= ${start} and s.scanned_at < ${end})`.mapWith(
		Number
	);
};

/** Why a card does not admit today, or null when it does. */
function cardRefusal(c: {
	memberActive: boolean;
	status: string;
	startsOn: string | null;
	freeEntry: boolean;
	today: string;
}) {
	if (!c.memberActive) return 'Card blocked';
	if (c.status === 'lapsed') return 'Membership lapsed';
	if (c.status !== 'active' && c.status !== 'grace') return 'Membership not active';
	if (c.startsOn && c.startsOn > c.today) return 'Membership not started yet';
	if (!c.freeEntry) return 'Plan has no free entry';
	return null;
}

/**
 * Today's lists, as a scanner holds them: tickets (only its own site's when the device has one)
 * and member cards, with enough to admit and to show who it is.
 */
export async function scannerDay(device: Device | null = null) {
	const today = localToday();
	const here = device?.locationId;
	const [tickets, cards] = await Promise.all([
		db
			.select({
				code: ticket.code,
				status: ticket.status,
				admits: ticket.admits,
				checkedIn: ticket.checkedIn,
				firstCheckedInAt: ticket.firstCheckedInAt,
				holder: ticket.holderName,
				customer: customer.name,
				type: enOf(ticketType.name),
				audience: enOf(audience.name),
				colour: audience.colour,
				requiresIdCheck: audience.requiresIdCheck,
				slotStart: visitSlot.startsAt
			})
			.from(ticket)
			.innerJoin(ticketType, eq(ticket.ticketTypeId, ticketType.id))
			.innerJoin(audience, eq(ticket.audienceId, audience.id))
			.leftJoin(customer, eq(ticket.customerId, customer.id))
			.leftJoin(visitSlot, eq(ticket.visitSlotId, visitSlot.id))
			.leftJoin(visitDay, eq(visitSlot.visitDayId, visitDay.id))
			.leftJoin(siteEvent, eq(ticket.eventId, siteEvent.id))
			.where(
				and(
					eq(ticket.visitDate, today),
					inArray(ticket.status, ['valid', 'used']),
					here
						? or(
								eq(visitDay.locationId, here),
								eq(siteEvent.locationId, here),
								and(isNull(visitDay.locationId), isNull(siteEvent.locationId))
							)
						: undefined
				)
			)
			.orderBy(asc(ticket.code)),
		db
			.select({
				card: membershipMember.cardCode,
				name: membershipMember.name,
				isChild: membershipMember.isChild,
				memberActive: membershipMember.isActive,
				number: membership.number,
				status: membership.status,
				startsOn: membership.startsOn,
				endsOn: membership.endsOn,
				plan: enOf(membershipPlan.name),
				freeEntry: membershipPlan.freeEntry,
				admits: sql<number>`coalesce(${membershipPlan.sharedCardAdmits}, 1)`.mapWith(Number),
				checkedIn: cardInToday(today)
			})
			.from(membershipMember)
			.innerJoin(membership, eq(membershipMember.membershipId, membership.id))
			.innerJoin(membershipPlan, eq(membership.planId, membershipPlan.id))
			.where(
				and(
					isNull(membershipMember.deletedAt),
					isNull(membership.deletedAt),
					inArray(membership.status, ['active', 'grace', 'lapsed'])
				)
			)
			.orderBy(asc(membershipMember.cardCode))
	]);
	return {
		today,
		device: device && { name: device.name, location: device.location },
		tickets,
		members: cards.map(({ memberActive, status, startsOn, freeEntry, ...c }) => ({
			...c,
			refused: cardRefusal({ memberActive, status, startsOn, freeEntry, today })
		}))
	};
}

export type Scan = {
	clientScanId: string;
	raw: string;
	/** People to admit on a group ticket; all still to come when left out. */
	headcount?: number;
	scannedAt: string;
	wasOffline: boolean;
};

export type ScanOutcome = {
	clientScanId: string;
	result: ScanResult;
	code: string;
	admitted: number;
	remaining?: number;
	firstCheckedInAt?: Date | null;
	/** Why a member card was refused. */
	reason?: string;
};

type Log = (
	result: ScanResult,
	ids: { ticketId?: number; memberId?: number },
	headcount?: number
) => Promise<void>;

/**
 * Settles one scan: the ticket's or card's check-in moves on, and the scan is logged with its
 * result, device and location.
 */
export async function recordScan(
	event: RequestEvent,
	s: Scan,
	device: Device | null = null
): Promise<ScanOutcome> {
	return db.transaction(async (tx) => {
		const [done] = await tx
			.select({
				result: ticketScan.result,
				code: ticketScan.scannedCode,
				headcount: ticketScan.headcount
			})
			.from(ticketScan)
			.where(eq(ticketScan.clientScanId, s.clientScanId))
			.limit(1);
		if (done) {
			return {
				clientScanId: s.clientScanId,
				result: done.result,
				code: done.code,
				admitted: done.result === 'admitted' ? done.headcount : 0
			};
		}

		const scannedAt = new Date(s.scannedAt);
		const when = Number.isNaN(scannedAt.getTime()) ? new Date() : scannedAt;
		const card = memberCardOf(s.raw);
		const code = (card ?? ticketCodeOf(s.raw)).slice(0, 64);
		const log: Log = async (result, ids, headcount = 1) => {
			await tx.insert(ticketScan).values({
				clientScanId: s.clientScanId,
				scannedCode: code || s.raw.slice(0, 64),
				ticketId: ids.ticketId ?? null,
				membershipMemberId: ids.memberId ?? null,
				deviceId: device?.id ?? null,
				locationId: device?.locationId ?? null,
				scannedBy: event.locals.user?.id,
				result,
				headcount: Math.max(headcount, 1),
				wasOffline: s.wasOffline,
				scannedAt: when
			});
		};
		const unknown = async () => {
			await log('unknown', {});
			return { clientScanId: s.clientScanId, result: 'unknown' as const, code, admitted: 0 };
		};

		if (card) return (await admitCard(tx, s, code, when, log)) ?? unknown();
		// A signed QR must carry our signature; a typed or plain code is looked up as it is.
		if (parseTicketQr(s.raw) && !readTicketQr(s.raw)) return unknown();
		const [locked] = await tx.select().from(ticket).where(eq(ticket.code, code)).for('update');
		// A card code typed at the gate reads like a ticket code.
		if (!locked) return (await admitCard(tx, s, code, when, log)) ?? unknown();
		const [{ place }] = await tx
			.select({ place: ticketPlace })
			.from(ticket)
			.leftJoin(visitSlot, eq(ticket.visitSlotId, visitSlot.id))
			.leftJoin(visitDay, eq(visitSlot.visitDayId, visitDay.id))
			.leftJoin(siteEvent, eq(ticket.eventId, siteEvent.id))
			.where(eq(ticket.id, locked.id));
		const t = { t: locked, place };
		const out = (result: ScanResult, admitted = 0) => ({
			clientScanId: s.clientScanId,
			result,
			code,
			admitted,
			remaining: Math.max(t.t.admits - t.t.checkedIn - admitted, 0),
			firstCheckedInAt: t.t.firstCheckedInAt ?? (admitted ? when : null)
		});
		const ids = { ticketId: t.t.id };

		if (t.t.status === 'cancelled' || t.t.status === 'refunded') {
			await log('cancelled', ids);
			return out('cancelled');
		}
		if (t.t.status === 'expired' || t.t.visitDate !== localToday()) {
			await log('wrong_date', ids);
			return out('wrong_date');
		}
		if (device?.locationId && t.place && t.place !== device.locationId) {
			await log('wrong_location', ids);
			return out('wrong_location');
		}

		const { result, people } = admitting(s, t.t.admits - t.t.checkedIn);
		if (people) {
			const checkedIn = t.t.checkedIn + people;
			await tx
				.update(ticket)
				.set({
					status: checkedIn >= t.t.admits ? 'used' : 'valid',
					checkedIn,
					firstCheckedInAt: t.t.firstCheckedInAt ?? when
				})
				.where(eq(ticket.id, t.t.id));
		}
		await log(result, ids, people);
		return out(result, people);
	});
}

/**
 * How many a scan lets in of those still to come. Everyone in already: back in the same day is
 * allowed (6.4); admitted twice by two scanners that were both offline is the risk 6.7 accepts,
 * and is flagged.
 */
function admitting(s: Scan, left: number): { result: ScanResult; people: number } {
	const remaining = Math.max(left, 0);
	if (remaining === 0)
		return { result: s.wasOffline ? 'duplicate_offline' : 're_entry', people: 0 };
	const asked = s.headcount ?? remaining;
	return {
		result: asked > remaining ? 'over_headcount' : 'admitted',
		people: Math.min(Math.max(Math.trunc(asked), 1), remaining)
	};
}

/**
 * A member card at the gate (7.3): it admits its holder, or the plan's shared-card headcount, once
 * a day; back in later is a re-entry. Null when no card has this code.
 */
async function admitCard(
	tx: Writer,
	s: Scan,
	code: string,
	when: Date,
	log: Log
): Promise<ScanOutcome | null> {
	const today = localToday();
	const [c] = await tx
		.select({
			id: membershipMember.id,
			memberActive: membershipMember.isActive,
			status: membership.status,
			startsOn: membership.startsOn,
			freeEntry: membershipPlan.freeEntry,
			admits: sql<number>`coalesce(${membershipPlan.sharedCardAdmits}, 1)`.mapWith(Number)
		})
		.from(membershipMember)
		.innerJoin(membership, eq(membershipMember.membershipId, membership.id))
		.innerJoin(membershipPlan, eq(membership.planId, membershipPlan.id))
		.where(
			and(
				eq(membershipMember.cardCode, code),
				isNull(membershipMember.deletedAt),
				isNull(membership.deletedAt)
			)
		);
	if (!c) return null;
	// One card scanned at two gates at once is counted one after the other.
	await tx
		.select({ id: membershipMember.id })
		.from(membershipMember)
		.where(eq(membershipMember.id, c.id))
		.for('update');
	const ids = { memberId: c.id };
	const reason = cardRefusal({ ...c, today });
	if (reason) {
		await log('card_refused', ids);
		return { clientScanId: s.clientScanId, result: 'card_refused', code, admitted: 0, reason };
	}
	const { start, end } = localDayRange(today);
	const [inToday] = await tx
		.select({
			people: sql<number>`coalesce(sum(${ticketScan.headcount}), 0)`.mapWith(Number),
			first: sql<Date | null>`min(${ticketScan.scannedAt})`
		})
		.from(ticketScan)
		.where(
			and(
				eq(ticketScan.membershipMemberId, c.id),
				inArray(ticketScan.result, ['admitted', 'over_headcount']),
				gte(ticketScan.scannedAt, start),
				lt(ticketScan.scannedAt, end)
			)
		);
	const already = inToday?.people ?? 0;
	const { result, people } = admitting(s, c.admits - already);
	await log(result, ids, people);
	return {
		clientScanId: s.clientScanId,
		result,
		code,
		admitted: people,
		remaining: Math.max(c.admits - already - people, 0),
		firstCheckedInAt: inToday?.first ? new Date(inToday.first) : people ? when : null
	};
}
