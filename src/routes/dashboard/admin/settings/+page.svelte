<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import type { LookupRow } from '@nahu/admin-kit/components/lookup/types';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { dateTime, user } from '#lib/cells.ts';
	import { settingSchema } from '#lib/schemas/admin.ts';

	let { data } = $props();

	const extraColumns: ColumnDef<LookupRow>[] = [
		{
			id: 'updatedBy',
			header: 'Changed by',
			cell: ({ row }) => user(row.original.updatedById as string | null, row.original.updatedBy as string | null)
		},
		{ id: 'updatedAt', header: 'Changed', cell: ({ row }) => dateTime(row.original.updatedAt as string | null) }
	];
</script>

<PageHeader
	title="Settings"
	eyebrow="Admin"
	description="Thresholds and numbers the business may change without a new release: free-delivery amount, roast days, low-stock levels, receipt TIN. Values are JSON — 60, &quot;text&quot;, [2, 5]."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: settingSchema }}
	config={{
		entity: 'Setting',
		plural: 'Settings',
		fields: [
			{ name: 'key', label: 'Key', type: 'text', placeholder: 'stock.green_low_kg' },
			{ name: 'value', label: 'Value (JSON)', type: 'textarea', rows: 3, long: 30 },
			{ name: 'description', label: 'What it does', type: 'text', required: false, long: 40 }
		],
		extraColumns
	}}
/>
