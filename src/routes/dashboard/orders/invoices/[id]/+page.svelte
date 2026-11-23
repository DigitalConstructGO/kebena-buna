<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Send from '@lucide/svelte/icons/send';
	import Ban from '@lucide/svelte/icons/ban';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { amount, dateTime, link, status, user } from '#lib/cells.ts';
	import { choicesOf, formatDate, humanize } from '#lib/format.ts';
	import { badge } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { invoiceEditSchema, MANUAL_PROVIDERS, paymentSchema } from '#lib/schemas/orders.ts';

	let { data } = $props();
	const inv = $derived(data.invoice);
	const href = useLinks();
	const late = $derived(
		inv.status === 'overdue' || (inv.status === 'open' && !!inv.dueOn && inv.dueOn < data.today)
	);

	type Pay = (typeof data.payments)[number];
	const columns: ColumnDef<Pay>[] = [
		{
			id: 'ref',
			header: 'Payment',
			cell: ({ row }) => link('payment', row.original.id, row.original.txRef)
		},
		{ id: 'via', header: 'Via', cell: ({ row }) => humanize(row.original.provider) },
		{ id: 'reference', header: 'Reference', cell: ({ row }) => row.original.reference ?? '—' },
		{ id: 'at', header: 'Paid', cell: ({ row }) => dateTime(row.original.paidAt) },
		{
			id: 'by',
			header: 'Recorded by',
			cell: ({ row }) => user(row.original.byId, row.original.by)
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{
			id: 'amount',
			header: 'Amount (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.amount)
		}
	];
</script>

<PageHeader title={inv.number} eyebrow="Invoice" description={inv.billingName}>
	{#snippet badges()}
		<Statuses {...badge(late ? 'overdue' : inv.status)} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			{#if inv.status === 'draft'}
				<ConfirmAction
					action="?/issue"
					label="Issue"
					icon={Send}
					title="Issue {inv.number}?"
					description="Dated today and due in 30 days unless a due date is set."
				/>
			{/if}
			{#if inv.status === 'open' || inv.status === 'overdue'}
				<FormDialog
					title="Record a payment"
					triggerLabel="Record payment"
					action="?/payment"
					data={data.paymentForm}
					schema={paymentSchema}
				>
					{#snippet fields({ form, errors })}
						<InputComp
							label="Paid by"
							name="provider"
							type="select"
							items={choicesOf(MANUAL_PROVIDERS)}
							{form}
							{errors}
							required
						/>
						<InputComp
							label="Amount (ETB)"
							name="amount"
							type="number"
							step="0.01"
							{form}
							{errors}
							required
						/>
						<InputComp
							label="Reference"
							name="reference"
							placeholder="Bank reference"
							{form}
							{errors}
						/>
						<InputComp label="Paid on" name="paidOn" type="date" {form} {errors} required />
					{/snippet}
				</FormDialog>
			{/if}
			{#if inv.status !== 'paid' && inv.status !== 'void'}
				<FormDialog
					title="Edit {inv.number}"
					action="?/edit"
					data={data.editForm}
					schema={invoiceEditSchema}
				>
					{#snippet fields({ form, errors })}
						<InputComp label="Billed to" name="billingName" {form} {errors} required />
						<InputComp label="TIN" name="billingTin" {form} {errors} />
						<InputComp label="Address" name="billingAddress" {form} {errors} />
						<InputComp label="Due" name="dueOn" type="date" futureDays {form} {errors} />
						<InputComp label="Notes" name="notes" type="textarea" rows={3} {form} {errors} />
					{/snippet}
				</FormDialog>
				{#if !Number(inv.amountPaid)}
					<ConfirmAction
						action="?/void"
						label="Void"
						icon={Ban}
						variant="destructive"
						title="Void {inv.number}?"
						description="A void invoice stays on file under its number, marked void."
					/>
				{/if}
			{/if}
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
	<StatCard
		amharicMoney={false}
		stat={{
			key: 'total',
			label: 'Total',
			value: Number(inv.total),
			format: 'money',
			group: 'invoice'
		}}
	/>
	<StatCard
		amharicMoney={false}
		stat={{
			key: 'paid',
			label: 'Paid',
			value: Number(inv.amountPaid),
			format: 'money',
			group: 'invoice',
			tone: 'positive'
		}}
	/>
	<StatCard
		amharicMoney={false}
		stat={{
			key: 'balance',
			label: 'Balance',
			value: data.balance,
			format: 'money',
			group: 'invoice',
			tone: late ? 'negative' : data.balance ? 'warning' : 'neutral'
		}}
	/>
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Invoice">
		<SingleTable
			singleTable={[
				{ name: 'Billed to', value: inv.billingName },
				{ name: 'TIN', value: inv.billingTin ?? '—' },
				{ name: 'Address', value: inv.billingAddress ?? '—' },
				{
					name: 'Customer',
					value: data.names.customer ?? '—',
					href: href('customer', inv.customerId)
				},
				{
					name: 'Business',
					value: data.names.business ?? '—',
					href: href('business', inv.businessAccountId)
				},
				{ name: 'Order', value: data.names.orderNumber ?? '—', href: href('order', inv.orderId) },
				{ name: 'Issued', value: formatDate(inv.issuedAt) },
				{ name: 'Due', value: formatDate(inv.dueOn) },
				{ name: 'Paid', value: formatDate(inv.paidAt) },
				{ name: 'Subtotal', value: amount(inv.subtotal) },
				{ name: 'VAT', value: amount(inv.taxTotal) },
				{ name: 'Total', value: amount(inv.total) },
				{ name: 'Notes', value: inv.notes ?? '—', long: 40 },
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Payments">
			{#if data.payments.length}
				<DataTable variant="compact" {columns} data={data.payments} />
			{:else}<Empty message="Nothing paid yet" />{/if}
		</PageSection>
		{#if data.bookings.length}
			<PageSection title="Bookings billed here">
				<SingleTable
					singleTable={data.bookings.map((b) => ({
						name: humanize(b.status),
						value: b.number,
						href: href('booking', b.id)
					}))}
				/>
			</PageSection>
		{/if}
	</div>
</div>
