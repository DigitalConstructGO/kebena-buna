import { error } from '@sveltejs/kit';
import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod/v4';
import { redirect } from 'sveltekit-flash-message/server';
import { childActions, childCrud } from '@nahu/admin-kit/server/childCrud';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { postedForm, storeFileFields, UploadRefused } from '@nahu/admin-kit/server/files';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { db } from '#lib/server/db/index.ts';
import {
	bookable,
	bookablePrice,
	bookableSchedule,
	booking,
	bookingSession,
	location,
	taxRate
} from '#lib/server/db/schema.ts';
import { enOf, packLocalized, unpackLocalized } from '#lib/server/localized.ts';
import { stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { audienceOptions, locationOptions, taxRateOptions } from '#lib/server/options.ts';
import { generateSessions } from '#lib/server/bookings.ts';
import {
	bookableEditSchema,
	bookablePriceEditSchema,
	bookablePriceSchema,
	bookableScheduleSchema,
	generateSessionsSchema,
	imageSchema
} from '#lib/schemas/bookings.ts';

/** The price per audience (8.1): ceremony 300 resident / 600 foreign. Prices are audited (5.1). */
const prices = childCrud({
	table: bookablePrice,
	ownerColumn: 'bookableId',
	label: 'Price',
	addSchema: bookablePriceSchema,
	editSchema: bookablePriceEditSchema,
	uniqueField: 'audienceId',
	audit: 'bookable_price',
	permission: 'bookings.manage'
});

async function loadBookable(raw: string) {
	const id = idParam(raw, 'Bookable');
	const [row] = await db
		.select({ b: bookable, location: enOf(location.name), tax: enOf(taxRate.name) })
		.from(bookable)
		.leftJoin(location, eq(bookable.locationId, location.id))
		.leftJoin(taxRate, eq(bookable.taxRateId, taxRate.id))
		.where(and(eq(bookable.id, id), isNull(bookable.deletedAt)));
	if (!row) error(404, 'Not found');
	return row;
}

export const load = async ({ params, locals }) => {
	const row = await loadBookable(params.id);
	const b = row.b;
	const [priceData, audiences, schedules, sessions, stamps, locations, taxRates] =
		await Promise.all([
			prices.load(b.id),
			audienceOptions(),
			db
				.select()
				.from(bookableSchedule)
				.where(and(eq(bookableSchedule.bookableId, b.id), isNull(bookableSchedule.deletedAt)))
				.orderBy(asc(bookableSchedule.weekday), asc(bookableSchedule.startsAt)),
			db
				.select({
					id: bookingSession.id,
					startsAt: bookingSession.startsAt,
					language: bookingSession.language,
					capacity: bookingSession.capacity,
					booked: bookingSession.booked,
					isCancelled: bookingSession.isCancelled
				})
				.from(bookingSession)
				.where(
					and(
						eq(bookingSession.bookableId, b.id),
						gte(bookingSession.startsAt, new Date()),
						isNull(bookingSession.deletedAt)
					)
				)
				.orderBy(asc(bookingSession.startsAt))
				.limit(60),
			stampsOf(b),
			locationOptions(),
			taxRateOptions()
		]);
	const audienceName = new Map(audiences.map((a) => [a.value, a.name]));
	return {
		bookable: b,
		location: row.location,
		tax: row.tax,
		prices: {
			...priceData,
			rows: priceData.rows.map((r) => {
				const p = r as typeof bookablePrice.$inferSelect;
				return { ...p, audience: audienceName.get(p.audienceId) ?? '—' };
			})
		},
		audiences,
		schedules,
		sessions,
		stamps,
		options: { locations, taxRates },
		canManage: hasPermission(locals, 'bookings.manage'),
		form: await superValidate(
			unpackLocalized({ ...b, languages: b.languages ?? [] }, ['name', 'description']),
			zod4(bookableEditSchema),
			{ errors: false, id: 'edit' }
		),
		imageForm: await superValidate(zod4(imageSchema), { id: 'image' }),
		scheduleForm: await superValidate(
			{ capacity: 12, startsAt: '10:00', weekday: 2 },
			zod4(bookableScheduleSchema),
			{ errors: false, id: 'schedule' }
		),
		generateForm: await superValidate(zod4(generateSessionsSchema), { id: 'generate' })
	};
};

const owner = async (event: { params: Partial<Record<string, string>> }) =>
	(await loadBookable(event.params.id ?? '')).b.id;

export const actions = {
	...childActions({ Price: prices }, owner),

	edit: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(bookableEditSchema), { id: 'edit' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { b: before } = await loadBookable(event.params.id);
		const { id: _id, ...rest } = form.data;
		const values = packLocalized({ ...rest }, ['name', 'description']);
		try {
			await db.transaction(async (tx) => {
				await tx
					.update(bookable)
					.set({
						...(values as Partial<typeof bookable.$inferInsert>),
						updatedBy: event.locals.user?.id
					})
					.where(eq(bookable.id, before.id));
				await recordAudit(tx, event, {
					table: 'bookable',
					recordId: before.id,
					action: 'update',
					before,
					after: values
				});
			});
		} catch (err) {
			if (isDuplicateKey(err)) {
				setError(form, 'slug', 'Another bookable has this slug');
				return message(
					form,
					{ type: 'error', text: 'Another bookable has this slug' },
					{ status: 400 }
				);
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Saved' });
	},
	image: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(imageSchema), { id: 'image' });
		const { b } = await loadBookable(event.params.id);
		const values: Record<string, unknown> = { ...form.data };
		try {
			await storeFileFields(values, ['image'], posted);
		} catch (err) {
			if (err instanceof UploadRefused) {
				setError(form, 'image', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			throw err;
		}
		if ('image' in values)
			await db
				.update(bookable)
				.set({ image: values.image as string | null })
				.where(eq(bookable.id, b.id));
		return message(form, { type: 'success', text: 'Image saved' });
	},
	/** Adds a weekly time, or changes one when the form carries its id. */
	schedule: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(bookableScheduleSchema), {
			id: 'schedule'
		});
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { b } = await loadBookable(event.params.id);
		const { id, ...values } = form.data;
		const row = { ...values, startsAt: `${values.startsAt.slice(0, 5)}:00` };
		if (id) {
			await db
				.update(bookableSchedule)
				.set(row)
				.where(and(eq(bookableSchedule.id, id), eq(bookableSchedule.bookableId, b.id)));
		} else {
			await db.insert(bookableSchedule).values({ ...row, bookableId: b.id });
		}
		return message(form, { type: 'success', text: id ? 'Time changed' : 'Time added' });
	},
	unschedule: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const { b } = await loadBookable(event.params.id);
		const id = z.coerce
			.number()
			.int()
			.safeParse((await event.request.formData()).get('scheduleId'));
		if (!id.success) return { message: { type: 'error', text: 'Which time?' } };
		await db
			.update(bookableSchedule)
			.set(deletionStamp(event.locals.user?.id))
			.where(and(eq(bookableSchedule.id, id.data), eq(bookableSchedule.bookableId, b.id)));
		return { message: { type: 'success', text: 'Time removed — sessions already made stay' } };
	},
	generate: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(generateSessionsSchema), {
			id: 'generate'
		});
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { b } = await loadBookable(event.params.id);
		const made = await generateSessions(b.id, form.data.days, event.locals.user?.id);
		return message(form, {
			type: made ? 'success' : 'error',
			text: made
				? `${made} session${made === 1 ? '' : 's'} added`
				: 'Nothing to add: every weekly time already has its sessions, or there are no weekly times.'
		});
	},
	delete: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const { b } = await loadBookable(event.params.id);
		const [used] = await db
			.select({ id: booking.id })
			.from(booking)
			.where(eq(booking.bookableId, b.id))
			.limit(1);
		if (used)
			return { message: { type: 'error', text: 'It has bookings: switch it off instead.' } };
		await db
			.update(bookable)
			.set(deletionStamp(event.locals.user?.id))
			.where(eq(bookable.id, b.id));
		redirect(
			'/dashboard/bookings/bookables',
			{ type: 'success', message: 'Deleted' },
			event.cookies
		);
	}
};
