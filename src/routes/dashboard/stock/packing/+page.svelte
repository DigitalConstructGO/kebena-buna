<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { date, dateTime, flag, link, sortable, user } from '#lib/cells.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'code',
			accessorKey: 'code',
			header: sortable('Run'),
			cell: ({ row }) => link('packingRun', row.original.id, row.original.code)
		},
		{
			id: 'packedAt',
			accessorKey: 'packedAt',
			header: sortable('Packed'),
			cell: ({ row }) => dateTime(row.original.packedAt)
		},
		{
			id: 'productId',
			header: 'Product',
			cell: ({ row }) => link('product', row.original.productId, row.original.product)
		},
		{
			id: 'variant',
			header: 'Bag',
			cell: ({ row }) => link('variant', row.original.variantId, row.original.sku)
		},
		{ id: 'roastLevelId', header: 'Roast', cell: ({ row }) => row.original.roastLevel },
		{
			id: 'grind',
			header: 'Grind',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => row.original.grind ?? '—'
		},
		{
			id: 'locationId',
			header: 'Into',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => link('location', row.original.locationId, row.original.location)
		},
		{ id: 'units', accessorKey: 'units', header: sortable('Bags'), meta: { align: 'right' } },
		{
			id: 'bestBefore',
			accessorKey: 'bestBefore',
			header: sortable('Best before'),
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => date(row.original.bestBefore)
		},
		{
			id: 'label',
			header: 'Label',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => flag(Boolean(row.original.labelPrintedAt), 'Printed', 'Not printed')
		},
		{
			id: 'packedBy',
			header: 'Packed by',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => user(row.original.packedById, row.original.packedBy)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Packing runs"
	description="Roasted coffee into bags. One label, and one public traceability page, per run."
>
	{#snippet actions()}
		{#if data.canManage}
			<Button href="/dashboard/stock/packing/new"><Plus class="size-4" /> Record packing</Button>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('packingRun', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['productId', 'roastLevelId', 'locationId']}
	facetLabels={{ productId: 'Product', roastLevelId: 'Roast', locationId: 'Into' }}
	dateFilter="Packed"
	charts
	fileName="Packing runs"
/>
