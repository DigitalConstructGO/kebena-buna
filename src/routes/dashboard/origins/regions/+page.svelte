<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { regionEditSchema, regionSchema } from '#lib/schemas/origins.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Regions"
	description="Where coffee grows, as one tree: region › zone › woreda. Stations and lots point at the narrowest one."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: regionSchema, edit: regionEditSchema }}
	table={{ facetKeys: ['level'], facetLabels: { level: 'Level' } }}
	config={{
		entity: 'Region',
		plural: 'Regions',
		detailEntity: 'region',
		fields: [
			{ name: 'nameEn', label: 'Name (English)', type: 'text' },
			{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false },
			{ name: 'nameOm', label: 'Name (Afaan Oromo)', type: 'text', required: false, inTable: false },
			{ name: 'nameAr', label: 'Name (Arabic)', type: 'text', required: false, inTable: false },
			{ name: 'nameIt', label: 'Name (Italian)', type: 'text', required: false, inTable: false },
			{ name: 'nameFr', label: 'Name (French)', type: 'text', required: false, inTable: false },
			{ name: 'level', label: 'Level', type: 'text', placeholder: 'region, zone, woreda' },
			{
				name: 'parentId',
				label: 'Inside',
				type: 'reference',
				options: 'regionList',
				display: 'parent',
				required: false
			},
			{ name: 'storyEn', label: 'Story (English)', type: 'textarea', required: false, rows: 4 },
			{ name: 'storyAm', label: 'Story (Amharic)', type: 'textarea', required: false, rows: 4, inTable: false },
			{ name: 'storyOm', label: 'Story (Afaan Oromo)', type: 'textarea', required: false, rows: 4, inTable: false },
			{ name: 'storyAr', label: 'Story (Arabic)', type: 'textarea', required: false, rows: 4, inTable: false },
			{ name: 'storyIt', label: 'Story (Italian)', type: 'textarea', required: false, rows: 4, inTable: false },
			{ name: 'storyFr', label: 'Story (French)', type: 'textarea', required: false, rows: 4, inTable: false },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
