<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import { date, flag, link, longText, sortable, status } from '#lib/cells.ts';
	import { amountRange, describeRule, inWindow, weightOf } from '#lib/bundles.ts';
	import { bundleSchema } from '#lib/schemas/catalog.ts';
	import BundleFields from './BundleFields.svelte';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];
	const now = new Date();
	const ended = (row: Row) => !!row.endsAt && new Date(row.endsAt) < now;

	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			accessorKey: 'name',
			header: sortable('Bundle'),
			cell: ({ row }) => link('bundle', row.original.id, row.original.name)
		},
		{
			id: 'contents',
			header: 'What is in it',
			cell: ({ row }) => longText(row.original.text || 'Nothing yet', 40)
		},
		{
			id: 'weight',
			header: 'Coffee',
			meta: { align: 'right', class: 'hidden md:table-cell' },
			cell: ({ row }) => weightOf(row.original.grams)
		},
		{
			id: 'deal',
			header: 'Deal',
			cell: ({ row }) =>
				describeRule({ pricing: row.original.pricing, value: Number(row.original.value) })
		},
		{
			id: 'price',
			header: 'Price (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) =>
				row.original.bags ? amountRange(row.original.priceMin, row.original.priceMax) : '—'
		},
		{
			id: 'saving',
			header: 'Saves (ETB)',
			meta: { align: 'right', class: 'hidden lg:table-cell' },
			cell: ({ row }) =>
				row.original.bags ? amountRange(row.original.savingMin, row.original.savingMax) : '—'
		},
		{
			id: 'starts',
			header: 'From',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => date(row.original.startsAt)
		},
		{
			id: 'ends',
			header: 'Until',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => date(row.original.endsAt)
		},
		{
			id: 'sold',
			accessorKey: 'sold',
			header: sortable('Sold'),
			meta: { align: 'right' },
			cell: ({ row }) => row.original.sold
		},
		{
			id: 'publishStatus',
			header: 'Website',
			cell: ({ row }) => status(row.original.publishStatus)
		},
		{
			id: 'state',
			header: 'Status',
			cell: ({ row }) =>
				ended(row.original)
					? flag(false, '', 'Ended')
					: !inWindow(row.original, now)
						? flag(false, '', 'Not started')
						: row.original.problems.length
							? flag(false, '', 'Needs attention')
							: flag(row.original.isActive)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Bundles"
	description="Several bags at a better price — “any two 1 kg bags, 5% off”, a Limu and Gera pair. Each bag is still sold, roasted and packed as its own size."
>
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog
				title="New bundle"
				triggerLabel="New bundle"
				triggerVariant="default"
				triggerIcon={Plus}
				submitIcon={Plus}
				action="?/add"
				data={data.addForm}
				schema={bundleSchema}
				dataType="json"
			>
				{#snippet fields({ form, errors })}
					<BundleFields form={form as never} errors={errors as never} />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('bundle', row.id)}
	{columns}
	data={data.rows}
	fileName="Bundles"
/>
