/**
 * The gate scanner (6.4, 6.7): the day's ticket list a scanner downloads, and the scans it sends
 * back, each settled here against the database.
 *
 * A scanner works offline: it checks the QR's signature with the public key, admits from its own
 * copy of the list, and queues the scan. On sync each scan is replayed in the order it happened.
 * `clientScanId` (made on the device) makes a retried sync harmless; a ticket two offline scanners
 * both admitted lands as `duplicate_offline`, flagged for the desk (6.7: accepted risk).
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import {
	audience,
	customer,
	ticket,
	ticketScan,
	ticketType,
	visitSlot
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { readTicketQr } from '#lib/server/ticketQr.ts';
import { parseTicketQr, ticketCodeOf } from '#lib/ticketQr.ts';
import type { ScanResult } from '#lib/constants.ts';

/** Today's tickets, as a scanner holds them: enough to admit, and to show who it is. */
export async function scannerDay() {
	const today = localToday();
	const tickets = await db
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
		.where(and(eq(ticket.visitDate, today), inArray(ticket.status, ['valid', 'used'])))
		.orderBy(asc(ticket.code));
	return { today, tickets };
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
};

/** Settles one scan: the ticket's check-in moves on, and the scan is logged with its result. */
export async function recordScan(event: RequestEvent, s: Scan): Promise<ScanOutcome> {
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
		const code = ticketCodeOf(s.raw).slice(0, 64);
		const log = async (result: ScanResult, ticketId: number | null, headcount = 1) => {
			await tx.insert(ticketScan).values({
				clientScanId: s.clientScanId,
				scannedCode: code || s.raw.slice(0, 64),
				ticketId,
				scannedBy: event.locals.user?.id,
				result,
				headcount: Math.max(headcount, 1),
				wasOffline: s.wasOffline,
				scannedAt: when
			});
		};

		// A signed QR must carry our signature; a typed or plain code is looked up as it is.
		if (parseTicketQr(s.raw) && !readTicketQr(s.raw)) {
			await log('unknown', null);
			return { clientScanId: s.clientScanId, result: 'unknown', code, admitted: 0 };
		}
		const [t] = await tx.select().from(ticket).where(eq(ticket.code, code)).for('update');
		if (!t) {
			await log('unknown', null);
			return { clientScanId: s.clientScanId, result: 'unknown', code, admitted: 0 };
		}
		const out = (result: ScanResult, admitted = 0) => ({
			clientScanId: s.clientScanId,
			result,
			code,
			admitted,
			remaining: Math.max(t.admits - t.checkedIn - admitted, 0),
			firstCheckedInAt: t.firstCheckedInAt ?? (admitted ? when : null)
		});

		if (t.status === 'cancelled' || t.status === 'refunded') {
			await log('cancelled', t.id);
			return out('cancelled');
		}
		if (t.status === 'expired' || t.visitDate !== localToday()) {
			await log('wrong_date', t.id);
			return out('wrong_date');
		}

		const remaining = Math.max(t.admits - t.checkedIn, 0);
		if (remaining === 0) {
			// Everyone is in already. Back in the same day is allowed (6.4); admitted twice by two
			// scanners that were both offline is the risk 6.7 accepts, and is flagged.
			const result: ScanResult = s.wasOffline ? 'duplicate_offline' : 're_entry';
			await log(result, t.id);
			return out(result);
		}

		const asked = s.headcount ?? remaining;
		const people = Math.min(Math.max(Math.trunc(asked), 1), remaining);
		const checkedIn = t.checkedIn + people;
		await tx
			.update(ticket)
			.set({
				status: checkedIn >= t.admits ? 'used' : 'valid',
				checkedIn,
				firstCheckedInAt: t.firstCheckedInAt ?? when
			})
			.where(eq(ticket.id, t.id));
		const result: ScanResult = asked > remaining ? 'over_headcount' : 'admitted';
		await log(result, t.id, people);
		return out(result, people);
	});
}
