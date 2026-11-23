<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { dateTime, flag, link, phone, sortable } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { addUserSchema } from '#lib/schemas/admin.ts';
	import PasswordField from './PasswordField.svelte';
	import Credentials from './Credentials.svelte';
	import { useLinks } from '#lib/links.ts';

	let { data, form: answer } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			accessorKey: 'name',
			header: sortable('Name'),
			cell: ({ row }) => link('user', row.original.id, row.original.name)
		},
		{ id: 'email', accessorKey: 'email', header: sortable('Email') },
		{
			id: 'phone',
			header: 'Phone',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => phone(row.original.phone)
		},
		{
			id: 'kind',
			accessorKey: 'kind',
			header: 'Kind',
			cell: ({ row }) => humanize(row.original.kind)
		},
		{
			id: 'role',
			accessorFn: (r) => r.role ?? '—',
			header: sortable('Role'),
			cell: ({ row }) => link('role', row.original.roleId, row.original.role)
		},
		{
			id: 'active',
			accessorFn: (r) => (r.isActive ? 'Active' : 'Switched off'),
			header: 'Status',
			cell: ({ row }) => flag(row.original.isActive, 'Active', 'Switched off')
		},
		{
			id: 'lastSeen',
			accessorKey: 'lastSeen',
			header: sortable('Last seen'),
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => dateTime(row.original.lastSeen)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Staff & users"
	eyebrow="Admin"
	description="Everyone who can sign in. A staff member's role decides what they may open and change; customers hold no permissions."
>
	{#snippet actions()}
		<FormDialog
			title="New staff member"
			description="Give them their password in person; they can change it under My account."
			action="?/add"
			data={data.addForm}
			schema={addUserSchema}
			triggerLabel="New staff member"
			triggerVariant="default"
			triggerIcon={Plus}
			submitIcon={Plus}
			submitLabel="Create account"
			resetOnSuccess
		>
			{#snippet fields({ form, errors })}
				<InputComp label="Full name" name="name" {form} {errors} required />
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<InputComp
						label="Email (signs in with)"
						name="email"
						type="email"
						{form}
						{errors}
						required
					/>
					<InputComp label="Phone" name="phone" type="tel" {form} {errors} placeholder="+2519…" />
				</div>
				<InputComp
					label="Role"
					name="roleId"
					type="select"
					items={data.roles}
					{form}
					{errors}
					required
				/>
				<PasswordField form={form as never} errors={errors as never} />
			{/snippet}
		</FormDialog>
	{/snippet}
</PageHeader>

<Credentials credentials={answer?.credentials} />

<div class="mt-4">
	<DataTable
		rowHref={(row) => href('user', row.id)}
		{columns}
		data={data.rows}
		facetKeys={['kind', 'role', 'active']}
		facetLabels={{ kind: 'Kind', role: 'Role', active: 'Status' }}
		charts
		fileName="Users"
	/>
</div>
