<script lang="ts">
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Printer from '@lucide/svelte/icons/printer';
	import Banknote from '@lucide/svelte/icons/banknote';
	import Ban from '@lucide/svelte/icons/ban';
	import Check from '@lucide/svelte/icons/check';
	import FileText from '@lucide/svelte/icons/file-text';
	import X from '@lucide/svelte/icons/x';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import { fileUrl } from '@nahu/admin-kit/files';
	import { amount, date, dateTime, flag, link, longText, status, user } from '#lib/cells.ts';
	import {
		choicesOf,
		deliveryName,
		formatDate,
		formatDateTime,
		humanize,
		languageName
	} from '#lib/format.ts';
	import { badge } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import {
		cancelSchema,
		MANUAL_PROVIDERS,
		orderDeliverySchema,
		orderStatusSchema,
		paymentSchema,
		refundRequestSchema,
		rejectReceiptSchema
	} from '#lib/schemas/orders.ts';

	let { data } = $props();
	const o = $derived(data.order);
	const r = $derived(data.related);
	const shortLines = $derived(data.lines.filter((l) => l.short > 0));
	const href = useLinks();
	const tracking = $derived(
		r.courierTemplate && o.trackingNumber
			? r.courierTemplate.replace('{tracking}', o.trackingNumber)
			: undefined
	);

	type Line = (typeof data.lines)[number];
	const lineColumns: ColumnDef<Line>[] = [
		{ id: 'description', header: 'Item', cell: ({ row }) => row.original.description },
		{
			id: 'sold',
			header: 'Record',
			cell: ({ row }) =>
				row.original.sold
					? link(row.original.sold.entity, row.original.sold.id, row.original.sold.name)
					: '—'
		},
		{
			id: 'options',
			header: 'Roast / grind',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) =>
				[row.original.roastLevel, row.original.grind].filter(Boolean).join(' · ') || '—'
		},
		{
			id: 'batch',
			header: 'Roast batch',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) =>
				row.original.roastBatchId
					? link('roastBatch', row.original.roastBatchId, row.original.roastBatchCode)
					: row.original.fulfilment === 'roast_to_order'
						? `Queued ${formatDate(row.original.roastOn)}`
						: '—'
		},
		{
			id: 'qty',
			header: 'Qty',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.quantity
		},
		{
			id: 'unit',
			header: 'Unit (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.unitPrice)
		},
		{
			id: 'discount',
			header: 'Discount',
			meta: { align: 'right', class: 'hidden md:table-cell' },
			cell: ({ row }) => amount(row.original.discountAmount)
		},
		{
			id: 'refunded',
			header: 'Refunded',
			meta: { align: 'right', class: 'hidden md:table-cell' },
			cell: ({ row }) =>
				row.original.refundedQuantity
					? `${row.original.refundedQuantity} · ${amount(row.original.refundedAmount)}`
					: '—'
		},
		{
			id: 'total',
			header: 'Total (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.lineTotal)
		}
	];
	const summary = $derived([
		{ label: 'Subtotal', value: amount(o.subtotal) },
		...(Number(o.discountTotal)
			? [
					{
						label: `Discount${r.discountCode ? ` (${r.discountCode})` : ''}`,
						value: `−${amount(o.discountTotal)}`
					}
				]
			: []),
		{ label: 'Delivery', value: amount(o.deliveryFee) },
		{ label: 'Total (incl. VAT)', value: amount(o.total), strong: true },
		{ label: 'of which VAT 15%', value: amount(o.taxTotal) }
	]);

	type History = (typeof data.history)[number];
	const historyColumns: ColumnDef<History>[] = [
		{ id: 'at', header: 'When', cell: ({ row }) => dateTime(row.original.createdAt) },
		{ id: 'to', header: 'Status', cell: ({ row }) => status(row.original.toStatus) },
		{
			id: 'from',
			header: 'From',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => humanize(row.original.fromStatus)
		},
		{
			id: 'by',
			header: 'By',
			cell: ({ row }) => (row.original.byId ? user(row.original.byId, row.original.by) : 'System')
		},
		{
			id: 'told',
			header: 'Customer told',
			cell: ({ row }) => flag(row.original.notified, 'Yes', 'No')
		},
		{ id: 'note', header: 'Note', cell: ({ row }) => longText(row.original.note) }
	];
	type Pay = (typeof data.payments)[number];
	const paymentColumns: ColumnDef<Pay>[] = [
		{
			id: 'ref',
			header: 'Payment',
			cell: ({ row }) => link('payment', row.original.id, row.original.txRef)
		},
		{
			id: 'provider',
			header: 'Via',
			cell: ({ row }) =>
				humanize(row.original.provider) + (row.original.method ? ` · ${row.original.method}` : '')
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{
			id: 'at',
			header: 'Paid',
			cell: ({ row }) => dateTime(row.original.paidAt ?? row.original.createdAt)
		},
		{
			id: 'by',
			header: 'Recorded by',
			meta: { class: 'hidden 2xl:table-cell' },
			cell: ({ row }) => (row.original.byId ? user(row.original.byId, row.original.by) : 'Gateway')
		},
		{
			id: 'amount',
			header: 'Amount (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.amount)
		}
	];
	type Refund = (typeof data.refunds)[number];
	const refundColumns: ColumnDef<Refund>[] = [
		{
			id: 'id',
			header: 'Refund',
			cell: ({ row }) => link('refund', row.original.id, `#${row.original.id}`)
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{ id: 'reason', header: 'Reason', cell: ({ row }) => longText(row.original.reason) },
		{
			id: 'by',
			header: 'Asked by',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => user(row.original.requestedById, row.original.requestedBy)
		},
		{
			id: 'approved',
			header: 'Approved by',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => user(row.original.approvedById, row.original.approvedBy)
		},
		{
			id: 'amount',
			header: 'Amount (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.amount)
		}
	];
	type Inv = (typeof data.invoices)[number];
	const invoiceColumns: ColumnDef<Inv>[] = [
		{
			id: 'number',
			header: 'Invoice',
			cell: ({ row }) => link('invoice', row.original.id, row.original.number)
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{ id: 'due', header: 'Due', cell: ({ row }) => date(row.original.dueOn) },
		{
			id: 'total',
			header: 'Total (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.total)
		}
	];
	type Tk = (typeof data.tickets)[number];
	const ticketColumns: ColumnDef<Tk>[] = [
		{
			id: 'code',
			header: 'Ticket',
			cell: ({ row }) => link('ticket', row.original.id, row.original.code)
		},
		{ id: 'date', header: 'Visit', cell: ({ row }) => date(row.original.visitDate) },
		{ id: 'holder', header: 'Holder', cell: ({ row }) => row.original.holderName ?? '—' },
		{
			id: 'admits',
			header: 'Admits',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.admits
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];

	const providerChoices = choicesOf(MANUAL_PROVIDERS);

	/*
	 * The next step as a button of its own — "Mark packed" — rather than a generic "Change status"
	 * the reader has to open to learn where the order can go. All of them open the one dialog,
	 * seeded with the status the button names.
	 */
	let statusOpen = $state(false);
	let statusSeed = $state<{ status?: string }>({});
	function moveTo(next: string) {
		statusSeed = { status: next };
		statusOpen = true;
	}
	let paymentOpen = $state(false);
	let cancelOpen = $state(false);
	let rejectOpen = $state(false);
	let rejectSeed = $state<{ paymentId?: number }>({});

	/** A detail row only when it holds something: a list of dashes hides the facts among them. */
	type Detail = {
		name: string;
		value: string | number | null | undefined;
		href?: string | null;
		long?: number;
		kind?: 'phone';
	};
	const filled = (rows: (Detail | false | null | undefined)[]) =>
		rows.filter((row): row is Detail => {
			if (!row) return false;
			return row.value !== '—' && row.value !== '' && row.value !== null && row.value !== undefined;
		});

	const method = $derived(o.deliveryMethod);
	const ships = $derived(method === 'rider' || method === 'courier');
</script>

<PageHeader
	title={o.number}
	eyebrow="Order"
	description={`${humanize(o.channel)} · placed ${formatDateTime(o.placedAt)}`}
>
	{#snippet badges()}
		<Statuses {...badge(o.status)} />
		<!-- Payment only when it says something the order's status does not: two identical "Paid"
		     badges side by side read as one fact said twice. -->
		{#if o.paymentState !== 'paid'}
			<Statuses {...badge(o.paymentState, `Payment: ${humanize(o.paymentState).toLowerCase()}`)} />
		{/if}
	{/snippet}
	{#snippet actions()}
		<Button href="/dashboard/orders/slips?ids={o.id}" size="sm" variant="ghost" class="gap-1">
			<Printer class="size-4" /> Packing slip
		</Button>
		{#if data.canManage}
			{#each data.next as next, i (next)}
				<Button
					size="sm"
					variant={i === 0 ? 'default' : 'outline'}
					class="gap-1"
					onclick={() => moveTo(next)}
				>
					{#if i === 0}<ArrowRight class="size-4" />{/if}
					Mark {humanize(next).toLowerCase()}
				</Button>
			{/each}
			{#if data.next.length}
				<FormDialog
					title="Move {o.number} on"
					action="?/status"
					data={data.statusForm}
					schema={orderStatusSchema}
					bind:open={statusOpen}
					seed={statusSeed as never}
					hideTrigger
				>
					{#snippet fields({ form, errors })}
						<InputComp
							label="New status"
							name="status"
							type="select"
							items={choicesOf(data.next)}
							{form}
							{errors}
							required
						/>
						<InputComp label="Note" name="note" {form} {errors} />
						<InputComp
							label="Customer told"
							name="notified"
							type="checkboxSingle"
							placeholder="An SMS or call went out"
							{form}
							{errors}
						/>
					{/snippet}
				</FormDialog>
			{/if}
			{#if data.balance > 0 && o.status !== 'cancelled' && o.paymentState !== 'refunded'}
				<Button
					size="sm"
					variant={data.next.length ? 'outline' : 'default'}
					class="gap-1"
					onclick={() => (paymentOpen = true)}
				>
					<Banknote class="size-4" />
					Record payment
				</Button>
				<FormDialog
					title="Record a payment"
					bind:open={paymentOpen}
					hideTrigger
					action="?/payment"
					data={data.paymentForm}
					schema={paymentSchema}
					description="Cash at the desk, a card machine, a bank transfer. Gateway payments arrive by themselves."
				>
					{#snippet fields({ form, errors })}
						<InputComp
							label="Paid by"
							name="provider"
							type="select"
							items={providerChoices}
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
							placeholder="Bank reference, receipt no."
							{form}
							{errors}
						/>
						<InputComp label="Paid on" name="paidOn" type="date" {form} {errors} required />
					{/snippet}
				</FormDialog>
			{/if}
			{#if o.deliveryMethod !== 'none'}
				<FormDialog
					title="Delivery"
					triggerLabel="Delivery"
					action="?/delivery"
					data={data.deliveryForm}
					schema={orderDeliverySchema}
				>
					{#snippet fields({ form, errors })}
						{#if o.deliveryMethod === 'rider'}
							<InputComp
								label="Rider"
								name="riderId"
								type="combo"
								items={data.options.riders}
								{form}
								{errors}
							/>
						{/if}
						{#if o.deliveryMethod === 'courier'}
							<InputComp
								label="Courier"
								name="courierId"
								type="select"
								items={data.options.couriers}
								{form}
								{errors}
							/>
							<InputComp label="Tracking number" name="trackingNumber" {form} {errors} />
						{/if}
						<InputComp
							label="Expected dispatch"
							name="expectedDispatchOn"
							type="date"
							futureDays
							{form}
							{errors}
						/>
						<InputComp
							label="Staff note"
							name="staffNote"
							type="textarea"
							rows={3}
							{form}
							{errors}
						/>
					{/snippet}
				</FormDialog>
			{/if}
			{#if data.cancellable}
				<Button
					size="sm"
					variant="ghost"
					class="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
					onclick={() => (cancelOpen = true)}
				>
					<Ban class="size-4" />
					Cancel order
				</Button>
				<FormDialog
					title="Cancel {o.number}?"
					bind:open={cancelOpen}
					hideTrigger
					action="?/cancel"
					data={data.cancelForm}
					schema={cancelSchema}
					submitLabel="Cancel the order"
				>
					{#snippet fields({ form, errors })}
						<InputComp label="Reason" name="reason" {form} {errors} required />
					{/snippet}
				</FormDialog>
			{/if}
		{/if}
		{#if data.canRefund && data.options.refundLines.length && data.refundable}
			<FormDialog
				title="Request a refund"
				triggerLabel="Refund"
				triggerIcon={Undo2}
				submitIcon={Undo2}
				submitVariant="destructive"
				action="?/refund"
				data={data.refundForm}
				schema={refundRequestSchema}
				description="A Manager or the Owner — not whoever asks — approves it before money goes back."
			>
				{#snippet fields({ form, errors, values })}
					<InputComp
						label="Refund everything not yet refunded"
						name="whole"
						type="checkboxSingle"
						placeholder="Every line, and the delivery fee"
						{form}
						{errors}
					/>
					{#if !values.whole}
						<InputComp
							label="Line"
							name="orderLineId"
							type="select"
							items={data.options.refundLines}
							{form}
							{errors}
							required
						/>
						<InputComp
							label="Quantity"
							name="quantity"
							type="number"
							description="Empty: all that is left of the line."
							{form}
							{errors}
						/>
					{/if}
					<InputComp label="Reason" name="reason" {form} {errors} required />
					<InputComp
						label="Processing fee kept (ETB)"
						name="feeRetained"
						type="number"
						step="0.01"
						{form}
						{errors}
					/>
					<InputComp
						label="Put the bags back on the shelf"
						name="restock"
						type="checkboxSingle"
						placeholder="Restock"
						{form}
						{errors}
					/>
					<InputComp
						label="As store credit"
						name="toStoreCredit"
						type="checkboxSingle"
						placeholder="Instead of back to the card or wallet"
						{form}
						{errors}
					/>
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

{#each data.receipts as receipt (receipt.id)}
	<Notice tone="warning" title="Transfer receipt to check" class="mt-4">
		The buyer says they paid {amount(receipt.amount)} ETB into {receipt.bankName ??
			'an account'}{receipt.accountNumber ? ` (${receipt.accountNumber})` : ''} on {formatDateTime(
			receipt.createdAt
		)}{receipt.reference ? `, reference ${receipt.reference}` : ''}. Find it on the statement before
		confirming.
		{#snippet actions()}
			<Button
				href={fileUrl(receipt.receiptFile)}
				target="_blank"
				rel="noopener"
				size="sm"
				variant="outline"
				class="gap-1"
			>
				<FileText class="size-4" /> Receipt
			</Button>
			{#if data.canManage}
				<ConfirmAction
					action="?/confirmReceipt"
					fields={{ paymentId: receipt.id }}
					label="Confirm"
					icon={Check}
					title="Is {amount(receipt.amount)} ETB on the statement?"
					description="The order becomes paid: its receipt number, tickets and memberships are issued, and the buyer sees them on their order page."
					confirmLabel="Yes, it arrived"
				/>
				<Button
					size="sm"
					variant="ghost"
					class="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
					onclick={() => {
						rejectSeed = { paymentId: receipt.id };
						rejectOpen = true;
					}}
				>
					<X class="size-4" /> Reject
				</Button>
			{/if}
		{/snippet}
	</Notice>
{/each}
{#if data.receipts.length && data.canManage}
	<FormDialog
		title="Reject this receipt?"
		bind:open={rejectOpen}
		hideTrigger
		action="?/rejectReceipt"
		data={data.rejectForm}
		schema={rejectReceiptSchema}
		seed={rejectSeed as never}
		submitLabel="Reject receipt"
		submitVariant="destructive"
		description="The buyer reads the reason on their order page and can send another receipt. Ticket places stay held meanwhile."
	>
		{#snippet fields({ form, errors })}
			<input type="hidden" name="paymentId" value={rejectSeed.paymentId ?? ''} />
			<InputComp
				label="Reason"
				name="reason"
				placeholder="Amount does not match, not on the statement…"
				{form}
				{errors}
				required
			/>
		{/snippet}
	</FormDialog>
{/if}

{#if shortLines.length}
	<Notice tone="warning" title="Not enough bags on the shelf" class="mt-4">
		When this order was paid the shelves were short of {shortLines
			.map((l) => `${l.short} × ${l.description}`)
			.join(', ')}. Pack more and record the packing run, or refund what cannot be sent.
	</Notice>
{/if}

{#if o.status === 'cancelled'}
	<Notice tone="danger" title="Cancelled {formatDateTime(o.cancelledAt)}" class="mt-4">
		{o.cancelReason ?? 'No reason given.'}
	</Notice>
{/if}

<div class="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
	<StatCard
		amharicMoney={false}
		stat={{ key: 'total', label: 'Total', value: Number(o.total), format: 'money', group: 'order' }}
	/>
	<StatCard
		amharicMoney={false}
		stat={{
			key: 'paid',
			label: 'Paid',
			value: Number(o.amountPaid),
			format: 'money',
			group: 'order',
			tone: 'positive'
		}}
	/>
	<StatCard
		amharicMoney={false}
		stat={{
			key: 'refunded',
			label: 'Refunded',
			value: Number(o.amountRefunded),
			format: 'money',
			group: 'order',
			tone: Number(o.amountRefunded) ? 'negative' : 'neutral'
		}}
	/>
	<StatCard
		amharicMoney={false}
		stat={{
			key: 'balance',
			label: 'Still to pay',
			value: data.balance,
			format: 'money',
			group: 'order',
			tone: data.balance > 0 ? 'warning' : 'neutral'
		}}
	/>
</div>

<!-- Full width: the lines and their totals are what an order is, and in a side column the
     totals ran off its right edge. -->
<PageSection title="Lines" class="mt-6">
	<DataTable variant="compact" columns={lineColumns} data={data.lines} {summary} />
</PageSection>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6 xl:order-2">
		<PageSection title="Customer">
			<SingleTable
				singleTable={filled([
					{
						name: 'Customer',
						value: r.customer ?? o.contactName ?? 'Guest',
						href: href('customer', o.customerId)
					},
					o.contactName !== r.customer && { name: 'Contact', value: o.contactName ?? '—' },
					{ name: 'Phone', value: o.contactPhone ?? '—', kind: 'phone' },
					{ name: 'Email', value: o.contactEmail ?? '—' },
					{
						name: 'Business',
						value: r.business ?? o.customerBusinessName ?? '—',
						href: href('business', o.businessAccountId)
					},
					{ name: 'TIN', value: o.customerTin ?? '—' },
					{
						name: 'Membership',
						value: r.membershipNumber ?? '—',
						href: href('membership', o.membershipId)
					},
					{
						name: 'Discount code',
						value: r.discountCode ?? '—',
						href: href('discount', o.discountCodeId)
					},
					{ name: 'Language', value: languageName(o.locale) },
					{ name: 'Customer note', value: o.customerNote ?? '—', long: 40 }
				])}
			/>
		</PageSection>
		<PageSection title="Delivery">
			<!-- Only what this way of handing over has: a counter sale has no rider, courier or tracking. -->
			<SingleTable
				singleTable={filled([
					{ name: 'Method', value: deliveryName(method) },
					ships && { name: 'Zone', value: r.zone ?? '—' },
					{
						name: method === 'pickup' ? 'Pickup at' : method === 'none' ? 'Sold at' : 'From',
						value: data.place?.name ?? '—',
						href: href('location', data.place?.id)
					},
					method === 'pickup' && { name: 'Pickup code', value: o.pickupCode ?? '—' },
					ships &&
						o.deliveryAddress && {
							name: 'Address',
							value: [
								o.deliveryAddress.recipientName,
								o.deliveryAddress.line1,
								o.deliveryAddress.landmark,
								o.deliveryAddress.area,
								o.deliveryAddress.city
							]
								.filter(Boolean)
								.join(', '),
							long: 40
						},
					method === 'rider' && {
						name: 'Rider',
						value: r.rider ?? 'Not assigned',
						href: href('user', o.riderId)
					},
					method === 'courier' && { name: 'Courier', value: r.courier ?? 'Not chosen' },
					method === 'courier' && {
						name: 'Tracking',
						value: o.trackingNumber ?? 'Not entered',
						href: tracking
					},
					method !== 'none' && {
						name: 'Expected dispatch',
						value: formatDate(o.expectedDispatchOn)
					},
					ships && { name: 'Dispatched', value: formatDateTime(o.dispatchedAt) },
					{ name: 'Completed', value: formatDateTime(o.completedAt) },
					{ name: 'Staff note', value: o.staffNote ?? '—', long: 40 }
				])}
			/>
		</PageSection>
		<PageSection title="Record">
			<SingleTable
				singleTable={[
					...filled([
						{ name: 'Receipt no.', value: o.receiptNumber ?? '—' },
						{ name: 'Paid', value: formatDateTime(o.paidAt) },
						{ name: 'Pay link expires', value: formatDateTime(o.payTokenExpiresAt) },
						{ name: 'IP address', value: o.ipAddress ?? '—' }
					]),
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>
	</div>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6 xl:order-1">
		<PageSection title="Status history">
			{#if data.history.length}
				<DataTable variant="compact" columns={historyColumns} data={data.history} />
			{:else}<Empty message="No status changes yet" />{/if}
		</PageSection>
		<PageSection title="Payments">
			{#if data.payments.length}
				<DataTable variant="compact" columns={paymentColumns} data={data.payments} />
			{:else}<Empty message="No payments yet" />{/if}
		</PageSection>
		{#if data.refunds.length}
			<PageSection title="Refunds">
				<DataTable variant="compact" columns={refundColumns} data={data.refunds} />
			</PageSection>
		{/if}
		{#if data.invoices.length}
			<PageSection title="Invoices">
				<DataTable variant="compact" columns={invoiceColumns} data={data.invoices} />
			</PageSection>
		{/if}
		{#if data.tickets.length}
			<PageSection title="Tickets issued">
				<DataTable variant="compact" columns={ticketColumns} data={data.tickets} />
			</PageSection>
		{/if}
	</div>
</div>
