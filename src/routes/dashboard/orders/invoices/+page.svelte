<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { amount, date, link, sortable, status } from '#lib/cells.ts';
	import { money } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];
	/** Past its due date and not paid: stored overdue, or open with the date gone by. */
	const late = (row: Row) =>
		row.status === 'overdue' || (row.status === 'open' && !!row.dueOn && row.dueOn < data.today);

	const columns: ColumnDef<Row>[] = [
		{
			id: 'number',
			accessorKey: 'number',
			header: sortable('Invoice'),
			cell: ({ row }) => link('invoice', row.original.id, row.original.number)
		},
		{ id: 'billingName', header: 'Billed to', cell: ({ row }) => row.original.billingName },
		{
			id: 'customer',
			header: 'Customer',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => link('customer', row.original.customerId, row.original.customer)
		},
		{
			id: 'business',
			header: 'Business',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => link('business', row.original.businessId, row.original.business)
		},
		{
			id: 'order',
			header: 'Order',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => link('order', row.original.orderId, row.original.orderNumber)
		},
		{
			id: 'status',
			header: 'Status',
			cell: ({ row }) => status(late(row.original) ? 'overdue' : row.original.status)
		},
		{
			id: 'issuedAt',
			accessorKey: 'issuedAt',
			header: sortable('Issued'),
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => date(row.original.issuedAt)
		},
		{
			id: 'dueOn',
			accessorKey: 'dueOn',
			header: sortable('Due'),
			cell: ({ row }) => date(row.original.dueOn)
		},
		{
			id: 'total',
			accessorKey: 'total',
			header: sortable('Total (ETB)'),
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.total)
		},
		{
			id: 'balance',
			header: 'Balance (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) =>
				['void', 'draft'].includes(row.original.status)
					? '—'
					: amount(Number(row.original.total) - Number(row.original.amountPaid))
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Invoices"
	description="Group bookings, school visits, private hire and wholesale — billed, then paid by transfer."
>
	<p class="text-sm text-muted-foreground">
		{money(data.sums.outstanding)} outstanding · {data.sums.overdue} overdue
	</p>
</PageHeader>

<DataTable
	rowHref={(row) => href('invoice', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['status']}
	facetLabels={{ status: 'Status' }}
	dateFilter="Issued"
	rowClass={(row) => (late(row) ? 'bg-destructive/10' : null)}
	fileName="Invoices"
/>
