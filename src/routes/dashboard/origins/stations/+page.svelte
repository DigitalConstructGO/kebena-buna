<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import { flag, kg, link, sortable, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { stationSchema } from '#lib/schemas/origins.ts';
	import StationFields from './StationFields.svelte';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'code',
			accessorKey: 'code',
			header: sortable('Code'),
			cell: ({ row }) => link('station', row.original.id, row.original.code)
		},
		{ id: 'name', accessorKey: 'name', header: sortable('Name') },
		{ id: 'type', header: 'Type', cell: ({ row }) => humanize(row.original.type) },
		{
			id: 'regionId',
			header: 'Region',
			cell: ({ row }) => link('region', row.original.regionId, row.original.region)
		},
		{
			id: 'altitude',
			header: 'Altitude',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) =>
				row.original.altitudeMinM
					? `${row.original.altitudeMinM}–${row.original.altitudeMaxM ?? '?'} m`
					: '—'
		},
		{
			id: 'farmerCount',
			accessorKey: 'farmerCount',
			header: sortable('Farmers'),
			meta: { align: 'right', class: 'hidden md:table-cell' },
			cell: ({ row }) => row.original.farmerCount?.toLocaleString('en-US') ?? '—'
		},
		{
			id: 'lots',
			accessorKey: 'lots',
			header: sortable('Lots'),
			meta: { align: 'right' }
		},
		{
			id: 'greenKg',
			accessorKey: 'greenKg',
			header: sortable('Green on hand'),
			meta: { align: 'right' },
			cell: ({ row }) => kg(row.original.greenKg)
		},
		{
			id: 'createdBy',
			header: 'Added by',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => user(row.original.createdById, row.original.createdBy)
		},
		{ id: 'isActive', header: 'Status', cell: ({ row }) => flag(row.original.isActive) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Stations & farms"
	description="Washing stations, dry mills and farms. A station's code starts every lot code it supplies."
>
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog
				title="New station"
				action="?/add"
				data={data.addForm}
				schema={stationSchema}
				dataType="json"
				triggerLabel="New station"
				triggerVariant="default"
				triggerIcon={Plus}
				submitIcon={Plus}
			>
				{#snippet fields({ form, errors })}
					<StationFields form={form as never} errors={errors as never} options={data.options} />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('station', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['type', 'regionId']}
	facetLabels={{ type: 'Type', regionId: 'Region' }}
	charts
	fileName="Stations"
/>
