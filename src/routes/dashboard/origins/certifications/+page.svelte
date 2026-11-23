<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { certificationEditSchema, certificationSchema } from '#lib/schemas/origins.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Certifications"
	description="Rainforest Alliance, organic, C.A.F.E. Practices — held by stations and by lots."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: certificationSchema, edit: certificationEditSchema }}
	config={{
		entity: 'Certification',
		plural: 'Certifications',
		fields: [
			{ name: 'nameEn', label: 'Name (English)', type: 'text' },
			{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false },
			{ name: 'nameOm', label: 'Name (Afaan Oromo)', type: 'text', required: false, inTable: false },
			{ name: 'nameAr', label: 'Name (Arabic)', type: 'text', required: false, inTable: false },
			{ name: 'nameIt', label: 'Name (Italian)', type: 'text', required: false, inTable: false },
			{ name: 'nameFr', label: 'Name (French)', type: 'text', required: false, inTable: false },
			{ name: 'code', label: 'Code', type: 'text' },
			{ name: 'url', label: 'Website', type: 'text', required: false, long: 30 },
			{ name: 'logo', label: 'Logo', type: 'image', required: false },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
