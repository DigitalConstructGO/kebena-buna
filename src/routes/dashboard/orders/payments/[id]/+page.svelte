<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { amount, dateTime, link, longText, status } from '#lib/cells.ts';
	import { formatDateTime, humanize, money } from '#lib/format.ts';
	import { badge } from '#lib/status.ts';
	import { useLinks } from '#lib/links.ts';
	import { fileUrl } from '@nahu/admin-kit/files';

	let { data } = $props();
	const p = $derived(data.payment);
	const href = useLinks();

	type Refund = (typeof data.refunds)[number];
	const refundColumns: ColumnDef<Refund>[] = [
		{
			id: 'id',
			header: 'Refund',
			cell: ({ row }) => link('refund', row.original.id, `#${row.original.id}`)
		},
		{ id: 'at', header: 'Asked', cell: ({ row }) => dateTime(row.original.createdAt) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{ id: 'reason', header: 'Reason', cell: ({ row }) => longText(row.original.reason) },
		{
			id: 'amount',
			header: 'Amount (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.amount)
		}
	];
</script>

<PageHeader
	title={p.txRef}
	eyebrow="Payment"
	description={`${humanize(p.provider)} · ${money(p.amount)}`}
>
	{#snippet badges()}
		<Statuses {...badge(p.status)} />
	{/snippet}
</PageHeader>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
	<PageSection title="Payment">
		<SingleTable
			singleTable={[
				{ name: 'Order', value: data.orderNumber ?? '—', href: href('order', p.orderId) },
				{ name: 'Invoice', value: data.invoiceNumber ?? '—', href: href('invoice', p.invoiceId) },
				{ name: 'Customer', value: data.customer ?? '—', href: href('customer', data.customerId) },
				{ name: 'Provider', value: humanize(p.provider) },
				{ name: 'Method', value: p.method ?? '—' },
				{ name: 'Amount', value: money(p.amount) },
				{ name: 'Gateway fee', value: money(p.fee) },
				{ name: 'Our reference', value: p.txRef },
				{ name: 'Gateway reference', value: p.providerRef ?? '—' },
				{ name: 'Bank / receipt ref.', value: p.reference ?? '—' },
				{ name: 'Paid into', value: data.bankAccount ?? '—' },
				...(p.receiptFile
					? [{ name: 'Buyer’s receipt', value: 'Open', href: fileUrl(p.receiptFile) }]
					: []),
				{ name: 'Failure', value: p.failureReason ?? '—', long: 40 },
				{
					name: 'Recorded by',
					value: data.recordedBy ?? (p.recordedBy ? '—' : 'Gateway'),
					href: href('user', p.recordedBy)
				},
				{ name: 'Paid', value: formatDateTime(p.paidAt) },
				{ name: 'Started', value: formatDateTime(p.createdAt) },
				{ name: 'Last update', value: formatDateTime(p.updatedAt) },
				...(p.checkoutUrl ? [{ name: 'Checkout page', value: 'Open', href: p.checkoutUrl }] : [])
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Refunds against this payment">
			{#if data.refunds.length}
				<DataTable variant="compact" columns={refundColumns} data={data.refunds} />
			{:else}<Empty message="No refunds" />{/if}
		</PageSection>
		<PageSection
			title="Gateway response"
			hint="As the gateway's verify call returned it, for disputes."
		>
			{#if data.response}
				<pre class="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{data.response}</pre>
			{:else}<Empty message="No gateway response — recorded by hand" />{/if}
		</PageSection>
	</div>
</div>
