<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Save from '@lucide/svelte/icons/save';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import CheckboxComp from '@nahu/admin-kit/formComponents/CheckboxComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { flag as flagCell, link } from '#lib/cells.ts';
	import { flag } from '#lib/status.ts';
	import { groupByArea, permissionsSchema, roleSchema } from '#lib/schemas/admin.ts';

	let { data } = $props();

	const groups = $derived(groupByArea(data.permissions));
	const everyId = $derived(data.permissions.map((p) => p.id));
	const holderCount = $derived(data.holders.length);

	// JSON, because a checklist's value is an array of ids. Leaving with unsaved ticks asks first.
	// svelte-ignore state_referenced_locally
	const { form, enhance, delayed } = createForm(data.permissionsForm, permissionsSchema, {
		dataType: 'json',
		resetForm: false,
		taintedMessage: confirmLeave
	});
	const chosen = $derived($form.permissionIds?.length ?? 0);

	type Holder = (typeof data.holders)[number];
	const holderColumns: ColumnDef<Holder>[] = [
		{ id: 'name', header: 'Name', cell: ({ row }) => link('user', row.original.id, row.original.name) },
		{ id: 'email', accessorKey: 'email', header: 'Email' },
		{ id: 'active', header: 'Status', cell: ({ row }) => flagCell(row.original.isActive, 'Active', 'Switched off') }
	];
</script>

<PageHeader title={data.role.name} eyebrow="Role" description={data.role.description ?? undefined}>
	{#snippet badges()}
		<Statuses {...flag(data.role.isActive)} />
	{/snippet}
	{#snippet actions()}
		<FormDialog title="Edit role" action="?/edit" data={data.editForm} schema={roleSchema}>
			{#snippet fields({ form, errors })}
				{#if data.isOwner}
					<InputComp name="name" type="hidden" {form} {errors} />
					<InputComp name="status" type="hidden" {form} {errors} />
					<p class="px-1 text-sm text-muted-foreground">The Owner role keeps its name and is always on.</p>
				{:else}
					<InputComp label="Name" name="name" {form} {errors} required />
				{/if}
				<InputComp label="What it is for" name="description" type="textarea" rows={3} {form} {errors} />
				{#if !data.isOwner}
					<InputComp
						label="Active"
						name="status"
						type="checkboxSingle"
						placeholder="Offered when adding staff"
						description="A switched-off role confers nothing on the people who hold it."
						{form}
						{errors}
					/>
				{/if}
			{/snippet}
		</FormDialog>
		<DeleteEntity entity="role" name={data.role.name} canDelete={data.canDelete && !data.isOwner && holderCount === 0} />
	{/snippet}
</PageHeader>

<div class="mt-6 grid grid-cols-1 gap-6">
	<PageSection
		title="Who holds this role"
		hint={holderCount ? `${holderCount} ${holderCount === 1 ? 'person' : 'people'} — a role can be deleted only when nobody holds it` : undefined}
	>
		{#if holderCount}
			<DataTable variant="compact" columns={holderColumns} data={data.holders} />
		{:else}
			<Empty message="Nobody holds this role yet — give it to someone in Staff & users." />
		{/if}
	</PageSection>

	<PageSection
		title="What this role may do"
		hint={data.isOwner ? `Every one of the ${data.permissions.length} permissions` : `${chosen} of ${data.permissions.length} permissions`}
	>
		{#if data.isOwner}
			<Notice tone="info" icon={ShieldCheck}>
				The Owner always holds every permission, including ones added in later releases, so nobody can lock the
				business out of its own system.
			</Notice>
			<div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
				{#each groups as group (group.area)}
					<div class="grid grid-cols-1 content-start gap-2 rounded-md border p-3">
						<h3 class="text-sm font-semibold">{group.area}</h3>
						<CheckboxComp
							id="owner-{group.area}"
							selectAll={false}
							items={group.items.map((p) => ({ value: p.id, name: p.description ?? p.name, disabled: true }))}
							checkedValues={everyId}
						/>
					</div>
				{/each}
			</div>
		{:else}
			<form method="POST" action="?/permissions" use:enhance class="grid grid-cols-1 gap-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					{#each groups as group (group.area)}
						<div class="grid grid-cols-1 content-start gap-2 rounded-md border p-3">
							<h3 class="text-sm font-semibold">{group.area}</h3>
							<CheckboxComp
								id="grant-{group.area}"
								items={group.items.map((p) => ({ value: p.id, name: p.description ?? p.name }))}
								bind:checkedValues={
									() => $form.permissionIds as number[],
									(v) => ($form.permissionIds = (v ?? []).map(Number))
								}
							/>
						</div>
					{/each}
				</div>
				<div class="sticky bottom-2 flex justify-end">
					<Button type="submit" disabled={$delayed} class="shadow-md">
						{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save permissions{/if}
					</Button>
				</div>
			</form>
		{/if}
	</PageSection>
</div>
