<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { courierEditSchema, courierSchema } from '#lib/schemas/customers.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Couriers"
	description={'EMS or a private courier for orders outside Addis. {tracking} in the URL is replaced by the tracking number.'}
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: courierSchema, edit: courierEditSchema }}
	config={{
		entity: 'Courier',
		plural: 'Couriers',
		fields: [
			{ name: 'name', label: 'Name', type: 'text' },
			{ name: 'phone', label: 'Phone', type: 'text', required: false },
			{
				name: 'trackingUrlTemplate',
				label: 'Tracking URL',
				type: 'text',
				required: false,
				long: 30,
				placeholder: 'https://…/track?n={tracking}'
			},
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
