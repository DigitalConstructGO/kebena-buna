/** Writing an event: its words (the description sanitised), its times, its picture. */
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { storeFileFields } from '@nahu/admin-kit/server/files';
import { db } from '#lib/server/db/index.ts';
import { shiftAssignments } from '#lib/server/bookings.ts';
import { event } from '#lib/server/db/schema.ts';
import { flatLocalized, packLocalized, toRichLocalized } from '#lib/server/localized.ts';
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
			if (data.capacity < before.registered)
				throw new WriteRefused('capacity', `${before.registered} people are registered already`);
			await tx
				.update(event)
				.set({ ...(values as Partial<typeof event.$inferInsert>), updatedBy: req.locals.user?.id })
				.where(eq(event.id, id));
			// Its staff move with it, so the double-booking check reads the real times.
			await shiftAssignments(tx, { eventId: id }, before, { startsAt, endsAt });
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
