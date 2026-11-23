<script lang="ts">
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import { formatDateTime, humanize } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';

	let { data } = $props();
	const w = $derived(data.event);
</script>

<PageHeader
	title={w.eventType ?? 'Webhook'}
	eyebrow="{humanize(w.provider)} webhook #{w.id}"
	description={w.eventId}
>
	{#snippet badges()}
		<Statuses {...flag(w.signatureValid, 'Signature valid', 'Signature invalid')} />
		<Statuses {...flag(Boolean(w.processedAt), 'Processed', 'Not processed')} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<ConfirmAction
				action="?/replay"
				label="Replay"
				icon={RotateCw}
				variant="outline"
				title="Process this webhook again?"
				description="It is marked unprocessed; the payment worker reads it again. A payment it already settled is not settled twice."
			/>
		{/if}
	{/snippet}
</PageHeader>

{#if w.error}
	<Notice tone="danger" title="It failed" class="mt-4">{w.error}</Notice>
{/if}
{#if !w.signatureValid}
	<Notice tone="warning" title="The signature did not match" class="mt-4">
		The gateway's signature could not be verified; it was stored but not acted on.
	</Notice>
{/if}

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Received">
		<SingleTable
			singleTable={[
				{ name: 'Gateway', value: humanize(w.provider) },
				{ name: 'Event', value: w.eventType ?? '—' },
				{ name: 'Gateway event id', value: w.eventId },
				{ name: 'Received', value: formatDateTime(w.receivedAt) },
				{ name: 'Processed', value: formatDateTime(w.processedAt) }
			]}
		/>
	</PageSection>
	<PageSection title="Payload">
		<pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(
				w.payload,
				null,
				2
			)}</pre>
	</PageSection>
</div>
