<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import { amount, flag, link, percent, sortable, status } from '#lib/cells.ts';
	import { membershipPlanSchema } from '#lib/schemas/memberships.ts';
	import PlanFields from './PlanFields.svelte';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			accessorKey: 'name',
			header: sortable('Plan'),
			cell: ({ row }) => link('membershipPlan', row.original.id, row.original.name)
		},
		{ id: 'code', accessorKey: 'code', header: 'Code' },
		{
			id: 'price',
			accessorKey: 'price',
			header: sortable('Price (ETB)'),
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.price)
		},
		{
			id: 'months',
			header: 'Months',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.durationMonths
		},
		{
			id: 'people',
			header: 'Covers',
			cell: ({ row }) =>
				`${row.original.maxAdults} adult(s), ${row.original.maxChildren} child(ren)`
		},
		{
			id: 'discount',
			header: 'Shop discount',
			meta: { align: 'right' },
			cell: ({ row }) => percent(row.original.shopDiscountPct)
		},
		{
			id: 'active',
			accessorKey: 'active',
			header: sortable('Active members'),
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
	title="Membership plans"
	description="Individual, Family, Student, Patron — what each costs and what it gives."
>
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog
				title="New plan"
				triggerLabel="New plan"
				triggerVariant="default"
				triggerIcon={Plus}
				submitIcon={Plus}
				action="?/add"
				data={data.form}
				schema={membershipPlanSchema}
				multipart
			>
				{#snippet fields({ form, errors })}
					<PlanFields form={form as never} errors={errors as never} options={data.options} />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('membershipPlan', row.id)}
	{columns}
	data={data.rows}
	fileName="Membership plans"
/>
