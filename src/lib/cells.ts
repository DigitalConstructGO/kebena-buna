/**
 * Column building blocks shared by every table, so a sortable header, a status badge, a linked
 * record or an amount is written one way everywhere.
 *
 *     const columns: ColumnDef<Row>[] = [
 *       { id: 'number', header: sortable('Order'), cell: ({ row }) => link('order', row.original.id, row.original.number) },
 *       { id: 'customer', header: 'Customer', cell: ({ row }) => link('customer', row.original.customerId, row.original.customer) },
 *       { id: 'createdBy', header: 'Created by', cell: ({ row }) => user(row.original.createdById, row.original.createdBy) },
 *       { id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
 *       { id: 'total', header: 'Total (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.total) }
 *     ];
 *
 * `link` and `user` resolve the target through `ENTITIES` and render plain text for a viewer who
 * may not open it — a foreign key becomes a way to get there only when it leads somewhere.
 */
import type { HeaderContext } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import BigText from '@nahu/admin-kit/components/Table/bigText.svelte';
import Copy from '@nahu/admin-kit/Copy.svelte';
import { userCell } from '@nahu/admin-kit/tableCells';
import { badge, flag as flagBadge } from '#lib/status.ts';
import {
	amount as formatAmount,
	formatDate,
	formatDateTime,
	kg as formatKg,
	pct,
	tr,
	type Localized
} from '#lib/format.ts';

/** A header that sorts the column — in memory, or through the URL for a server-mode table. */
export const sortable =
	(name: string) =>
	<T, V>({ column }: HeaderContext<T, V>) =>
		renderComponent(DataTableSort, { name, onclick: column.getToggleSortingHandler(), direction: column.getIsSorted() });

/** A record's name, linked to its page when the viewer may open it (`ENTITIES`). */
export const link = (
	entity: string,
	id: number | string | null | undefined,
	name: string | null | undefined
) => (name ? renderComponent(DataTableLinks, { entity, id: id ?? null, name }) : '—');

/** A staff or customer sign-in (`created_by`, `rider_id` …), linked to their user page. */
export const user = (id: string | null | undefined, name: string | null | undefined) =>
	userCell(id, name);

/** A domain status as a coloured badge (`#lib/status`). */
export const status = (value: string | null | undefined, label?: string) =>
	renderComponent(Statuses, badge(value, label));

/** A true/false column as a badge. */
export const flag = (on: boolean | null | undefined, yes?: string, no?: string) =>
	renderComponent(Statuses, flagBadge(on, yes, no));

/** Long free text: the first `max` characters and a "…" that opens the rest. */
export const longText = (text: string | null | undefined, max = 30) =>
	text ? renderComponent(BigText, { text, max }) : '—';

/** A phone number with a copy button. */
export const phone = (value: string | null | undefined) =>
	value ? renderComponent(Copy, { data: value }) : '—';

/** An amount in a column already headed in birr: "1,500.00". */
export const amount = (value: number | string | null | undefined) =>
	value === null || value === undefined ? '—' : formatAmount(value);

export const kg = (value: number | string | null | undefined) => formatKg(value);
export const percent = (value: number | string | null | undefined) => pct(value);
export const date = (value: string | Date | null | undefined) => formatDate(value);
export const dateTime = (value: string | Date | null | undefined) => formatDateTime(value);

/** A translated name (`{ en, am, … }`) in English, falling back through the other languages. */
export const text = (value: Localized | string) => tr(value) || '—';
