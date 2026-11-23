<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { machineEditSchema, machineSchema } from '#lib/schemas/stock.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Roasting machines"
	description="The roasters batches are recorded on. Capacity is the green kilograms one batch holds."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: machineSchema, edit: machineEditSchema }}
	config={{
		entity: 'Roasting machine',
		plural: 'Roasting machines',
		fields: [
			{ name: 'name', label: 'Name', type: 'text' },
			{
				name: 'locationId',
				label: 'Location',
				type: 'reference',
				options: 'locationList',
				display: 'location',
				required: false
			},
			{ name: 'capacityKg', label: 'Capacity (kg green)', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
