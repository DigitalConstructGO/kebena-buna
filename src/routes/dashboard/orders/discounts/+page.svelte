<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import { amount, date, flag, link, sortable, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { discountSchema } from '#lib/schemas/orders.ts';
	import DiscountFields from './DiscountFields.svelte';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];
	const now = new Date();
	const expired = (row: Row) => !!row.expiresAt && new Date(row.expiresAt) < now;
	const usedUp = (row: Row) => !!row.usageLimit && row.usedCount >= row.usageLimit;

	const columns: ColumnDef<Row>[] = [
		{
			id: 'code',
			accessorKey: 'code',
			header: sortable('Code'),
			cell: ({ row }) => link('discount', row.original.id, row.original.code)
		},
		{
			id: 'value',
			header: 'Discount',
			cell: ({ row }) =>
				row.original.kind === 'percent'
					? `${Number(row.original.value)}%`
					: `ETB ${amount(row.original.value)}`
		},
		{
			id: 'appliesTo',
			header: 'Applies to',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => row.original.appliesTo?.map(humanize).join(', ') || 'Everything'
		},
		{
			id: 'starts',
			header: 'From',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => date(row.original.startsAt)
		},
		{ id: 'expires', header: 'Until', cell: ({ row }) => date(row.original.expiresAt) },
		{
			id: 'used',
			accessorKey: 'usedCount',
			header: sortable('Used'),
			meta: { align: 'right' },
			cell: ({ row }) =>
				`${row.original.usedCount}${row.original.usageLimit ? ` / ${row.original.usageLimit}` : ''}`
		},
		{
			id: 'given',
			header: 'Given (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.given)
		},
		{
			id: 'createdBy',
			header: 'Made by',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => user(row.original.createdById, row.original.createdBy)
		},
		{
			id: 'state',
			header: 'Status',
			cell: ({ row }) =>
				expired(row.original)
					? flag(false, '', 'Expired')
					: usedUp(row.original)
						? flag(false, '', 'Used up')
						: flag(row.original.isActive)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Discount codes"
	description="Percent or birr off, with a window, limits and what they apply to."
>
	{#snippet actions()}
		<FormDialog
			title="New discount code"
			triggerLabel="New code"
			triggerVariant="default"
			triggerIcon={Plus}
			submitIcon={Plus}
			action="?/add"
			data={data.addForm}
			schema={discountSchema}
			dataType="json"
			resetOnSuccess
		>
			{#snippet fields({ form, errors })}
				<DiscountFields form={form as never} errors={errors as never} />
			{/snippet}
		</FormDialog>
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('discount', row.id)}
	{columns}
	data={data.rows}
	fileName="Discount codes"
/>
