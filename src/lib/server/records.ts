/**
 * Small server helpers the dashboard's loads and actions share: date + time pairs for `datetime`
 * columns, gap-free document numbers, and lookup screens that check who may change them, over any
 * table or one with translated columns.
 */
import { eq, sql } from 'drizzle-orm';
import { error, type RequestEvent } from '@sveltejs/kit';
import { contentCrud as kitCrud } from '@nahu/admin-kit/server/crud';
import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { fromLocal, localClock, localDate } from '@nahu/admin-kit/time';
import type { Writer } from '@nahu/admin-kit/server/db';
import type { Permission } from '#lib/access.ts';
import { documentSequence } from '#lib/server/db/schema.ts';
import { packLocalized, unpackLocalized } from '#lib/server/localized.ts';

/**
 * A `datetime` column is entered as the kit's date input plus a time input. These turn one into
 * the other, in Addis Ababa time.
 */
export const joinDateTime = (date: string, time: string | null | undefined) =>
	fromLocal(date, (time || '00:00').slice(0, 5));

export const splitDateTime = (value: Date | string | null | undefined) =>
	value ? { date: localDate(value), time: localClock(value) } : { date: '', time: '' };

/**
 * The next number in a gap-free sequence (`order:2026`), taken under a row lock in the caller's
 * transaction, so two writers never share one and a rolled-back write never burns one.
 */
export async function nextNumber(tx: Writer, key: string): Promise<number> {
	await tx
		.insert(documentSequence)
		.values({ key, nextValue: 1 })
		.onDuplicateKeyUpdate({ set: { key: sql`${documentSequence.key}` } });
	const [row] = await tx
		.select({ next: documentSequence.nextValue })
		.from(documentSequence)
		.where(eq(documentSequence.key, key))
		.for('update');
	await tx
		.update(documentSequence)
		.set({ nextValue: row.next + 1 })
		.where(eq(documentSequence.key, key));
	return row.next;
}

/** An id from the route, or a 404. */
export function idParam(raw: string, what = 'Record'): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, `${what} not found`);
	return id;
}

type AnyTable = Parameters<typeof kitCrud>[0]['table'];
type CrudArgs = Parameters<typeof kitCrud>[0];

/**
 * The kit's `contentCrud`, whose add and edit check no permission (only its delete wants a super
 * admin): a lookup page sits under its section's `*.view` rule, so `permission` — the section's
 * `*.manage` — is what stops view-only staff changing its rows by posting to the page.
 */
export function contentCrud<T extends AnyTable>(
	args: Parameters<typeof kitCrud<T>>[0] & { permission: Permission }
) {
	const { permission, ...rest } = args;
	const crud = kitCrud<T>(rest);
	const { add, edit } = crud.actions;
	return {
		...crud,
		actions: {
			...crud.actions,
			add: (event: RequestEvent) => {
				requirePermission(event.locals, permission);
				return add(event);
			},
			edit: (event: RequestEvent) => {
				requirePermission(event.locals, permission);
				return edit(event);
			}
		}
	};
}

/**
 * `contentCrud` for a table with translated columns: the forms carry `nameEn`/`nameAm`/…, folded
 * into `name` on write, and the rows come back with the flat keys too, so the kit's `LookupPage`
 * edit dialog seeds them like any other field.
 */
export function localizedCrud(args: CrudArgs & { localized: string[]; permission: Permission }) {
	const { localized, transform, ...rest } = args;
	const crud = contentCrud({
		...rest,
		transform: async (values, event, before) => {
			packLocalized(values, localized);
			return transform ? transform(values, event, before) : values;
		}
	});
	return {
		actions: crud.actions,
		load: async (event?: RequestEvent | { locals: App.Locals }) => {
			const data = await crud.load(event);
			return {
				...data,
				rows: data.rows.map(
					(r) =>
						unpackLocalized(r as Record<string, unknown>, localized) as { id: number } & Record<
							string,
							unknown
						>
				)
			};
		}
	};
}
