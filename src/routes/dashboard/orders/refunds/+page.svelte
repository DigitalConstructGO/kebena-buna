<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { amount, dateTime, link, longText, sortable, status, user } from '#lib/cells.ts';
	import { money } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{ id: 'id', header: 'Refund', cell: ({ row }) => link('refund', row.original.id, `#${row.original.id}`) },
		{
			id: 'createdAt',
			accessorKey: 'createdAt',
			header: sortable('Asked'),
			cell: ({ row }) => dateTime(row.original.createdAt)
		},
		{ id: 'order', header: 'Order', cell: ({ row }) => link('order', row.original.orderId, row.original.orderNumber) },
		{
			id: 'customer',
			header: 'Customer',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => link('customer', row.original.customerId, row.original.customer)
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{ id: 'reason', header: 'Reason', meta: { class: 'hidden lg:table-cell' }, cell: ({ row }) => longText(row.original.reason) },
		{
			id: 'requestedBy',
			header: 'Asked by',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => user(row.original.requestedById, row.original.requestedBy)
		},
		{
			id: 'approvedBy',
			header: 'Approved by',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => user(row.original.approvedById, row.original.approvedBy)
		},
		{
			id: 'amount',
			accessorKey: 'amount',
			header: sortable('Amount (ETB)'),
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.amount)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Refunds"
	description="Requested from an order, approved by a Manager or the Owner, then paid back the way the customer paid."
>
	<p class="text-sm text-muted-foreground">
		{data.sums.waiting} waiting for approval · {money(data.sums.refunded)} refunded in all
	</p>
</PageHeader>

<DataTable
	rowHref={(row) => href('refund', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['status']}
	facetLabels={{ status: 'Status' }}
	dateFilter="Asked"
	rowClass={(row) => (row.status === 'requested' ? 'bg-warning/10' : null)}
	fileName="Refunds"
/>
