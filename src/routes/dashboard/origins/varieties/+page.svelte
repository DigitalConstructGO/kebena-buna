<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { varietyEditSchema, varietySchema } from '#lib/schemas/origins.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Varieties"
	description="Ethiopian heirloom and the JARC selections a lot may be made of."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: varietySchema, edit: varietyEditSchema }}
	config={{
		entity: 'Variety',
		plural: 'Varieties',
		fields: [
			{ name: 'name', label: 'Name', type: 'text' },
			{ name: 'descriptionEn', label: 'Description (English)', type: 'textarea', required: false, rows: 3 },
			{ name: 'descriptionAm', label: 'Description (Amharic)', type: 'textarea', required: false, rows: 3, inTable: false },
			{ name: 'descriptionOm', label: 'Description (Afaan Oromo)', type: 'textarea', required: false, rows: 3, inTable: false },
			{ name: 'descriptionAr', label: 'Description (Arabic)', type: 'textarea', required: false, rows: 3, inTable: false },
			{ name: 'descriptionIt', label: 'Description (Italian)', type: 'textarea', required: false, rows: 3, inTable: false },
			{ name: 'descriptionFr', label: 'Description (French)', type: 'textarea', required: false, rows: 3, inTable: false },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
