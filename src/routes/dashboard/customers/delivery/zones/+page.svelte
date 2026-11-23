<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { zoneEditSchema, zoneSchema } from '#lib/schemas/customers.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Delivery zones"
	description="Fees by sub-city. Free above an amount; members ride free where ticked; pickup and courier zones."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: zoneSchema, edit: zoneEditSchema }}
	config={{
		entity: 'Delivery zone',
		plural: 'Delivery zones',
		fields: [
			{ name: 'nameEn', label: 'Name (English)', type: 'text' },
			{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false },
			{ name: 'nameOm', label: 'Name (Afaan Oromo)', type: 'text', required: false, inTable: false },
			{ name: 'nameAr', label: 'Name (Arabic)', type: 'text', required: false, inTable: false },
			{ name: 'nameIt', label: 'Name (Italian)', type: 'text', required: false, inTable: false },
			{ name: 'nameFr', label: 'Name (French)', type: 'text', required: false, inTable: false },
			{ name: 'code', label: 'Code', type: 'text' },
			{ name: 'fee', label: 'Fee', type: 'money' },
			{ name: 'currency', label: 'Currency', type: 'text', inTable: false },
			{ name: 'freeAbove', label: 'Free above', type: 'money', required: false },
			{ name: 'freeForMembers', label: 'Free for members', type: 'checkbox', trueLabel: 'Yes', falseLabel: 'No' },
			{ name: 'isPickup', label: 'Pickup', type: 'checkbox', trueLabel: 'Yes', falseLabel: 'No' },
			{ name: 'usesCourier', label: 'Courier', type: 'checkbox', trueLabel: 'Yes', falseLabel: 'No' },
			{ name: 'transitDays', label: 'Transit days', type: 'number' },
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
