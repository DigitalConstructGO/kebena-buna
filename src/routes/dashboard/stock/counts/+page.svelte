<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { dateTime, flag, link, longText, sortable, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{ id: 'id', accessorKey: 'id', header: sortable('Count'), cell: ({ row }) => link('stockCount', row.original.id, `Count #${row.original.id}`) },
		{ id: 'countedAt', accessorKey: 'countedAt', header: sortable('Counted'), cell: ({ row }) => dateTime(row.original.countedAt) },
		{ id: 'location', accessorKey: 'location', header: 'Location', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'stage', accessorKey: 'stage', header: 'Stage', cell: ({ row }) => humanize(row.original.stage) },
		{ id: 'isOpening', header: 'Kind', cell: ({ row }) => flag(row.original.isOpening, 'Opening count', 'Periodic') },
		{ id: 'lineCount', accessorKey: 'lineCount', header: 'Lines counted', meta: { align: 'right' } },
		{ id: 'adjusted', accessorKey: 'adjusted', header: 'Corrections', meta: { align: 'right' } },
		{ id: 'note', header: 'Note', cell: ({ row }) => longText(row.original.note) },
		{ id: 'by', header: 'Counted by', cell: ({ row }) => user(row.original.createdById, row.original.createdBy) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Stock counts"
	description="Opening and periodic counts. Where a count differs from the books, it posts a correction to the ledger."
>
	{#snippet actions()}
		{#if data.canManage}
			<Button href="/dashboard/stock/counts/new"><Plus class="size-4" /> Count stock</Button>
		{/if}
	{/snippet}
</PageHeader>

<DataTable rowHref={(row) => href('stockCount', row.id)} {columns} data={data.rows} facetKeys={['location', 'stage']} fileName="Stock counts" />
