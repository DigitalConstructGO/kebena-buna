<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import { localClock } from '@nahu/admin-kit/time';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { dateTime, link, sortable, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{ id: 'userId', accessorKey: 'user', header: sortable('Who'), cell: ({ row }) => user(row.original.userId, row.original.user) },
		{ id: 'role', header: 'Role', cell: ({ row }) => humanize(row.original.role) },
		{ id: 'startsAt', accessorKey: 'startsAt', header: sortable('From'), cell: ({ row }) => dateTime(row.original.startsAt) },
		{ id: 'endsAt', header: 'To', cell: ({ row }) => localClock(row.original.endsAt) },
		{ id: 'what', header: 'What', cell: ({ row }) => link('bookable', row.original.bookableId, row.original.bookable ?? row.original.event) },
		{
			id: 'on',
			header: 'On',
			cell: ({ row }) =>
				row.original.sessionId
					? link('session', row.original.sessionId, 'Session')
					: row.original.bookingId
						? link('booking', row.original.bookingId, row.original.bookingNumber)
						: link('event', row.original.eventId, row.original.event)
		},
		{ id: 'by', header: 'Assigned by', meta: { class: 'hidden md:table-cell' }, cell: ({ row }) => user(row.original.assignedById, row.original.assignedBy) }
	];
</script>

<PageHeader title="Staff assignments" description="Who runs what, when: guides on tours, hosts on ceremonies and private events." />

<DataTable
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['userId', 'role']}
	facetLabels={{ userId: 'Who', role: 'Role' }}
	dateFilter="Date"
	charts
	fileName="Staff assignments"
/>
