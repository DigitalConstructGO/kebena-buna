<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { dateTime, flag, link, sortable, status, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	/** A child's title starts with an arrow, nudged right once per level below the first. */
	const indent = (depth: number) => (depth ? `${'\u00a0\u00a0'.repeat(depth - 1)}↳ ` : '');

	const columns: ColumnDef<Row>[] = [
		{
			id: 'title',
			accessorKey: 'title',
			header: sortable('Page'),
			cell: ({ row }) =>
				link('page', row.original.id, `${indent(row.original.depth)}${row.original.title}`)
		},
		{
			id: 'slug',
			accessorKey: 'slug',
			header: 'Address',
			cell: ({ row }) => `/${row.original.slug}`
		},
		{
			id: 'parent',
			header: 'Parent',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => link('page', row.original.parentId, row.original.parent)
		},
		{
			id: 'template',
			accessorKey: 'template',
			header: 'Template',
			cell: ({ row }) => humanize(row.original.template)
		},
		{
			id: 'showInMenu',
			accessorKey: 'showInMenu',
			header: 'Menu',
			cell: ({ row }) => flag(row.original.showInMenu, 'In menu', 'Hidden')
		},
		{
			id: 'sortOrder',
			accessorKey: 'sortOrder',
			header: sortable('Order'),
			meta: { align: 'right' }
		},
		{
			id: 'minutes',
			accessorKey: 'minutes',
			header: 'Read',
			meta: { align: 'right', class: 'hidden lg:table-cell' },
			cell: ({ row }) => (row.original.minutes ? `${row.original.minutes} min` : '—')
		},
		{
			id: 'publishStatus',
			accessorKey: 'publishStatus',
			header: 'Status',
			cell: ({ row }) => status(row.original.publishStatus)
		},
		{
			id: 'updatedBy',
			header: 'Last changed by',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => user(row.original.updatedById, row.original.updatedBy)
		},
		{
			id: 'updatedAt',
			accessorKey: 'updatedAt',
			header: sortable('Changed'),
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => dateTime(row.original.updatedAt)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Pages"
	description="The website's pages, in both languages. Children are shown under their parent."
>
	{#snippet actions()}
		<Button href="/dashboard/content/pages/new"><Plus class="size-4" /> New page</Button>
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('page', row.id)}
	{columns}
	data={data.rows}
	facetKeys={['publishStatus', 'template']}
	facetLabels={{ publishStatus: 'Status', template: 'Template' }}
	fileName="Pages"
/>
