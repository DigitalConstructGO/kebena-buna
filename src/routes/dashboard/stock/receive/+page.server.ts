import { and, desc, eq, isNull } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { location, lot, stockMovement } from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stockLocationOptions } from '#lib/server/options.ts';
import { userAlias } from '#lib/server/people.ts';
import { joinDateTime } from '#lib/server/records.ts';
import { receiveGreen } from '#lib/server/stock.ts';
import { receiveSchema } from '#lib/schemas/stock.ts';

const receiver = userAlias('receiver');

export const load = async ({ locals, url }) => {
	requirePermission(locals, 'stock.manage');
	const [lots, locations, recent, [roastery]] = await Promise.all([
		db
			.select({ value: lot.id, name: lot.code })
			.from(lot)
			.where(and(isNull(lot.deletedAt), eq(lot.isActive, true)))
			.orderBy(desc(lot.cropYear), lot.code),
		stockLocationOptions(),
		db
			.select({
				id: stockMovement.id,
				occurredAt: stockMovement.occurredAt,
				lotId: stockMovement.lotId,
				lot: lot.code,
				locationId: stockMovement.locationId,
				location: enOf(location.name),
				kg: stockMovement.quantity,
				costPerKg: stockMovement.unitCost,
				note: stockMovement.note,
				byId: stockMovement.createdBy,
				by: receiver.name
			})
			.from(stockMovement)
			.innerJoin(lot, eq(stockMovement.lotId, lot.id))
			.innerJoin(location, eq(stockMovement.locationId, location.id))
			.leftJoin(receiver, eq(stockMovement.createdBy, receiver.id))
			.where(eq(stockMovement.reason, 'receipt'))
			.orderBy(desc(stockMovement.occurredAt), desc(stockMovement.id))
			.limit(30),
		db.select({ id: location.id }).from(location).where(eq(location.type, 'roastery'))
	]);
	return {
		lots,
		locations,
		recent,
		form: await superValidate(
			{ date: localToday(), locationId: roastery?.id, lotId: Number(url.searchParams.get('lot')) || undefined },
			zod4(receiveSchema),
			{ errors: false }
		)
	};
};

export const actions = {
	default: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const form = await superValidate(event.request, zod4(receiveSchema));
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { date, ...values } = form.data;
		try {
			await db.transaction(async (tx) => {
				await receiveGreen(tx, { ...values, occurredAt: joinDateTime(date, '12:00'), userId: event.locals.user?.id });
				await recordAudit(tx, event, {
					table: 'green_stock',
					recordId: `${values.lotId}:${values.locationId}`,
					action: 'create',
					detail: { kg: values.kg, costPerKg: values.costPerKg }
				});
			});
		} catch (err) {
			if (err instanceof WriteRefused) {
				if (err.field) setError(form, err.field as never, err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: `${values.kg} kg received` });
	}
};
