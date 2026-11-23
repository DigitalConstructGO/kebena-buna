<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { dateTime, link, percent, sortable, status } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'title',
			accessorKey: 'title',
			header: sortable('Event'),
			cell: ({ row }) => link('event', row.original.id, row.original.title)
		},
		{
			id: 'startsAt',
			accessorKey: 'startsAt',
			header: sortable('Starts'),
			cell: ({ row }) => dateTime(row.original.startsAt)
		},
		{
			id: 'locationId',
			header: 'Location',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => link('location', row.original.locationId, row.original.location)
		},
		{
			id: 'visibility',
			header: 'For',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => humanize(row.original.visibility)
		},
		{
			id: 'price',
			header: 'Price',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => (row.original.isFree ? 'Free' : 'Paid')
		},
		{
			id: 'registered',
			accessorKey: 'registered',
			header: sortable('Registered'),
			meta: { align: 'right' },
			cell: ({ row }) => `${row.original.registered} / ${row.original.capacity}`
		},
		{
			id: 'full',
			accessorKey: 'full',
			header: sortable('Full'),
			meta: { align: 'right' },
			cell: ({ row }) => percent(row.original.full)
		},
		{ id: 'publishStatus', header: 'Status', cell: ({ row }) => status(row.original.publishStatus) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Events"
	description="Talks, tastings and exhibitions. Every event takes registrations; a paid one sells its own ticket types."
>
	{#snippet actions()}
		{#if data.canManage}
			<Button href="/dashboard/visits/events/new"><Plus class="size-4" /> New event</Button>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('event', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['publishStatus', 'visibility', 'locationId']}
	facetLabels={{ publishStatus: 'Status', visibility: 'For', locationId: 'Location' }}
	dateFilter="Starts"
	fileName="Events"
/>
