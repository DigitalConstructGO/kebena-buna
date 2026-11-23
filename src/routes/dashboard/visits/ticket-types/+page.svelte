<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import { flag, link, sortable } from '#lib/cells.ts';
	import { ticketTypeSchema } from '#lib/schemas/visits.ts';
	import TicketTypeFields from './TicketTypeFields.svelte';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			accessorKey: 'name',
			header: sortable('Ticket type'),
			cell: ({ row }) => link('ticketType', row.original.id, row.original.name)
		},
		{ id: 'code', accessorKey: 'code', header: 'Code' },
		{ id: 'kind', accessorKey: 'kind', header: 'For' },
		{
			id: 'event',
			header: 'Event',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => (row.original.eventId ? link('event', row.original.eventId, row.original.event) : '—')
		},
		{ id: 'prices', accessorKey: 'prices', header: 'Prices (ETB)', cell: ({ row }) => row.original.prices || 'No price set' },
		{
			id: 'admitsPerTicket',
			accessorKey: 'admitsPerTicket',
			header: 'Admits',
			meta: { align: 'right', class: 'hidden lg:table-cell' }
		},
		{
			id: 'sold',
			accessorKey: 'sold',
			header: sortable('Tickets'),
			meta: { align: 'right' }
		},
		{
			id: 'isStaffOnly',
			header: 'Sold by',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => (row.original.isStaffOnly ? 'Staff only' : row.original.isMemberOnly ? 'Members' : 'Everyone')
		},
		{ id: 'isActive', header: 'Status', cell: ({ row }) => flag(row.original.isActive, 'On sale', 'Off sale') }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Ticket types"
	description="What a visitor can buy, and its price for each audience. Event ticket types are also set on their event."
>
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog
				title="New ticket type"
				triggerLabel="New ticket type" triggerVariant="default" triggerIcon={Plus} submitIcon={Plus}
				action="?/add"
				data={data.addForm}
				schema={ticketTypeSchema}
				resetOnSuccess
			>
				{#snippet fields({ form, errors })}
					<TicketTypeFields form={form as never} errors={errors as never} taxRates={data.taxRates} events={data.events} />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<DataTable rowHref={(row) => href('ticketType', row.id)} {columns} data={data.rows} facetKeys={['kind']} facetLabels={{ kind: 'For' }} fileName="Ticket types" />
