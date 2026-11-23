<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import LineCell from '@nahu/admin-kit/components/lines/LineCell.svelte';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { qty } from '#lib/format.ts';

	/**
	 * Lines that each take an amount out of one item — the lots a roast used, the batches a packing
	 * run drew from — as the kit's sheet: a picker, the amount, what is free of it, and a remove.
	 * `available` says how much of each item is free where it is taken from.
	 */
	type Line = Record<string, unknown>;
	let {
		lines = $bindable(),
		items,
		available,
		idKey,
		qtyKey,
		itemLabel,
		qtyLabel,
		unit,
		addLabel,
		errors = undefined
	}: {
		lines: Line[];
		items: { value: number; name: string }[];
		available: Record<number, number>;
		idKey: string;
		qtyKey: string;
		itemLabel: string;
		qtyLabel: string;
		unit: string;
		addLabel: string;
		errors?: unknown;
	} = $props();

	type Row = Line & { index: number };
	const rows = $derived(lines.map((line, index) => ({ ...line, index })));
	const update = (index: number, patch: Line) =>
		(lines = lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
	const add = () => (lines = [...lines, { [idKey]: null, [qtyKey]: 0 }]);
	const listError = $derived(
		[(errors as { _errors?: string[] } | undefined)?._errors ?? []].flat().join(' ')
	);
	const rowInvalid = (i: number) => Boolean((errors as Record<number, unknown> | undefined)?.[i]);
	const total = $derived(lines.reduce((sum, l) => sum + Number(l[qtyKey] ?? 0), 0));

	const columns: ColumnDef<Row>[] = $derived([
		{
			id: 'item',
			header: itemLabel,
			cell: ({ row }) =>
				renderComponent(LineCell, {
					kind: 'product',
					name: `${idKey}-${row.original.index}`,
					label: itemLabel,
					items,
					value: row.original[idKey] ?? undefined,
					invalid: rowInvalid(row.original.index),
					onchange: (v: unknown) => update(row.original.index, { [idKey]: v })
				})
		},
		{
			id: 'qty',
			header: qtyLabel,
			meta: { align: 'right' },
			cell: ({ row }) =>
				renderComponent(LineCell, {
					kind: 'number',
					name: `${qtyKey}-${row.original.index}`,
					label: qtyLabel,
					min: 0,
					step: '0.001',
					value: row.original[qtyKey],
					invalid:
						Number(row.original[qtyKey] ?? 0) > (available[Number(row.original[idKey])] ?? 0),
					onchange: (v: unknown) => update(row.original.index, { [qtyKey]: v })
				})
		},
		{
			id: 'free',
			header: 'Free here',
			meta: { align: 'right' },
			cell: ({ row }) =>
				row.original[idKey] ? qty(available[Number(row.original[idKey])] ?? 0, unit) : '—'
		},
		{
			id: 'remove',
			header: '',
			cell: ({ row }) =>
				renderComponent(LineCell, {
					kind: 'remove',
					name: `remove-${row.original.index}`,
					label: `Remove line ${row.original.index + 1}`,
					value: null,
					onchange: () => (lines = lines.filter((_, i) => i !== row.original.index))
				})
		}
	]);
</script>

<div class="grid grid-cols-1 gap-2">
	<DataTable
		variant="sheet"
		{columns}
		data={rows}
		summary={[{ label: 'Total', value: qty(total, unit), strong: true }]}
	/>
	{#if listError}<p class="text-sm text-destructive">{listError}</p>{/if}
	<Button type="button" variant="outline" size="sm" class="justify-self-start" onclick={add}>
		<Plus class="size-4" />
		{addLabel}
	</Button>
</div>
