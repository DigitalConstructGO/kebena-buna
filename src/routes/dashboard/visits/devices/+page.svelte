<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import Ban from '@lucide/svelte/icons/ban';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import RowButton from '@nahu/admin-kit/components/RowButton.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import Copy from '@nahu/admin-kit/Copy.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { dateTime, flag, link, user } from '#lib/cells.ts';
	import { deviceEditSchema, deviceSchema } from '#lib/schemas/visits.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	let addOpen = $state(false);
	/** The token of the device just added: shown here once, never again. */
	let issued = $state<{ device: string; token: string } | null>(null);
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.addForm, deviceSchema, {
		resetForm: true,
		onUpdated({ form: f }) {
			const m = f.message as { type: string; token?: string; device?: string } | undefined;
			if (m?.type === 'success' && m.token) {
				issued = { device: m.device ?? '', token: m.token };
				addOpen = false;
			}
		}
	});

	let editOpen = $state(false);
	let editSeed = $state<{ id: number; name: string; locationId: number | null; isActive: boolean }>();
	function edit(r: Row) {
		editSeed = { id: r.id, name: r.name, locationId: r.locationId, isActive: r.isActive };
		editOpen = true;
	}

	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			header: 'Device',
			cell: ({ row }) =>
				data.canManage ? renderComponent(RowButton, { label: row.original.name, onclick: () => edit(row.original) }) : row.original.name
		},
		{ id: 'location', header: 'Location', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'lastSyncAt', header: 'Last sync', cell: ({ row }) => dateTime(row.original.lastSyncAt) },
		{ id: 'scans', header: 'Scans', meta: { align: 'right' }, cell: ({ row }) => row.original.scans },
		{ id: 'createdBy', header: 'Added by', meta: { class: 'hidden md:table-cell' }, cell: ({ row }) => user(row.original.createdById, row.original.createdBy) },
		{ id: 'isActive', header: 'Status', cell: ({ row }) => flag(row.original.isActive, 'Active', 'Revoked') },
		{
			id: 'revoke',
			header: '',
			cell: ({ row }) =>
				data.canManage && row.original.isActive
					? renderComponent(ConfirmAction, {
							action: '?/revoke',
							label: 'Revoke',
							icon: Ban,
							variant: 'ghost',
							title: `Revoke ${row.original.name}?`,
							description: 'It is switched off and its token stops working at once. Scans it has not synced yet are lost.',
							fields: { id: row.original.id }
						})
					: ''
		}
	];
</script>

<PageHeader
	title="Scanner devices"
	description="The phones and tablets running the offline scanner. Each signs its syncs with its own token."
>
	{#snippet actions()}
		{#if data.canManage}
			<DialogComp bind:open={addOpen} title="New scanner device" variant="default">
				{#snippet trigger(props)}
					<Button {...props}><Plus class="size-4" /> Add device</Button>
				{/snippet}
				<form method="POST" action="?/add" use:enhance class="flex flex-col gap-4 p-4">
					<Errors allErrors={$allErrors} />
					<InputComp label="Name" name="name" placeholder="Gate tablet 3" {form} {errors} required />
					<InputComp label="Location" name="locationId" type="select" items={data.locations} {form} {errors} />
					<Button type="submit" disabled={$delayed}>
						{#if $delayed}<LoadingBtn name="Adding" />{:else}<Plus class="size-4" /> Add device{/if}
					</Button>
				</form>
			</DialogComp>
		{/if}
	{/snippet}
</PageHeader>

{#if issued}
	<Notice tone="warning" title="Token for {issued.device}" class="mt-4">
		<p>Enter it in the scanner app now. It is shown only this once; a lost token means revoking the device and adding it again.</p>
		<div class="mt-2 flex items-center gap-2 font-mono text-sm break-all">
			{issued.token}
			<Copy data={issued.token} />
		</div>
	</Notice>
{/if}

<FormDialog title="Edit device" action="?/edit" data={data.editForm} schema={deviceEditSchema} bind:open={editOpen} seed={editSeed} hideTrigger>
	{#snippet fields({ form: f, errors: e })}
		<InputComp type="hidden" name="id" form={f} errors={e} />
		<InputComp label="Name" name="name" form={f} errors={e} required />
		<InputComp label="Location" name="locationId" type="select" items={data.locations} form={f} errors={e} />
		<InputComp label="Active" name="isActive" type="checkboxSingle" placeholder="May sync scans" form={f} errors={e} />
	{/snippet}
</FormDialog>

<div class="mt-4">
	<DataTable {columns} data={data.rows} fileName="Scanner devices" />
</div>
