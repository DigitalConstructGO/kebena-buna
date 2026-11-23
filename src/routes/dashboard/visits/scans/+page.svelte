<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { dateTime, link, sortable, status, user } from '#lib/cells.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{ id: 'scannedAt', accessorKey: 'scannedAt', header: sortable('Scanned'), cell: ({ row }) => dateTime(row.original.scannedAt) },
		{
			id: 'what',
			header: 'Ticket or member',
			cell: ({ row }) =>
				row.original.ticketId
					? link('ticket', row.original.ticketId, row.original.ticketCode)
					: row.original.memberId
						? link('membership', row.original.membershipId, `Member card · ${row.original.memberName}`)
						: row.original.scannedCode
		},
		{ id: 'result', header: 'Result', cell: ({ row }) => status(row.original.result) },
		{ id: 'headcount', accessorKey: 'headcount', header: sortable('People'), meta: { align: 'right' } },
		{ id: 'deviceId', header: 'Device', cell: ({ row }) => row.original.device ?? 'Desk' },
		{
			id: 'locationId',
			header: 'Location',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => link('location', row.original.locationId, row.original.location)
		},
		{ id: 'by', header: 'By', meta: { class: 'hidden md:table-cell' }, cell: ({ row }) => user(row.original.byId, row.original.by) },
		{
			id: 'syncedAt',
			accessorKey: 'syncedAt',
			header: sortable('Synced'),
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => (row.original.wasOffline ? `${dateTime(row.original.syncedAt)} (offline)` : dateTime(row.original.syncedAt))
		}
	];
</script>

<PageHeader
	title="Scans"
	description="Every scan at the gates, as the scanners synced it — admissions, re-entries and refusals."
/>

<DataTable
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['result', 'deviceId', 'locationId']}
	facetLabels={{ result: 'Result', deviceId: 'Device', locationId: 'Location' }}
	dateFilter="Scanned"
	charts
	fileName="Scans"
/>
