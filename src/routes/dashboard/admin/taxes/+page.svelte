<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { taxEditSchema, taxSchema } from '#lib/schemas/admin.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Tax rates"
	eyebrow="Admin"
	description="Every product, ticket and booking points at one of these, and each sale copies the rate, so changing VAT never rewrites a past receipt. Changes are audited."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: taxSchema, edit: taxEditSchema }}
	config={{
		entity: 'Tax rate',
		plural: 'Tax rates',
		fields: [
			{ name: 'nameEn', label: 'Name (English)', type: 'text' },
			{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false },
			{
				name: 'nameOm',
				label: 'Name (Afaan Oromo)',
				type: 'text',
				required: false,
				inTable: false
			},
			{ name: 'nameAr', label: 'Name (Arabic)', type: 'text', required: false, inTable: false },
			{ name: 'nameIt', label: 'Name (Italian)', type: 'text', required: false, inTable: false },
			{ name: 'nameFr', label: 'Name (French)', type: 'text', required: false, inTable: false },
			{ name: 'code', label: 'Code', type: 'text' },
			{ name: 'rate', label: 'Rate (%)', type: 'number' },
			{
				name: 'isInclusive',
				label: 'Prices include it',
				type: 'checkbox',
				trueLabel: 'Inclusive',
				falseLabel: 'Added on top'
			},
			{
				name: 'isDefault',
				label: 'Default',
				type: 'checkbox',
				trueLabel: 'Default',
				falseLabel: '—'
			},
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
