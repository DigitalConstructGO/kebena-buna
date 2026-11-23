<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import { flag, link, sortable } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { locationSchema } from '#lib/schemas/admin.ts';
	import LocationFields from './LocationFields.svelte';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const does = (r: Row) =>
		[
			r.holdsStock && 'stock',
			r.sellsAtDesk && 'desk sales',
			r.fulfilsOnline && 'online orders',
			r.isPickupPoint && 'pickup',
			r.admitsVisitors && 'visitors'
		]
			.filter(Boolean)
			.join(', ') || '—';

	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			accessorKey: 'name',
			header: sortable('Location'),
			cell: ({ row }) => link('location', row.original.id, row.original.name)
		},
		{ id: 'code', accessorKey: 'code', header: sortable('Code') },
		{ id: 'type', accessorFn: (r) => humanize(r.type), header: 'Type' },
		{
			id: 'parent',
			header: 'Inside',
			cell: ({ row }) => link('location', row.original.parentId, row.original.parent)
		},
		{ id: 'does', header: 'Handles', cell: ({ row }) => does(row.original) },
		{
			id: 'status',
			accessorFn: (r) => (r.isActive ? 'Active' : 'Inactive'),
			header: 'Status',
			cell: ({ row }) => flag(row.original.isActive)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Locations"
	eyebrow="Admin"
	description="Site A, Site B, the shop, café, roastery and warehouse. A second shop, or splitting tickets per site, is a new row here."
>
	{#snippet actions()}
		<FormDialog
			title="New location"
			action="?/add"
			data={data.addForm}
			schema={locationSchema}
			triggerLabel="New location"
			triggerVariant="default"
			triggerIcon={Plus}
			submitIcon={Plus}
		>
			{#snippet fields({ form, errors })}
				<LocationFields form={form as never} errors={errors as never} parents={data.parents} />
			{/snippet}
		</FormDialog>
	{/snippet}
</PageHeader>

<div class="mt-4">
	<DataTable
		rowHref={(row) => href('location', row.id)}
		{columns}
		data={data.rows}
		facetKeys={['type', 'status']}
		facetLabels={{ type: 'Type', status: 'Status' }}
		fileName="Locations"
	/>
</div>
