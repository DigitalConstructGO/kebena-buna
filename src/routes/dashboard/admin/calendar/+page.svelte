<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { calendarEditSchema, calendarSchema } from '#lib/schemas/admin.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Holidays & closures"
	eyebrow="Admin"
	description="Meskel, Timket, maintenance days. A closure cancels that day's slots; “blocks roasting” pushes roast-to-order dispatch dates. No location means every location."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: calendarSchema, edit: calendarEditSchema }}
	table={{ facetKeys: ['isClosed'], facetLabels: { isClosed: 'Closed' } }}
	config={{
		entity: 'Holiday or closure',
		plural: 'Holidays & closures',
		fields: [
			{ name: 'nameEn', label: 'Name (English)', type: 'text' },
			{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false },
			{ name: 'nameOm', label: 'Name (Afaan Oromo)', type: 'text', required: false, inTable: false },
			{ name: 'nameAr', label: 'Name (Arabic)', type: 'text', required: false, inTable: false },
			{ name: 'nameIt', label: 'Name (Italian)', type: 'text', required: false, inTable: false },
			{ name: 'nameFr', label: 'Name (French)', type: 'text', required: false, inTable: false },
			{ name: 'date', label: 'Date', type: 'date' },
			{ name: 'locationId', label: 'Location', type: 'reference', options: 'locationList', display: 'location', required: false },
			{ name: 'isHoliday', label: 'Public holiday', type: 'checkbox', trueLabel: 'Holiday', falseLabel: 'Not a holiday' },
			{ name: 'isClosed', label: 'Closed all day', type: 'checkbox', trueLabel: 'Closed', falseLabel: 'Special hours' },
			{ name: 'opensAt', label: 'Opens', type: 'text', required: false, placeholder: 'HH:MM, if not closed' },
			{ name: 'closesAt', label: 'Closes', type: 'text', required: false, placeholder: 'HH:MM, if not closed' },
			{ name: 'blocksRoasting', label: 'No roasting', type: 'checkbox', trueLabel: 'No roasting', falseLabel: 'Roasting as usual' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
