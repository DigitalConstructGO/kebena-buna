<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { grindEditSchema, grindSchema } from '#lib/schemas/catalog.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Grinds"
	description="Whole bean and the grinds a customer may ask for. Grind is chosen at packing, so all share one roasted stock."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: grindSchema, edit: grindEditSchema }}
	config={{
		entity: 'Grind',
		plural: 'Grinds',
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
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
