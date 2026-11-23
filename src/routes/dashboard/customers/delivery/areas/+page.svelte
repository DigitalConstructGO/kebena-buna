<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { areaEditSchema, areaSchema } from '#lib/schemas/customers.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Delivery areas"
	description="The sub-cities and towns each zone covers — what the address picker offers."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: areaSchema, edit: areaEditSchema }}
	table={{ facetKeys: ['zone'], facetLabels: { zone: 'Zone' } }}
	config={{
		entity: 'Delivery area',
		plural: 'Delivery areas',
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
			{ name: 'zoneId', label: 'Zone', type: 'reference', options: 'zoneList', display: 'zone' },
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
