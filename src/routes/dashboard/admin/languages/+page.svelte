<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { languageEditSchema, languageSchema } from '#lib/schemas/admin.ts';

	let { data } = $props();
</script>

<PageHeader
	title="Languages"
	eyebrow="Admin"
	description="The languages customer-facing text is written in. Adding Afaan Oromo is a row here plus its message file; every translated field picks it up."
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: languageSchema, edit: languageEditSchema }}
	config={{
		entity: 'Language',
		plural: 'Languages',
		fields: [
			{ name: 'name', label: 'Name', type: 'text' },
			{ name: 'nativeName', label: 'Native name', type: 'text' },
			{ name: 'code', label: 'Code', type: 'text', placeholder: 'am, en, om' },
			{ name: 'isRequired', label: 'Required before publishing', type: 'checkbox', trueLabel: 'Required', falseLabel: 'Optional' },
			{ name: 'isDefault', label: 'Default', type: 'checkbox', trueLabel: 'Default', falseLabel: '—' },
			{ name: 'sortOrder', label: 'Order', type: 'number' },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
