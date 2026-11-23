<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import type { LookupRow } from '@nahu/admin-kit/components/lookup/types';
	import { flag } from '#lib/cells.ts';
	import { knowledgeEditSchema, knowledgeSchema } from '#lib/schemas/content.ts';

	let { data } = $props();

	const extraColumns: ColumnDef<LookupRow>[] = [
		{ id: 'tagList', accessorKey: 'tagList', header: 'Tags' },
		{ id: 'publicFaq', accessorKey: 'publicFaq', header: 'Shown', cell: ({ row }) => flag(Boolean(row.original.isPublicFaq), 'On the FAQ page', 'Agent only') },
		{ id: 'embedded', accessorKey: 'embedded', header: 'AI index', cell: ({ row }) => flag(Boolean(row.original.embeddingUpdatedAt), 'Embedded', 'Needs embedding') }
	];
</script>

<PageHeader
	title="Knowledge base"
	description="What the AI agent answers from, in both languages — hours, tickets, delivery, refunds, memberships. Ticked entries also appear on the public FAQ page. Live facts (stock, prices, order status) are read from their own records, not written here."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: knowledgeSchema, edit: knowledgeEditSchema }}
	table={{
		facetKeys: ['topic', 'publicFaq', 'embedded'],
		facetLabels: { topic: 'Topic', publicFaq: 'Shown', embedded: 'AI index' },
		charts: true
	}}
	config={{
		entity: 'Entry',
		plural: 'Knowledge base',
		extraColumns,
		fields: [
			{ name: 'questionEn', label: 'Question (English)', type: 'textarea', rows: 2, long: 50 },
			{ name: 'questionAm', label: 'Question (Amharic)', type: 'textarea', rows: 2, required: false, inTable: false },
			{ name: 'questionOm', label: 'Question (Afaan Oromo)', type: 'textarea', rows: 2, required: false, inTable: false },
			{ name: 'questionAr', label: 'Question (Arabic)', type: 'textarea', rows: 2, required: false, inTable: false },
			{ name: 'questionIt', label: 'Question (Italian)', type: 'textarea', rows: 2, required: false, inTable: false },
			{ name: 'questionFr', label: 'Question (French)', type: 'textarea', rows: 2, required: false, inTable: false },
			{ name: 'answerEn', label: 'Answer (English)', type: 'textarea', rows: 5, long: 40 },
			{ name: 'answerAm', label: 'Answer (Amharic)', type: 'textarea', rows: 5, required: false, inTable: false },
			{ name: 'answerOm', label: 'Answer (Afaan Oromo)', type: 'textarea', rows: 5, required: false, inTable: false },
			{ name: 'answerAr', label: 'Answer (Arabic)', type: 'textarea', rows: 5, required: false, inTable: false },
			{ name: 'answerIt', label: 'Answer (Italian)', type: 'textarea', rows: 5, required: false, inTable: false },
			{ name: 'answerFr', label: 'Answer (French)', type: 'textarea', rows: 5, required: false, inTable: false },
			{ name: 'topic', label: 'Topic', type: 'text', placeholder: 'hours, tickets, delivery…' },
			{ name: 'tags', label: 'Tags (one per line)', type: 'textarea', rows: 3, required: false, inTable: false },
			{ name: 'isPublicFaq', label: 'Public FAQ', type: 'checkbox', trueLabel: 'On the FAQ page', falseLabel: 'Agent only', inTable: false },
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
