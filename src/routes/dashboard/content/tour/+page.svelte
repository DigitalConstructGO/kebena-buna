<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import LookupFileCell from '@nahu/admin-kit/components/lookup/LookupFileCell.svelte';
	import { flag, link, sortable, user } from '#lib/cells.ts';
	import { sceneSchema } from '#lib/schemas/content.ts';
	import SceneFields from './SceneFields.svelte';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'preview',
			header: '',
			cell: ({ row }) =>
				renderComponent(LookupFileCell, { name: row.original.preview ?? row.original.panorama, image: true })
		},
		{ id: 'title', accessorKey: 'title', header: sortable('Scene'), cell: ({ row }) => link('scene', row.original.id, row.original.title) },
		{ id: 'location', accessorKey: 'location', header: 'Site', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'isStart', header: 'Start', cell: ({ row }) => (row.original.isStart ? flag(true, 'Start scene') : '') },
		{ id: 'hotspots', accessorKey: 'hotspots', header: sortable('Hotspots'), meta: { align: 'right' } },
		{ id: 'sortOrder', accessorKey: 'sortOrder', header: sortable('Order'), meta: { align: 'right' } },
		{ id: 'createdBy', header: 'Added by', meta: { class: 'hidden md:table-cell' }, cell: ({ row }) => user(row.original.createdById, row.original.createdBy) },
		{ id: 'isActive', header: 'Status', cell: ({ row }) => flag(row.original.isActive) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Virtual tour"
	description="The 360° scenes of the museum. Open a scene to place its hotspots — products, lots, stations, bookings, events or the next scene."
>
	{#snippet actions()}
		<FormDialog
			title="New scene"
			triggerLabel="New scene" triggerVariant="default" triggerIcon={Plus} submitIcon={Plus}
			action="?/add"
			data={data.addForm}
			schema={sceneSchema}
			multipart
			resetOnSuccess
		>
			{#snippet fields({ form, errors })}
				<SceneFields {form} {errors} locations={data.locations} />
			{/snippet}
		</FormDialog>
	{/snippet}
</PageHeader>

<DataTable rowHref={(row) => href('scene', row.id)} {columns} data={data.rows} facetKeys={['location']} facetLabels={{ location: 'Site' }} fileName="Tour scenes" />
