<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { CONTACT_CHANNELS } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';
	import { LANG_CHOICES } from '#lib/languages.ts';
	import { templateEditSchema, templateSchema } from '#lib/schemas/admin.ts';

	let { data } = $props();

	const DESCRIPTION =
		'What customers are sent, per event, channel and language. Write {{placeholders}} — {{name}}, {{order_number}}, {{total}}, {{rider_phone}} — and they are filled in when the message is queued. One per key, channel and language.';
</script>

<PageHeader
	title="Message templates"
	eyebrow="Messages"
	description={DESCRIPTION}
/>

<LookupPage
	{data}
	tabTitle={false}
	schemas={{ add: templateSchema, edit: templateEditSchema }}
	table={{ facetKeys: ['channel', 'locale'], facetLabels: { channel: 'Channel', locale: 'Language' } }}
	config={{
		entity: 'Template',
		plural: 'Message templates',
		fields: [
			{ name: 'key', label: 'Event', type: 'text', placeholder: 'order.paid' },
			{ name: 'channel', label: 'Channel', type: 'select', choices: choicesOf(CONTACT_CHANNELS) },
			{
				name: 'locale',
				label: 'Language',
				type: 'select',
				choices: LANG_CHOICES
			},
			{ name: 'subject', label: 'Subject (email)', type: 'text', required: false },
			{ name: 'body', label: 'Message', type: 'textarea', rows: 6, long: 50 },
			{ name: 'status', label: 'Status', type: 'boolean' }
		]
	}}
/>
