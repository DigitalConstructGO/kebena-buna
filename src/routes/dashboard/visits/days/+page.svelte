<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { flag, link, percent, sortable } from '#lib/cells.ts';
	import { formatDate } from '#lib/format.ts';
	import { generateDaysSchema } from '#lib/schemas/visits.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const weekday = (iso: string) =>
		new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });

	const columns: ColumnDef<Row>[] = [
		{
			id: 'date',
			accessorKey: 'date',
			header: sortable('Date'),
			cell: ({ row }) =>
				link(
					'visitDay',
					row.original.id,
					`${weekday(row.original.date)} ${formatDate(row.original.date)}${row.original.date === data.today ? ' (today)' : ''}`
				)
		},
		{
			id: 'locationId',
			header: 'Location',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => link('location', row.original.locationId, row.original.location)
		},
		{
			id: 'capacity',
			header: 'Capacity',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.capacity
		},
		{ id: 'sold', accessorKey: 'sold', header: sortable('Sold'), meta: { align: 'right' } },
		{
			id: 'held',
			accessorKey: 'held',
			header: sortable('Held'),
			meta: { align: 'right', class: 'hidden md:table-cell' }
		},
		{
			id: 'full',
			accessorKey: 'full',
			header: sortable('Full'),
			meta: { align: 'right' },
			cell: ({ row }) => percent(row.original.full)
		},
		{
			id: 'slots',
			header: 'Slots',
			meta: { align: 'right', class: 'hidden lg:table-cell' },
			cell: ({ row }) =>
				row.original.closedSlots
					? `${row.original.slots} (${row.original.closedSlots} closed)`
					: row.original.slots
		},
		{
			id: 'open',
			header: 'Status',
			cell: ({ row }) => flag(!row.original.isClosed, 'Open', 'Closed')
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Visit days"
	description="Each day's timed-entry capacity at the museum: places sold, held for unpaid groups, and how full it is."
>
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog
				title="Generate visit days"
				description="Builds days and their slots from the slot pattern. Days that exist are left as they are; closed weekdays and closure dates are skipped."
				triggerLabel="Generate days"
				submitLabel="Generate"
				action="?/generate"
				data={data.generateForm}
				schema={generateDaysSchema}
			>
				{#snippet fields({ form, errors })}
					<InputComp label="From" name="from" type="date" futureDays {form} {errors} required />
					<InputComp
						label="Number of days"
						name="days"
						type="number"
						min={1}
						max={120}
						{form}
						{errors}
						required
					/>
					<InputComp
						label="Day capacity"
						name="dayCapacity"
						type="number"
						min={1}
						description="The cap across all of a day's slots."
						{form}
						{errors}
						required
					/>
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('visitDay', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['locationId', 'open']}
	facetLabels={{ locationId: 'Location', open: 'Status' }}
	dateFilter="Date"
	fileName="Visit days"
/>
