<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { amount, dateTime, link, sortable, status, user } from '#lib/cells.ts';
	import { humanize, money } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{ id: 'txRef', header: 'Payment', cell: ({ row }) => link('payment', row.original.id, row.original.txRef) },
		{
			id: 'createdAt',
			accessorKey: 'createdAt',
			header: sortable('Started'),
			cell: ({ row }) => dateTime(row.original.createdAt)
		},
		{ id: 'order', header: 'Order', cell: ({ row }) => link('order', row.original.orderId, row.original.orderNumber) },
		{
			id: 'invoice',
			header: 'Invoice',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => link('invoice', row.original.invoiceId, row.original.invoiceNumber)
		},
		{
			id: 'provider',
			header: 'Via',
			cell: ({ row }) => humanize(row.original.provider) + (row.original.method ? ` · ${row.original.method}` : '')
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{
			id: 'recordedBy',
			header: 'Recorded by',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => (row.original.recordedById ? user(row.original.recordedById, row.original.recordedBy) : 'Gateway')
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
	title="Payments"
	description="Every payment attempt and every payment recorded at the desk or by bank transfer."
>
	<p class="text-sm text-muted-foreground">
		Shown: {money(data.sums.received)} received · {money(data.sums.fees)} in gateway fees
	</p>
</PageHeader>

<DataTable
	rowHref={(row) => href('payment', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['provider', 'status']}
	facetLabels={{ provider: 'Via', status: 'Status' }}
	dateFilter="Started"
	charts
	fileName="Payments"
/>
