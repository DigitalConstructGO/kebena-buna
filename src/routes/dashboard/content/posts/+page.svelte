<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import LookupFileCell from '@nahu/admin-kit/components/lookup/LookupFileCell.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { dateTime, link, sortable, status, user } from '#lib/cells.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'cover',
			header: '',
			cell: ({ row }) =>
				row.original.coverImage
					? renderComponent(LookupFileCell, { name: row.original.coverImage, image: true })
					: ''
		},
		{
			id: 'title',
			accessorKey: 'title',
			header: sortable('Post'),
			cell: ({ row }) => link('post', row.original.id, row.original.title)
		},
		{ id: 'categoryId', header: 'Category', cell: ({ row }) => row.original.category ?? '—' },
		{
			id: 'author',
			header: 'Author',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => user(row.original.authorId, row.original.author)
		},
		{
			id: 'minutes',
			header: 'Read',
			meta: { align: 'right', class: 'hidden md:table-cell' },
			cell: ({ row }) => (row.original.minutes ? `${row.original.minutes} min` : '—')
		},
		{
			id: 'publishStatus',
			header: 'Status',
			cell: ({ row }) => status(row.original.publishStatus)
		},
		{
			id: 'publishedAt',
			accessorKey: 'publishedAt',
			header: sortable('Published'),
			cell: ({ row }) => dateTime(row.original.publishedAt)
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
	title="Posts"
	description="The blog: stories, origin trips, events and coffee know-how, in English and Amharic."
>
	{#snippet actions()}
		<Button href="/dashboard/content/posts/new"><Plus class="size-4" /> New post</Button>
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('post', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['categoryId', 'publishStatus']}
	facetLabels={{ categoryId: 'Category', publishStatus: 'Status' }}
	dateFilter="Published"
	charts
	fileName="Posts"
/>
