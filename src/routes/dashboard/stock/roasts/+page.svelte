<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { dateTime, flag, kg, link, percent, sortable, status, user } from '#lib/cells.ts';
	import { pct } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	/** Outside the `roast.loss_range` setting: the probe, the scale or the roast needs a look. */
	const offRange = (r: Row) =>
		r.weightLossPct !== null &&
		(Number(r.weightLossPct) < data.lossRange.min || Number(r.weightLossPct) > data.lossRange.max);

	const columns: ColumnDef<Row>[] = [
		{ id: 'code', accessorKey: 'code', header: sortable('Batch'), cell: ({ row }) => link('roastBatch', row.original.id, row.original.code) },
		{ id: 'roastedAt', accessorKey: 'roastedAt', header: sortable('Roasted'), cell: ({ row }) => dateTime(row.original.roastedAt) },
		{ id: 'productId', header: 'For', cell: ({ row }) => link('product', row.original.productId, row.original.product) },
		{ id: 'roastLevelId', header: 'Roast', cell: ({ row }) => row.original.roastLevel },
		{ id: 'machineId', header: 'Machine', meta: { class: 'hidden lg:table-cell' }, cell: ({ row }) => row.original.machine ?? '—' },
		{ id: 'locationId', header: 'Location', meta: { class: 'hidden xl:table-cell' }, cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'greenKgIn', accessorKey: 'greenKgIn', header: sortable('Green in'), meta: { align: 'right' }, cell: ({ row }) => kg(row.original.greenKgIn) },
		{ id: 'roastedKgOut', accessorKey: 'roastedKgOut', header: sortable('Roasted out'), meta: { align: 'right' }, cell: ({ row }) => kg(row.original.roastedKgOut) },
		{
			id: 'weightLossPct',
			accessorKey: 'weightLossPct',
			header: sortable('Loss'),
			meta: { align: 'right' },
			cell: ({ row }) =>
				offRange(row.original) ? status('failed', pct(row.original.weightLossPct)) : percent(row.original.weightLossPct)
		},
		{ id: 'cuppingScore', accessorKey: 'cuppingScore', header: sortable('Cupping'), meta: { align: 'right', class: 'hidden lg:table-cell' }, cell: ({ row }) => row.original.cuppingScore ?? '—' },
		{ id: 'roaster', header: 'Roaster', meta: { class: 'hidden md:table-cell' }, cell: ({ row }) => user(row.original.roasterId, row.original.roaster) },
		{ id: 'isToOrder', header: 'To order', meta: { class: 'hidden xl:table-cell' }, cell: ({ row }) => flag(row.original.isToOrder, 'Roast day', 'Shelf') }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Roast batches"
	description="Every roast, the lots it used and what came out. Loss outside {data.lossRange.min}–{data.lossRange.max}% is flagged."
>
	{#snippet actions()}
		{#if data.canManage}
			<Button href="/dashboard/stock/roasts/new"><Plus class="size-4" /> Record roast</Button>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('roastBatch', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['productId', 'roastLevelId', 'machineId', 'locationId']}
	facetLabels={{ productId: 'Product', roastLevelId: 'Roast', machineId: 'Machine', locationId: 'Location' }}
	dateFilter="Roasted"
	rowClass={(r) => (offRange(r) ? 'bg-destructive/5' : null)}
	charts
	fileName="Roast batches"
/>
