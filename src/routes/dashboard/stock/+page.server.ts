import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { stockLocationOptions } from '#lib/server/options.ts';
import { joinDateTime } from '#lib/server/records.ts';
import { adjustStock, transferStock } from '#lib/server/stock.ts';
import {
	greenBalances,
	lowStock,
	packedBalances,
	roastedBalances,
	stockItemOptions,
	stockLevels
} from '#lib/server/stockReads.ts';
import { adjustSchema, transferSchema } from '#lib/schemas/stock.ts';

export const load = async ({ locals }) => {
	const [green, roasted, packed, levels, items, locations] = await Promise.all([
		greenBalances(),
		roastedBalances(),
		packedBalances(),
		stockLevels(),
		stockItemOptions(),
		stockLocationOptions()
	]);
	// Low stock is judged on the whole holding, across locations (questionnaire 4.3).
	const low = await lowStock(levels);

	const today = localToday();
	return {
		green,
		roasted,
		packed,
		low,
		levels,
		items,
		locations,
		canManage: hasPermission(locals, 'stock.manage'),
		adjustForm: await superValidate(
			{ stage: 'green' as const, reason: 'adjustment' as const, date: today },
			zod4(adjustSchema),
			{ errors: false, id: 'adjust' }
		),
		transferForm: await superValidate(
			{ stage: 'packed' as const, date: today },
			zod4(transferSchema),
			{ errors: false, id: 'transfer' }
		)
	};
};

const refused = (form: Parameters<typeof message>[0], err: unknown) => {
	if (err instanceof WriteRefused)
		return message(form, { type: 'error', text: err.message }, { status: 400 });
	throw err;
};

export const actions = {
	adjust: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const form = await superValidate(event.request, zod4(adjustSchema), { id: 'adjust' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		try {
			await db.transaction(async (tx) => {
				await adjustStock(tx, {
					...form.data,
					occurredAt: joinDateTime(form.data.date, '12:00'),
					userId: event.locals.user?.id
				});
				// Stock adjustments are audited (questionnaire 5.1).
				await recordAudit(tx, event, {
					table: 'stock_movement',
					recordId: `${form.data.stage}:${form.data.itemId}`,
					action: 'create',
					detail: {
						reason: form.data.reason,
						quantity: form.data.quantity,
						locationId: form.data.locationId,
						note: form.data.note
					}
				});
			});
		} catch (err) {
			return refused(form, err);
		}
		return message(form, { type: 'success', text: 'Stock updated' });
	},
	transfer: async (event) => {
		requirePermission(event.locals, 'stock.manage');
		const form = await superValidate(event.request, zod4(transferSchema), { id: 'transfer' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		try {
			await db.transaction((tx) =>
				transferStock(tx, {
					...form.data,
					occurredAt: joinDateTime(form.data.date, '12:00'),
					userId: event.locals.user?.id
				})
			);
		} catch (err) {
			return refused(form, err);
		}
		return message(form, { type: 'success', text: 'Transfer recorded' });
	}
};
