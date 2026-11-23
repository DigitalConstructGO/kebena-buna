<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import type { LookupRow } from '@nahu/admin-kit/components/lookup/types';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import Copy from '@nahu/admin-kit/Copy.svelte';
	import { fileUrl } from '@nahu/admin-kit/files';
	import { dateTime, user } from '#lib/cells.ts';
	import { mediaEditSchema, mediaSchema } from '#lib/schemas/content.ts';

	let { data } = $props();

	const size = (bytes: number) =>
		!bytes
			? '—'
			: bytes < 1024 * 1024
				? `${Math.round(bytes / 1024)} KB`
				: `${(bytes / 1024 / 1024).toFixed(1)} MB`;

	const extraColumns: ColumnDef<LookupRow>[] = [
		{ id: 'folderName', accessorKey: 'folderName', header: 'Folder' },
		{ id: 'mimeType', accessorKey: 'mimeType', header: 'Type' },
		{
			id: 'size',
			header: 'Size',
			meta: { align: 'right' },
			cell: ({ row }) => size(Number(row.original.sizeBytes))
		},
		{
			id: 'url',
			header: 'Address',
			cell: ({ row }) => renderComponent(Copy, { data: fileUrl(String(row.original.fileName)) })
		},
		{
			id: 'uploader',
			header: 'Uploaded by',
			cell: ({ row }) =>
				user(row.original.createdBy as string | null, row.original.uploader as string | null)
		},
		{
			id: 'createdAt',
			header: 'Uploaded',
			cell: ({ row }) => dateTime(row.original.createdAt as string)
		}
	];
</script>

<PageHeader
	title="Media library"
	description="Pictures and documents for the website. Pictures dropped into a page or post land here too, in the editor folder."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: mediaSchema, edit: mediaEditSchema }}
	table={{
		facetKeys: ['folderName', 'mimeType'],
		facetLabels: { folderName: 'Folder', mimeType: 'Type' }
	}}
	config={{
		entity: 'File',
		plural: 'Media',
		extraColumns,
		fields: [
			{ name: 'altEn', label: 'Alt text (English)', type: 'text', required: false, long: 30 },
			{ name: 'fileName', label: 'File', type: 'image' },
			{ name: 'altAm', label: 'Alt text (Amharic)', type: 'text', required: false, inTable: false },
			{
				name: 'altOm',
				label: 'Alt text (Afaan Oromo)',
				type: 'text',
				required: false,
				inTable: false
			},
			{ name: 'altAr', label: 'Alt text (Arabic)', type: 'text', required: false, inTable: false },
			{ name: 'altIt', label: 'Alt text (Italian)', type: 'text', required: false, inTable: false },
			{ name: 'altFr', label: 'Alt text (French)', type: 'text', required: false, inTable: false },
			{
				name: 'captionEn',
				label: 'Caption (English)',
				type: 'textarea',
				rows: 2,
				required: false,
				inTable: false
			},
			{
				name: 'captionAm',
				label: 'Caption (Amharic)',
				type: 'textarea',
				rows: 2,
				required: false,
				inTable: false
			},
			{
				name: 'captionOm',
				label: 'Caption (Afaan Oromo)',
				type: 'textarea',
				rows: 2,
				required: false,
				inTable: false
			},
			{
				name: 'captionAr',
				label: 'Caption (Arabic)',
				type: 'textarea',
				rows: 2,
				required: false,
				inTable: false
			},
			{
				name: 'captionIt',
				label: 'Caption (Italian)',
				type: 'textarea',
				rows: 2,
				required: false,
				inTable: false
			},
			{
				name: 'captionFr',
				label: 'Caption (French)',
				type: 'textarea',
				rows: 2,
				required: false,
				inTable: false
			},
			{ name: 'folder', label: 'Folder', type: 'text', required: false, inTable: false },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
