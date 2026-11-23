<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { flag, link, longText, sortable } from '#lib/cells.ts';
	import { roleSchema } from '#lib/schemas/admin.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			accessorKey: 'name',
			header: sortable('Role'),
			cell: ({ row }) => link('role', row.original.id, row.original.name)
		},
		{ id: 'description', header: 'What it is for', cell: ({ row }) => longText(row.original.description, 60) },
		{ id: 'holders', accessorKey: 'holders', header: sortable('People'), meta: { align: 'right' } },
		{ id: 'grants', accessorKey: 'grants', header: sortable('Permissions'), meta: { align: 'right' } },
		{ id: 'status', header: 'Status', cell: ({ row }) => flag(row.original.isActive) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Roles"
	eyebrow="Admin"
	description="What each kind of staff member may open and change. Open a role to tick its permissions."
>
	{#snippet actions()}
		<FormDialog title="New role" action="?/add" data={data.addForm} schema={roleSchema} triggerLabel="New role" triggerVariant="default" triggerIcon={Plus} submitIcon={Plus} resetOnSuccess>
			{#snippet fields({ form, errors })}
				<InputComp label="Name" name="name" {form} {errors} required />
				<InputComp label="What it is for" name="description" type="textarea" rows={3} {form} {errors} />
				<InputComp label="Active" name="status" type="checkboxSingle" placeholder="Offered when adding staff" {form} {errors} />
			{/snippet}
		</FormDialog>
	{/snippet}
</PageHeader>

<div class="mt-4">
	<DataTable rowHref={(row) => href('role', row.id)} {columns} data={data.rows} fileName="Roles" />
</div>
