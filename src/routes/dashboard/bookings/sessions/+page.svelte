<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { dateTime, link, longText, sortable, status } from '#lib/cells.ts';
	import { localClock } from '@nahu/admin-kit/time';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{ id: 'startsAt', accessorKey: 'startsAt', header: sortable('When'), cell: ({ row }) => link('session', row.original.id, dateTime(row.original.startsAt)) },
		{ id: 'bookableId', header: 'What', cell: ({ row }) => link('bookable', row.original.bookableId, row.original.bookable) },
		{ id: 'ends', header: 'Until', meta: { class: 'hidden md:table-cell' }, cell: ({ row }) => localClock(row.original.endsAt) },
		{ id: 'language', header: 'Language', cell: ({ row }) => row.original.language ?? '—' },
		{ id: 'booked', accessorKey: 'booked', header: sortable('Booked'), meta: { align: 'right' }, cell: ({ row }) => `${row.original.booked} / ${row.original.capacity}` },
		{ id: 'free', accessorKey: 'free', header: sortable('Free'), meta: { align: 'right' } },
		{ id: 'staff', header: 'Staff', meta: { class: 'hidden lg:table-cell' }, cell: ({ row }) => longText(row.original.staff, 30) },
		{ id: 'state', header: 'Status', cell: ({ row }) => status(row.original.state === 'upcoming' ? 'scheduled' : row.original.state === 'past' ? 'done' : 'cancelled', row.original.state) }
	];
	const href = useLinks();
</script>

<PageHeader title="Sessions" description="Each run of a tour, ceremony or cupping, with its places and its guide. Upcoming first." />

<DataTable
	rowHref={(row) => href('session', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['bookableId', 'state', 'language']}
	facetLabels={{ bookableId: 'What', state: 'When', language: 'Language' }}
	dateFilter="Date"
	rowClass={(row) => (row.free <= 0 && row.state === 'upcoming' ? 'bg-warning/10' : null)}
	fileName="Sessions"
/>
