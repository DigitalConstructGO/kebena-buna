import { asc, eq, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { db } from '#lib/server/db/index.ts';
import { bookable, booking, bookingSession, location } from '#lib/server/db/schema.ts';
import { enOf, packLocalized } from '#lib/server/localized.ts';
import { locationOptions, taxRateOptions } from '#lib/server/options.ts';
import { bookableSchema } from '#lib/schemas/bookings.ts';

export const load = async ({ locals }) => {
	const canManage = hasPermission(locals, 'bookings.manage');
	const rows = await db
		.select({
			id: bookable.id,
			name: enOf(bookable.name),
			kind: bookable.kind,
			locationId: bookable.locationId,
			location: enOf(location.name),
			durationMin: bookable.durationMin,
			pricing: bookable.pricing,
			isEnquiryOnly: bookable.isEnquiryOnly,
			publishStatus: bookable.publishStatus,
			isActive: bookable.isActive,
			upcoming:
				sql<number>`(select count(*) from ${bookingSession} s where s.bookable_id = ${bookable.id} and s.starts_at >= now() and not s.is_cancelled)`.mapWith(
					Number
				),
			open: sql<number>`(select count(*) from ${booking} b where b.bookable_id = ${bookable.id} and b.status in ('new', 'in_progress', 'confirmed') and b.deleted_at is null)`.mapWith(
				Number
			)
		})
		.from(bookable)
		.leftJoin(location, eq(bookable.locationId, location.id))
		.where(isNull(bookable.deletedAt))
		.orderBy(asc(bookable.sortOrder));
	return {
		rows,
		canManage,
		form: await superValidate({ languages: ['am', 'en'] }, zod4(bookableSchema), { errors: false }),
		options: canManage
			? { locations: await locationOptions(), taxRates: await taxRateOptions() }
			: { locations: [], taxRates: [] }
	};
};

export const actions = {
	add: async (event) => {
		requirePermission(event.locals, 'bookings.manage');
		const form = await superValidate(event.request, zod4(bookableSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		let id: number;
		try {
			const [res] = await db.insert(bookable).values({
				...(packLocalized({ ...form.data }, [
					'name',
					'description'
				]) as unknown as typeof bookable.$inferInsert),
				createdBy: event.locals.user?.id
			});
			id = res.insertId;
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
		redirect(
			`/dashboard/bookings/bookables/${id}`,
			{ type: 'success', message: 'Added — now set its prices and weekly times' },
			event.cookies
		);
	}
};
