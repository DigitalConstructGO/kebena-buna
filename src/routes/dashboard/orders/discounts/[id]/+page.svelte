<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import { amount, dateTime, link } from '#lib/cells.ts';
	import { formatDateTime, humanize, money } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { discountEditSchema } from '#lib/schemas/orders.ts';
	import DiscountFields from '../DiscountFields.svelte';

	let { data } = $props();
	const d = $derived(data.code);
	const href = useLinks();

	type Row = (typeof data.redemptions)[number];
	const columns: ColumnDef<Row>[] = [
		{ id: 'at', header: 'Used', cell: ({ row }) => dateTime(row.original.createdAt) },
		{
			id: 'order',
			header: 'Order',
			cell: ({ row }) => link('order', row.original.orderId, row.original.orderNumber)
		},
		{
			id: 'customer',
			header: 'Customer',
			cell: ({ row }) => link('customer', row.original.customerId, row.original.customer)
		},
		{
			id: 'total',
			header: 'Order total (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.orderTotal)
		},
		{
			id: 'amount',
			header: 'Discount (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.amount)
		}
	];
</script>

<PageHeader
	title={d.code}
	eyebrow="Discount code"
	description={d.kind === 'percent' ? `${Number(d.value)}% off` : `${money(d.value)} off`}
>
	{#snippet badges()}
		<Statuses {...flag(d.isActive)} />
	{/snippet}
	{#snippet actions()}
		<FormDialog
			title="Edit {d.code}"
			action="?/edit"
			data={data.editForm}
			schema={discountEditSchema}
			dataType="json"
		>
			{#snippet fields({ form, errors })}
				<DiscountFields form={form as never} errors={errors as never} />
			{/snippet}
		</FormDialog>
		{#if !d.usedCount}
			<ConfirmAction
				action="?/delete"
				label="Delete"
				icon={Trash2}
				variant="destructive"
				title="Delete {d.code}?"
				description="Only a code nobody has used can be deleted."
			/>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
	<StatCard
		stat={{
			key: 'uses',
			label: 'Times used',
			value: d.usedCount,
			format: 'count',
			group: 'discount'
		}}
	/>
	<StatCard
		amharicMoney={false}
		stat={{
			key: 'given',
			label: 'Discount given',
			value: data.sums.given,
			format: 'money',
			group: 'discount',
			tone: 'negative'
		}}
	/>
	<StatCard
		amharicMoney={false}
		stat={{
			key: 'sales',
			label: 'Orders it was used on',
			value: data.sums.sales,
			format: 'money',
			group: 'discount',
			tone: 'positive'
		}}
	/>
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Rules">
		<SingleTable
			singleTable={[
				{ name: 'Description', value: d.description ?? '—', long: 40 },
				{ name: 'Discount', value: d.kind === 'percent' ? `${Number(d.value)}%` : money(d.value) },
				{ name: 'Minimum order', value: money(d.minOrderAmount) },
				{ name: 'At most', value: d.maxDiscountAmount ? money(d.maxDiscountAmount) : 'No cap' },
				{ name: 'Applies to', value: d.appliesTo?.map(humanize).join(', ') || 'Everything' },
				{ name: 'From', value: formatDateTime(d.startsAt) },
				{ name: 'Until', value: formatDateTime(d.expiresAt) },
				{ name: 'Uses', value: `${d.usedCount}${d.usageLimit ? ` of ${d.usageLimit}` : ''}` },
				{ name: 'Per customer', value: d.perCustomerLimit ?? 'No limit' },
				{ name: 'Customers', value: data.sums.customers },
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<PageSection title="Where it was used">
		{#if data.redemptions.length}
			<DataTable variant="compact" {columns} data={data.redemptions} />
		{:else}<Empty message="Not used yet" />{/if}
	</PageSection>
</div>
