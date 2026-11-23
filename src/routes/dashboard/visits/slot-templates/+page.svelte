<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import type { LookupFieldType } from '@nahu/admin-kit/components/lookup/types';
	import { WEEKDAY_CHOICES } from '#lib/format.ts';
	import { slotTemplateEditSchema, slotTemplateSchema } from '#lib/schemas/visits.ts';

	let { data } = $props();

	// The kit's lookup fields hand any other type straight to `InputComp`, which has a time input.
	const time = 'time' as LookupFieldType;
</script>

<PageHeader
	title="Slot pattern"
	description="The weekly timed-entry slots per location. Visit days are generated from it; days already made keep their own slots."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: slotTemplateSchema, edit: slotTemplateEditSchema }}
	config={{
		entity: 'Slot',
		plural: 'Slot pattern',
		fields: [
			{ name: 'weekday', label: 'Day', type: 'select', choices: WEEKDAY_CHOICES },
			{ name: 'locationId', label: 'Location', type: 'reference', options: 'locationList', display: 'location', picker: 'select' },
			{ name: 'startsAt', label: 'Starts', type: time },
			{ name: 'endsAt', label: 'Ends', type: time },
			{ name: 'capacity', label: 'Capacity', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
