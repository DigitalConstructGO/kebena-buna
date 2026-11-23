<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { bagSizeEditSchema, bagSizeSchema } from '#lib/schemas/catalog.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Bag sizes"
	description="The sizes coffee is sold in. Grams drive roasted-stock use and wholesale kg pricing."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: bagSizeSchema, edit: bagSizeEditSchema }}
	config={{
		entity: 'Bag size',
		plural: 'Bag sizes',
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
			{ name: 'grams', label: 'Grams', type: 'number' },
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
