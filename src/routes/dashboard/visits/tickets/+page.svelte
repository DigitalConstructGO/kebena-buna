<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { localClock } from '@nahu/admin-kit/time';
	import { date, link, sortable, status } from '#lib/cells.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'code',
			accessorKey: 'code',
			header: sortable('Ticket'),
			cell: ({ row }) => link('ticket', row.original.id, row.original.code)
		},
		{
			id: 'visitDate',
			accessorKey: 'visitDate',
			header: sortable('Visit'),
			cell: ({ row }) =>
				row.original.dayId
					? link('visitDay', row.original.dayId, `${date(row.original.visitDate)} · ${localClock(row.original.slotStart!)}`)
					: date(row.original.visitDate)
		},
		{
			id: 'event',
			header: 'Event',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => (row.original.eventId ? link('event', row.original.eventId, row.original.event) : 'Entry')
		},
		{
			id: 'ticketTypeId',
			header: 'Type',
			cell: ({ row }) => link('ticketType', row.original.ticketTypeId, row.original.ticketType)
		},
		{ id: 'audienceId', header: 'Audience', meta: { class: 'hidden md:table-cell' }, cell: ({ row }) => row.original.audience },
		{
			id: 'holder',
			header: 'Holder',
			cell: ({ row }) =>
				row.original.customerId
					? link('customer', row.original.customerId, row.original.customer ?? row.original.holderName)
					: (row.original.holderName ?? '—')
		},
		{
			id: 'order',
			header: 'Order',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => link('order', row.original.orderId, row.original.orderNumber)
		},
		{
			id: 'admits',
			accessorKey: 'admits',
			header: sortable('In / admits'),
			meta: { align: 'right' },
			cell: ({ row }) => `${row.original.checkedIn} / ${row.original.admits}`
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Tickets"
	description="Every entry and event ticket issued, online or at the desk. Search by code, holder or phone."
>
	{#snippet actions()}
		<Button href="/dashboard/visits/desk"><ScanLine class="size-4" /> Check-in desk</Button>
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('ticket', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['status', 'ticketTypeId', 'audienceId']}
	facetLabels={{ status: 'Status', ticketTypeId: 'Type', audienceId: 'Audience' }}
	dateFilter="Visit date"
	charts
	fileName="Tickets"
/>
