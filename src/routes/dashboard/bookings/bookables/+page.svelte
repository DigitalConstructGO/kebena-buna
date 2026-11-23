<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import { flag, link, sortable, status } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { bookableSchema } from '#lib/schemas/bookings.ts';
	import BookableFields from './BookableFields.svelte';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			accessorKey: 'name',
			header: sortable('Name'),
			cell: ({ row }) => link('bookable', row.original.id, row.original.name)
		},
		{
			id: 'kind',
			accessorKey: 'kind',
			header: 'Kind',
			cell: ({ row }) => humanize(row.original.kind)
		},
		{
			id: 'location',
			header: 'Where',
			cell: ({ row }) => link('location', row.original.locationId, row.original.location)
		},
		{
			id: 'duration',
			header: 'Minutes',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.durationMin
		},
		{
			id: 'pricing',
			accessorKey: 'pricing',
			header: 'Priced',
			cell: ({ row }) => humanize(row.original.pricing)
		},
		{
			id: 'mode',
			header: 'Booked by',
			cell: ({ row }) => (row.original.isEnquiryOnly ? 'Enquiry' : 'Session')
		},
		{
			id: 'upcoming',
			accessorKey: 'upcoming',
			header: sortable('Upcoming sessions'),
			meta: { align: 'right' }
		},
		{
			id: 'open',
			accessorKey: 'open',
			header: sortable('Open bookings'),
			meta: { align: 'right' }
		},
		{
			id: 'publishStatus',
			header: 'Website',
			cell: ({ row }) => status(row.original.publishStatus)
		},
		{ id: 'isActive', header: 'Status', cell: ({ row }) => flag(row.original.isActive) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="What can be booked"
	description="Tours, ceremonies, cuppings, private hire and school visits — their prices, weekly times and sessions."
>
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog
				title="New bookable"
				triggerLabel="New bookable"
				triggerVariant="default"
				triggerIcon={Plus}
				submitIcon={Plus}
				action="?/add"
				data={data.form}
				schema={bookableSchema}
				dataType="json"
			>
				{#snippet fields({ form, errors })}
					<BookableFields form={form as never} errors={errors as never} options={data.options} />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('bookable', row.id)}
	{columns}
	data={data.rows}
	facetKeys={['kind', 'pricing']}
	facetLabels={{ kind: 'Kind', pricing: 'Priced' }}
	fileName="Bookables"
/>
