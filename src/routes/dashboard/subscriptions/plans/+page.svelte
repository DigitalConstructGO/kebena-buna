<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { subscriptionPlanEditSchema, subscriptionPlanSchema } from '#lib/schemas/memberships.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Subscription plans"
	description="The prepaid bundles on offer: how many deliveries, and the discount for buying them together."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: subscriptionPlanSchema, edit: subscriptionPlanEditSchema }}
	config={{
		entity: 'Subscription plan',
		plural: 'Subscription plans',
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
			{ name: 'deliveries', label: 'Deliveries', type: 'number' },
			{ name: 'discountPct', label: 'Discount (%)', type: 'number' },
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
