<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { amount, flag, link, sortable } from '#lib/cells.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'sku',
			accessorKey: 'sku',
			header: sortable('SKU'),
			cell: ({ row }) => link('variant', row.original.id, row.original.sku)
		},
		{
			id: 'productId',
			accessorKey: 'product',
			header: sortable('Product'),
			cell: ({ row }) => link('product', row.original.productId, row.original.product)
		},
		{ id: 'bagSizeId', header: 'Size', cell: ({ row }) => row.original.size || '—' },
		{
			id: 'price',
			accessorKey: 'price',
			header: sortable('Price (ETB)'),
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.price)
		},
		{
			id: 'compareAtPrice',
			header: 'Was (ETB)',
			meta: { align: 'right', class: 'hidden md:table-cell' },
			cell: ({ row }) =>
				Number(row.original.compareAtPrice) ? amount(row.original.compareAtPrice) : '—'
		},
		{
			id: 'packed',
			accessorKey: 'packed',
			header: sortable('Bags on hand'),
			meta: { align: 'right' },
			cell: ({ row }) => row.original.packed
		},
		{
			id: 'stock',
			header: 'Stock',
			cell: ({ row }) =>
				flag(row.original.packed >= row.original.lowAt, 'In stock', `Low (< ${row.original.lowAt})`)
		},
		{ id: 'isActive', header: 'Status', cell: ({ row }) => flag(row.original.isActive) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Variants & prices"
	description="Every sellable size across the catalogue, with its price and the bags packed on hand. Sizes are added on their product's page."
/>

<DataTable
	rowHref={(row) => href('variant', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['productId', 'bagSizeId', 'stock']}
	facetLabels={{ productId: 'Product', bagSizeId: 'Size', stock: 'Stock' }}
	rowClass={(row) => (row.packed < row.lowAt ? 'bg-warning/10' : null)}
	charts
	fileName="Variants"
/>
