<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { categoryEditSchema, categorySchema } from '#lib/schemas/catalog.ts';

	let { data } = $props();
</script>

<PageHeader title="Categories" description="How the shop groups its products: Specialty, Certified, Commercial, Bundles, Merchandise." />

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: categorySchema, edit: categoryEditSchema }}
	config={{
		entity: 'Category',
		plural: 'Categories',
		fields: [
			{ name: 'nameEn', label: 'Name (English)', type: 'text' },
			{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false },
			{ name: 'nameOm', label: 'Name (Afaan Oromo)', type: 'text', required: false, inTable: false },
			{ name: 'nameAr', label: 'Name (Arabic)', type: 'text', required: false, inTable: false },
			{ name: 'nameIt', label: 'Name (Italian)', type: 'text', required: false, inTable: false },
			{ name: 'nameFr', label: 'Name (French)', type: 'text', required: false, inTable: false },
			{ name: 'slug', label: 'Address (slug)', type: 'text' },
			{ name: 'descriptionEn', label: 'Description (English)', type: 'textarea', required: false, rows: 3 },
			{ name: 'descriptionAm', label: 'Description (Amharic)', type: 'textarea', required: false, rows: 3, inTable: false },
			{ name: 'descriptionOm', label: 'Description (Afaan Oromo)', type: 'textarea', required: false, rows: 3, inTable: false },
			{ name: 'descriptionAr', label: 'Description (Arabic)', type: 'textarea', required: false, rows: 3, inTable: false },
			{ name: 'descriptionIt', label: 'Description (Italian)', type: 'textarea', required: false, rows: 3, inTable: false },
			{ name: 'descriptionFr', label: 'Description (French)', type: 'textarea', required: false, rows: 3, inTable: false },
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
