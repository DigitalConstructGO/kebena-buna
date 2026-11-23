<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Check from '@lucide/svelte/icons/check';
	import Send from '@lucide/svelte/icons/send';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import X from '@lucide/svelte/icons/x';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { amount, flag, link } from '#lib/cells.ts';
	import { formatDateTime, humanize, money } from '#lib/format.ts';
	import { badge } from '#lib/status.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	const rf = $derived(data.refund);
	const href = useLinks();

	type Line = (typeof data.lines)[number];
	const columns: ColumnDef<Line>[] = [
		{ id: 'description', header: 'Item', cell: ({ row }) => row.original.description },
		{
			id: 'sku',
			header: 'Variant',
			cell: ({ row }) => link('variant', row.original.variantId, row.original.sku)
		},
		{
			id: 'qty',
			header: 'Qty',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.quantity
		},
		{
			id: 'restock',
			header: 'Back on shelf',
			cell: ({ row }) => flag(row.original.restock, 'Yes', 'No')
		},
		{
			id: 'amount',
			header: 'Amount (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.amount)
		}
	];
</script>

<PageHeader
	title="Refund #{rf.id}"
	eyebrow="Refund"
	description={`${data.order.number} · ${money(rf.amount)}`}
>
	{#snippet badges()}
		<Statuses {...badge(rf.status)} />
	{/snippet}
	{#snippet actions()}
		{#if data.canApprove}
			<ConfirmAction
				action="?/approve"
				label="Approve"
				icon={Check}
				title="Approve this refund?"
				description="It can then be paid back. You are recorded as the approver."
			/>
		{/if}
		{#if data.canDecide && rf.status === 'approved'}
			<ConfirmAction
				action="?/processing"
				label="Sent to gateway"
				icon={Send}
				variant="outline"
				title="Mark as sent to the gateway?"
			/>
		{/if}
		{#if data.canDecide && (rf.status === 'approved' || rf.status === 'processing')}
			<ConfirmAction
				action="?/succeed"
				label="Mark paid back"
				icon={BadgeCheck}
				title="Has the money gone back?"
				description={rf.toStoreCredit
					? 'The amount is added to the customer’s store credit and the order shows it refunded.'
					: 'The order shows it refunded, and the lines their refunded quantities.'}
			/>
			<ConfirmAction
				action="?/fail"
				label="Failed"
				icon={X}
				variant="destructive"
				title="Mark this refund failed?"
			/>
		{/if}
	{/snippet}
</PageHeader>

{#if data.canDecide && rf.status === 'requested' && !data.canApprove}
	<Notice tone="info" class="mt-4">
		You asked for this refund, so someone else must approve it.
	</Notice>
{/if}

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Refund">
		<SingleTable
			singleTable={[
				{ name: 'Order', value: data.order.number, href: href('order', rf.orderId) },
				{
					name: 'Customer',
					value: data.order.customer ?? '—',
					href: href('customer', data.order.customerId)
				},
				{
					name: 'Paid with',
					value: data.payment ? `${humanize(data.payment.provider)} (${data.payment.txRef})` : '—',
					href: href('payment', rf.paymentId)
				},
				{ name: 'Amount', value: money(rf.amount) },
				{ name: 'Fee kept', value: money(rf.feeRetained) },
				{ name: 'Back as', value: rf.toStoreCredit ? 'Store credit' : 'To the card or wallet' },
				{ name: 'Reason', value: rf.reason, long: 40 },
				{ name: 'Automatic', value: rf.isAutomatic ? 'Yes — a museum-side cancellation' : 'No' },
				{ name: 'Asked by', value: data.requestedBy ?? '—', href: href('user', rf.requestedBy) },
				{ name: 'Asked', value: formatDateTime(rf.createdAt) },
				{ name: 'Approved by', value: data.approvedBy ?? '—', href: href('user', rf.approvedBy) },
				{ name: 'Processed', value: formatDateTime(rf.processedAt) },
				{ name: 'Gateway reference', value: rf.providerRef ?? '—' }
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Lines refunded">
			<DataTable
				variant="compact"
				{columns}
				data={data.lines}
				summary={[{ label: 'Refund', value: amount(rf.amount), strong: true }]}
			/>
		</PageSection>
		<PageSection title="The order">
			<SingleTable
				singleTable={[
					{ name: 'Total', value: money(data.order.total) },
					{ name: 'Paid', value: money(data.order.amountPaid) },
					{ name: 'Refunded so far', value: money(data.order.amountRefunded) },
					{
						name: 'Payment',
						value: data.order.paymentState,
						kind: 'status',
						label: humanize(data.order.paymentState)
					}
				]}
			/>
		</PageSection>
	</div>
</div>
