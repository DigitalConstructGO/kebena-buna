<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { tierEditSchema, tierSchema } from '#lib/schemas/wholesale.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Quantity tiers"
	description="Wholesale discounts off the retail 1 kg price by monthly kilograms. An empty maximum has no upper bound."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: tierSchema, edit: tierEditSchema }}
	config={{
		entity: 'Quantity tier',
		plural: 'Quantity tiers',
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
			{ name: 'minKg', label: 'From (kg)', type: 'number' },
			{ name: 'maxKg', label: 'To (kg)', type: 'number', required: false },
			{ name: 'discountPct', label: 'Discount (%)', type: 'number' },
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
