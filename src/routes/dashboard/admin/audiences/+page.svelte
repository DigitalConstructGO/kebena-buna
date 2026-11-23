<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { audienceEditSchema, audienceSchema } from '#lib/schemas/admin.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Audiences"
	eyebrow="Admin"
	description="Who a ticket, booking or event is priced for. The colour is what the e-ticket and the scanner show; the declaration is the box the buyer ticks at checkout."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: audienceSchema, edit: audienceEditSchema }}
	config={{
		entity: 'Audience',
		plural: 'Audiences',
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
			{ name: 'colour', label: 'Colour', type: 'text', required: false, placeholder: '#16a34a' },
			{
				name: 'requiresIdCheck',
				label: 'ID checked at the door',
				type: 'checkbox',
				trueLabel: 'ID check',
				falseLabel: 'No check'
			},
			{
				name: 'declarationEn',
				label: 'Declaration (English)',
				type: 'textarea',
				required: false,
				rows: 2
			},
			{
				name: 'declarationAm',
				label: 'Declaration (Amharic)',
				type: 'textarea',
				required: false,
				rows: 2
			},
			{
				name: 'declarationOm',
				label: 'Declaration (Afaan Oromo)',
				type: 'textarea',
				required: false,
				rows: 2,
				inTable: false
			},
			{
				name: 'declarationAr',
				label: 'Declaration (Arabic)',
				type: 'textarea',
				required: false,
				rows: 2,
				inTable: false
			},
			{
				name: 'declarationIt',
				label: 'Declaration (Italian)',
				type: 'textarea',
				required: false,
				rows: 2,
				inTable: false
			},
			{
				name: 'declarationFr',
				label: 'Declaration (French)',
				type: 'textarea',
				required: false,
				rows: 2,
				inTable: false
			},
			{
				name: 'isDefault',
				label: 'Default',
				type: 'checkbox',
				trueLabel: 'Default',
				falseLabel: '—'
			},
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
