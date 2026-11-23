<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { packagingEditSchema, packagingSchema } from '#lib/schemas/catalog.ts';

	let { data } = $props();
</script>

<PageHeader title="Packaging" description="The standard bag, and options like a gift box with its surcharge." />

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: packagingSchema, edit: packagingEditSchema }}
	config={{
		entity: 'Packaging',
		plural: 'Packaging',
		fields: [
			{ name: 'nameEn', label: 'Name (English)', type: 'text' },
			{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false },
			{ name: 'nameOm', label: 'Name (Afaan Oromo)', type: 'text', required: false, inTable: false },
			{ name: 'nameAr', label: 'Name (Arabic)', type: 'text', required: false, inTable: false },
			{ name: 'nameIt', label: 'Name (Italian)', type: 'text', required: false, inTable: false },
			{ name: 'nameFr', label: 'Name (French)', type: 'text', required: false, inTable: false },
			{ name: 'code', label: 'Code', type: 'text' },
			{ name: 'surcharge', label: 'Surcharge', type: 'money' },
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
