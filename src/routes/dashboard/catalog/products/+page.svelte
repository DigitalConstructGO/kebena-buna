<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { amount, date, link, sortable, status, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			accessorKey: 'name',
			header: sortable('Product'),
			cell: ({ row }) => link('product', row.original.id, row.original.name)
		},
		{ id: 'categoryId', header: 'Category', cell: ({ row }) => row.original.category || '—' },
		{
			id: 'kind',
			header: 'Kind',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => humanize(row.original.kind)
		},
		{
			id: 'fulfilment',
			header: 'Fulfilment',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => humanize(row.original.fulfilment)
		},
		{
			id: 'variants',
			header: 'Sizes',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.variants
		},
		{
			id: 'fromPrice',
			accessorKey: 'fromPrice',
			header: sortable('From (ETB)'),
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.fromPrice)
		},
		{
			id: 'packed',
			accessorKey: 'packed',
			header: sortable('Bags on hand'),
			meta: { align: 'right' },
			cell: ({ row }) => row.original.packed
		},
		{
			id: 'publishStatus',
			header: 'Website',
			cell: ({ row }) => status(row.original.publishStatus)
		},
		{
			id: 'createdBy',
			header: 'Added by',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => user(row.original.createdById, row.original.createdBy)
		},
		{
			id: 'createdAt',
			accessorKey: 'createdAt',
			header: sortable('Added'),
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => date(row.original.createdAt)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Products"
	description="Coffees, bundles and merchandise. A product's sizes are its variants; roast and grind are free choices from its allowed lists."
>
	{#snippet actions()}
		{#if data.canManage}
			<Button href="/dashboard/catalog/products/new"><Plus class="size-4" /> New product</Button>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('product', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['categoryId', 'kind', 'publishStatus', 'fulfilment']}
	facetLabels={{
		categoryId: 'Category',
		kind: 'Kind',
		publishStatus: 'Website',
		fulfilment: 'Fulfilment'
	}}
	dateFilter="Added"
	charts
	fileName="Products"
/>
