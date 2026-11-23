import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, gt, gte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { ticketQr } from '#lib/server/ticketQr.ts';
import {
	audience,
	customer,
	event,
	location,
	membership,
	order,
	orderLine,
	scannerDevice,
	ticket,
	ticketChange,
	ticketScan,
	ticketType,
	visitDay,
	visitSlot
} from '#lib/server/db/schema.ts';
import { formatDateTime } from '#lib/format.ts';
import { enOf } from '#lib/server/localized.ts';
import { userAlias } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { cancelTicket, checkInTicket, rescheduleTicket } from '#lib/server/visits.ts';
import { reasonSchema, rescheduleSchema } from '#lib/schemas/visits.ts';

async function loadTicket(raw: string) {
	const id = idParam(raw, 'Ticket');
	const [row] = await db
		.select({
			ticket,
			type: enOf(ticketType.name),
			audience: enOf(audience.name),
			audienceColour: audience.colour,
			slotStart: visitSlot.startsAt,
			slotEnd: visitSlot.endsAt,
			dayId: visitSlot.visitDayId,
			event: enOf(event.title),
			customer: customer.name,
			customerPhone: customer.phone,
			orderNumber: order.number,
			membershipNumber: membership.number,
			lineDescription: enOf(orderLine.description)
		})
		.from(ticket)
		.innerJoin(ticketType, eq(ticket.ticketTypeId, ticketType.id))
		.innerJoin(audience, eq(ticket.audienceId, audience.id))
		.leftJoin(visitSlot, eq(ticket.visitSlotId, visitSlot.id))
		.leftJoin(event, eq(ticket.eventId, event.id))
		.leftJoin(customer, eq(ticket.customerId, customer.id))
		.leftJoin(order, eq(ticket.orderId, order.id))
		.leftJoin(orderLine, eq(ticket.orderLineId, orderLine.id))
		.leftJoin(membership, eq(ticket.membershipId, membership.id))
		.where(eq(ticket.id, id));
	if (!row) error(404, 'Ticket not found');
	return row;
}

const changer = userAlias('changer');
const scannedBy = userAlias('scanned_by_user');
const fromSlot = alias(visitSlot, 'from_slot');
const toSlot = alias(visitSlot, 'to_slot');
const fromType = alias(ticketType, 'from_type');
const toType = alias(ticketType, 'to_type');
const fromAudience = alias(audience, 'from_audience');
const toAudience = alias(audience, 'to_audience');

export const load = async ({ params, locals }) => {
	const row = await loadTicket(params.id);
	const t = row.ticket;
	const [changes, scans, slots] = await Promise.all([
		db
			.select({
				id: ticketChange.id,
				kind: ticketChange.kind,
				fromSlot: fromSlot.startsAt,
				toSlot: toSlot.startsAt,
				fromTypeId: ticketChange.fromTicketTypeId,
				fromType: enOf(fromType.name),
				toTypeId: ticketChange.toTicketTypeId,
				toType: enOf(toType.name),
				fromAudience: enOf(fromAudience.name),
				toAudience: enOf(toAudience.name),
				amount: ticketChange.amount,
				orderId: ticketChange.orderId,
				reason: ticketChange.reason,
				byId: ticketChange.changedBy,
				by: changer.name,
				createdAt: ticketChange.createdAt
			})
			.from(ticketChange)
			.leftJoin(fromSlot, eq(ticketChange.fromSlotId, fromSlot.id))
			.leftJoin(toSlot, eq(ticketChange.toSlotId, toSlot.id))
			.leftJoin(fromType, eq(ticketChange.fromTicketTypeId, fromType.id))
			.leftJoin(toType, eq(ticketChange.toTicketTypeId, toType.id))
			.leftJoin(fromAudience, eq(ticketChange.fromAudienceId, fromAudience.id))
			.leftJoin(toAudience, eq(ticketChange.toAudienceId, toAudience.id))
			.leftJoin(changer, eq(ticketChange.changedBy, changer.id))
			.where(eq(ticketChange.ticketId, t.id))
			.orderBy(desc(ticketChange.createdAt)),
		db
			.select({
				id: ticketScan.id,
				result: ticketScan.result,
				headcount: ticketScan.headcount,
				wasOffline: ticketScan.wasOffline,
				device: scannerDevice.name,
				locationId: ticketScan.locationId,
				location: enOf(location.name),
				byId: ticketScan.scannedBy,
				by: scannedBy.name,
				scannedAt: ticketScan.scannedAt,
				syncedAt: ticketScan.syncedAt
			})
			.from(ticketScan)
			.leftJoin(scannerDevice, eq(ticketScan.deviceId, scannerDevice.id))
			.leftJoin(location, eq(ticketScan.locationId, location.id))
			.leftJoin(scannedBy, eq(ticketScan.scannedBy, scannedBy.id))
			.where(eq(ticketScan.ticketId, t.id))
			.orderBy(desc(ticketScan.scannedAt)),
		// Where it could move to: open slots not yet over, at the same location, with room for its
		// party. The label is built here, in Addis Ababa time: the connection runs in UTC.
		t.visitSlotId && t.status === 'valid'
			? db
					.select({
						value: visitSlot.id,
						startsAt: visitSlot.startsAt,
						free: sql<number>`${visitSlot.capacity} - ${visitSlot.sold} - ${visitSlot.held}`.mapWith(
							Number
						)
					})
					.from(visitSlot)
					.innerJoin(visitDay, eq(visitSlot.visitDayId, visitDay.id))
					.where(
						and(
							gte(visitDay.date, localToday()),
							gt(visitSlot.endsAt, new Date()),
							eq(
								visitDay.locationId,
								sql`(select d.location_id from visit_slot s join visit_day d on d.id = s.visit_day_id where s.id = ${t.visitSlotId})`
							),
							eq(visitSlot.isClosed, false),
							eq(visitDay.isClosed, false),
							sql`${visitSlot.capacity} - ${visitSlot.sold} - ${visitSlot.held} >= ${t.admits}`
						)
					)
					.orderBy(asc(visitSlot.startsAt))
					.limit(300)
					.then((rows) =>
						rows.map((r) => ({
							value: r.value,
							name: `${formatDateTime(r.startsAt)} — ${r.free} free`
						}))
					)
			: Promise.resolve([])
	]);
	return {
		...row,
		// Only a live ticket gets a QR to reprint; a cancelled one must not be scannable again.
		qr: t.status === 'valid' || t.status === 'used' ? await ticketQr(t) : null,
		changes,
		scans,
		slots: slots.filter((s) => s.value !== t.visitSlotId),
		today: localToday(),
		canManage: hasPermission(locals, 'visits.manage'),
		rescheduleForm: await superValidate(zod4(rescheduleSchema), { id: 'reschedule' }),
		cancelForm: await superValidate(zod4(reasonSchema), { id: 'cancel' })
	};
};

/** The refusal under its field, or on the form. */
function refused(form: Parameters<typeof message>[0], err: unknown) {
	if (err instanceof WriteRefused)
		return message(form, { type: 'error', text: err.message }, { status: 400 });
	throw err;
}

export const actions = {
	reschedule: async (event) => {
		// Moving a visitor to another slot changes capacity: staff who manage visits, not the scanner.
		requirePermission(event.locals, 'visits.manage');
		const form = await superValidate(event.request, zod4(rescheduleSchema), { id: 'reschedule' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		try {
			await rescheduleTicket(event, idParam(event.params.id), form.data.toSlotId, form.data.reason);
		} catch (err) {
			return refused(form, err);
		}
		return message(form, { type: 'success', text: 'Ticket moved' });
	},
	cancel: async (event) => {
		requirePermission(event.locals, 'visits.manage');
		const form = await superValidate(event.request, zod4(reasonSchema), { id: 'cancel' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		try {
			await cancelTicket(event, idParam(event.params.id), form.data.reason);
		} catch (err) {
			return refused(form, err);
		}
		return message(form, { type: 'success', text: 'Ticket cancelled; its places are free again' });
	},
	checkIn: async (event) => {
		requirePermission(event.locals, 'visits.view');
		try {
			await checkInTicket(event, idParam(event.params.id));
		} catch (err) {
			if (err instanceof WriteRefused) return { message: { type: 'error', text: err.message } };
			throw err;
		}
		return { message: { type: 'success', text: 'Checked in' } };
	}
};
