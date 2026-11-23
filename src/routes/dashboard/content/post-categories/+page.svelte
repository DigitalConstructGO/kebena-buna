<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { postCategoryEditSchema, postCategorySchema } from '#lib/schemas/content.ts';

	let { data } = $props();
</script>

<PageHeader title="Post categories" description="How the blog is grouped. A deleted category leaves its posts uncategorised." />

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: postCategorySchema, edit: postCategoryEditSchema }}
	config={{
		entity: 'Post category',
		plural: 'Post categories',
		fields: [
			{ name: 'nameEn', label: 'Name (English)', type: 'text' },
			{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false },
			{ name: 'nameOm', label: 'Name (Afaan Oromo)', type: 'text', required: false, inTable: false },
			{ name: 'nameAr', label: 'Name (Arabic)', type: 'text', required: false, inTable: false },
			{ name: 'nameIt', label: 'Name (Italian)', type: 'text', required: false, inTable: false },
			{ name: 'nameFr', label: 'Name (French)', type: 'text', required: false, inTable: false },
			{ name: 'slug', label: 'Address', type: 'text' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
