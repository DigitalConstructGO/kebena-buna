<script lang="ts">
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Ban from '@lucide/svelte/icons/ban';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import { formatDateTime, humanize } from '#lib/format.ts';
	import { badge } from '#lib/status.ts';
	import { useLinks } from '#lib/links.ts';
	import { REF_ENTITY } from '#lib/refs.ts';

	let { data } = $props();
	const m = $derived(data.message);
	const href = useLinks();
	const payload = $derived(m.payload ? JSON.stringify(m.payload, null, 2) : '');
</script>

<PageHeader
	title={m.templateKey}
	eyebrow="Message #{m.id}"
	description="{humanize(m.channel)} to {m.recipient}"
>
	{#snippet badges()}
		<Statuses {...badge(m.status)} />
		{#if m.isMarketing}<Statuses status="info" label="Marketing" />{/if}
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			{#if m.status === 'failed' || m.status === 'skipped'}
				<ConfirmAction
					action="?/retry"
					label="Send again"
					icon={RotateCw}
					variant="outline"
					title="Queue this message again?"
					description="It goes back in the queue, due now."
				/>
			{/if}
			{#if m.status === 'queued' || m.status === 'failed'}
				<ConfirmAction
					action="?/skip"
					label="Skip"
					icon={Ban}
					variant="ghost"
					title="Skip this message?"
					description="It will not be sent."
				/>
			{/if}
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
	<PageSection title="Message">
		<SingleTable
			singleTable={[
				{ name: 'Recipient', value: m.recipient },
				{ name: 'Customer', value: data.customer ?? '—', href: href('customer', m.customerId) },
				{ name: 'User', value: data.userName ?? '—', href: href('user', m.userId) },
				{ name: 'Channel', value: humanize(m.channel) },
				{ name: 'Language', value: m.locale },
				{
					name: 'About',
					value: m.refType ? `${humanize(m.refType)} #${m.refId}` : '—',
					href:
						m.refType && REF_ENTITY[m.refType] ? href(REF_ENTITY[m.refType], m.refId) : undefined
				},
				{ name: 'Due', value: formatDateTime(m.scheduledFor) },
				{ name: 'Sent', value: formatDateTime(m.sentAt) },
				{ name: 'Attempts', value: m.attempts },
				{ name: 'Last error', value: m.lastError ?? '—', long: 40 },
				{ name: 'Gateway reference', value: m.providerRef ?? '—' },
				{ name: 'Deduplication key', value: m.dedupeKey ?? '—' },
				{ name: 'Queued', value: formatDateTime(m.createdAt) }
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Template" hint="The wording this message is filled from.">
			{#if data.template}
				{#if data.template.subject}<p class="mb-2 font-medium">{data.template.subject}</p>{/if}
				<p class="text-sm whitespace-pre-wrap">{data.template.body}</p>
			{:else}<Empty message="No template for this event, channel and language" />{/if}
		</PageSection>
		<PageSection title="Values" hint="What fills the template's placeholders.">
			{#if payload}
				<pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs">{payload}</pre>
			{:else}<Empty message="No values" />{/if}
		</PageSection>
	</div>
</div>
