<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { bankAccountEditSchema, bankAccountSchema } from '#lib/schemas/orders.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Bank accounts"
	description="Where buyers pay by transfer. Active ones are listed on their order's page, where they upload the receipt; confirm it on the order once the money is on the statement."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: bankAccountSchema, edit: bankAccountEditSchema }}
	config={{
		entity: 'Bank account',
		plural: 'Bank accounts',
		fields: [
			{ name: 'bankName', label: 'Bank or wallet', type: 'text' },
			{ name: 'accountName', label: 'Account name', type: 'text' },
			{ name: 'accountNumber', label: 'Account number', type: 'text' },
			{ name: 'note', label: 'Note for buyers', type: 'text', required: false, inTable: false },
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
