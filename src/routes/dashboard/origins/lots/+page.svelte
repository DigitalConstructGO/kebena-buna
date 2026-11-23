<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { date, flag, kg, link, sortable, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'code',
			accessorKey: 'code',
			header: sortable('Lot'),
			cell: ({ row }) => link('lot', row.original.id, row.original.code)
		},
		{
			id: 'stationId',
			header: 'Station',
			cell: ({ row }) => link('station', row.original.stationId, row.original.station)
		},
		{
			id: 'region',
			header: 'Region',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => link('region', row.original.regionId, row.original.region)
		},
		{ id: 'process', header: 'Process', cell: ({ row }) => humanize(row.original.process) },
		{ id: 'cropYear', accessorKey: 'cropYear', header: sortable('Crop year') },
		{
			id: 'grade',
			accessorKey: 'grade',
			header: sortable('Grade'),
			meta: { align: 'right' },
			cell: ({ row }) => row.original.grade ?? '—'
		},
		{
			id: 'cuppingScore',
			accessorKey: 'cuppingScore',
			header: sortable('Cupping'),
			meta: { align: 'right' },
			cell: ({ row }) => row.original.cuppingScore ?? '—'
		},
		{
			id: 'greenKg',
			accessorKey: 'greenKg',
			header: sortable('Green on hand'),
			meta: { align: 'right' },
			cell: ({ row }) => kg(row.original.greenKg)
		},
		{
			id: 'createdBy',
			header: 'Entered by',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => user(row.original.createdById, row.original.createdBy)
		},
		{
			id: 'createdAt',
			accessorKey: 'createdAt',
			header: sortable('Entered'),
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => date(row.original.createdAt)
		},
		{ id: 'isActive', header: 'Status', cell: ({ row }) => flag(row.original.isActive) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Green lots"
	description="Every lot of green coffee, from its station and crop year to what is left on hand."
>
	{#snippet actions()}
		{#if data.canManage}
			<Button href="/dashboard/origins/lots/new"><Plus class="size-4" /> New lot</Button>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('lot', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['process', 'stationId', 'cropYear']}
	facetLabels={{ process: 'Process', stationId: 'Station', cropYear: 'Crop year' }}
	dateFilter="Entered"
	charts
	fileName="Lots"
/>
