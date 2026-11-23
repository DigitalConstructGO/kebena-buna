<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { dateTime, link, sortable, status, user } from '#lib/cells.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{ id: 'number', accessorKey: 'number', header: sortable('Booking'), cell: ({ row }) => link('booking', row.original.id, row.original.number) },
		{ id: 'bookableId', header: 'What', cell: ({ row }) => link('bookable', row.original.bookableId, row.original.bookable) },
		{
			id: 'contact',
			header: 'Who',
			cell: ({ row }) =>
				link('customer', row.original.customerId, row.original.organisationName ?? row.original.contactName)
		},
		{ id: 'partySize', accessorKey: 'partySize', header: sortable('People'), meta: { align: 'right' } },
		{
			id: 'when',
			accessorKey: 'when',
			header: sortable('When'),
			cell: ({ row }) =>
				row.original.sessionId
					? link('session', row.original.sessionId, dateTime(row.original.when))
					: row.original.when
						? dateTime(row.original.when)
						: 'To be agreed'
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{ id: 'assignedTo', header: 'Handled by', meta: { class: 'hidden md:table-cell' }, cell: ({ row }) => user(row.original.assignedTo, row.original.assignee) },
		{ id: 'createdAt', accessorKey: 'createdAt', header: sortable('Received'), meta: { class: 'hidden lg:table-cell' }, cell: ({ row }) => dateTime(row.original.createdAt) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Bookings"
	description="Tours, ceremonies, cuppings, private hire and school visits, through the shared inbox workflow."
/>

<DataTable
	rowHref={(row) => href('booking', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['status', 'bookableId', 'assignedTo']}
	facetLabels={{ status: 'Status', bookableId: 'What', assignedTo: 'Handled by' }}
	dateFilter="Received"
	charts
	fileName="Bookings"
/>
