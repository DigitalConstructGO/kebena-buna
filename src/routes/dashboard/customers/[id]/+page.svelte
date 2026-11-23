<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserX from '@lucide/svelte/icons/user-x';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { amount, date, dateTime, flag, link, status, user } from '#lib/cells.ts';
	import { choicesOf, formatDateTime, humanize, money } from '#lib/format.ts';
	import { flag as flagBadge } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { CONTACT_CHANNELS, CREDIT_REASONS } from '#lib/constants.ts';
	import {
		addressEditSchema,
		addressSchema,
		consentSchema,
		creditSchema,
		customerEditSchema
	} from '#lib/schemas/customers.ts';
	import CustomerFields from '../CustomerFields.svelte';
	import AddressFields from './AddressFields.svelte';

	let { data } = $props();
	const c = $derived(data.customer);
	const href = useLinks();
	const title = $derived(c.anonymizedAt ? 'Anonymised customer' : (c.name ?? 'Guest'));

	type Address = (typeof data.addresses)[number];
	let editing = $state<Address | null>(null);
	let editOpen = $state(false);
	function editAddress(a: Address) {
		editing = a;
		editOpen = true;
	}
	const addressSeed = $derived(
		editing
			? {
					id: editing.id,
					label: editing.label,
					recipientName: editing.recipientName,
					phone: editing.phone,
					areaId: editing.areaId,
					city: editing.city,
					woreda: editing.woreda,
					line1: editing.line1,
					landmark: editing.landmark,
					latitude: editing.latitude,
					longitude: editing.longitude,
					isDefault: editing.isDefault
				}
			: undefined
	);

	type Consent = (typeof data.consents)[number];
	const consentColumns: ColumnDef<Consent>[] = [
		{ id: 'at', header: 'When', cell: ({ row }) => dateTime(row.original.recordedAt) },
		{ id: 'channel', header: 'Channel', cell: ({ row }) => row.original.channel.toUpperCase() },
		{ id: 'granted', header: 'Consent', cell: ({ row }) => flag(row.original.granted, 'Granted', 'Withdrawn') },
		{ id: 'source', header: 'Source', cell: ({ row }) => humanize(row.original.source) },
		{ id: 'by', header: 'Recorded by', cell: ({ row }) => user(row.original.recordedById, row.original.recordedBy) }
	];

	type Credit = (typeof data.credits)[number];
	const creditColumns: ColumnDef<Credit>[] = [
		{ id: 'at', header: 'When', cell: ({ row }) => dateTime(row.original.createdAt) },
		{ id: 'reason', header: 'Reason', cell: ({ row }) => humanize(row.original.reason) },
		{
			id: 'ref',
			header: 'For',
			cell: ({ row }) =>
				row.original.refType === 'order'
					? link('order', row.original.refId, `Order #${row.original.refId}`)
					: row.original.refType
						? `${humanize(row.original.refType)} ${row.original.refId ?? ''}`
						: (row.original.note ?? '—')
		},
		{ id: 'amount', header: 'Amount (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.amount) },
		{ id: 'expires', header: 'Expires', cell: ({ row }) => date(row.original.expiresAt) },
		{ id: 'by', header: 'By', cell: ({ row }) => user(row.original.createdById, row.original.createdBy) }
	];

	type Order = (typeof data.orders)[number];
	const orderColumns: ColumnDef<Order>[] = [
		{ id: 'number', header: 'Order', cell: ({ row }) => link('order', row.original.id, row.original.number) },
		{ id: 'placed', header: 'Placed', cell: ({ row }) => dateTime(row.original.placedAt) },
		{ id: 'channel', header: 'Channel', cell: ({ row }) => humanize(row.original.channel) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{ id: 'payment', header: 'Payment', cell: ({ row }) => status(row.original.paymentState) },
		{ id: 'total', header: 'Total (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.total) }
	];
	type Invoice = (typeof data.invoices)[number];
	const invoiceColumns: ColumnDef<Invoice>[] = [
		{ id: 'number', header: 'Invoice', cell: ({ row }) => link('invoice', row.original.id, row.original.number) },
		{ id: 'due', header: 'Due', cell: ({ row }) => date(row.original.dueOn) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{ id: 'total', header: 'Total (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.total) },
		{ id: 'paid', header: 'Paid (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.amountPaid) }
	];
	type Ticket = (typeof data.tickets)[number];
	const ticketColumns: ColumnDef<Ticket>[] = [
		{ id: 'code', header: 'Ticket', cell: ({ row }) => link('ticket', row.original.id, row.original.code) },
		{ id: 'date', header: 'Visit', cell: ({ row }) => date(row.original.visitDate) },
		{ id: 'type', header: 'Type', cell: ({ row }) => link('ticketType', row.original.ticketTypeId, row.original.ticketType) },
		{ id: 'admits', header: 'Checked in', meta: { align: 'right' }, cell: ({ row }) => `${row.original.checkedIn} / ${row.original.admits}` },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{ id: 'order', header: 'Order', cell: ({ row }) => (row.original.orderId ? link('order', row.original.orderId, `#${row.original.orderId}`) : '—') }
	];
	type Membership = (typeof data.memberships)[number];
	const membershipColumns: ColumnDef<Membership>[] = [
		{ id: 'number', header: 'Membership', cell: ({ row }) => link('membership', row.original.id, row.original.number) },
		{ id: 'plan', header: 'Plan', cell: ({ row }) => link('membershipPlan', row.original.planId, row.original.plan) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{ id: 'from', header: 'From', cell: ({ row }) => date(row.original.startsOn) },
		{ id: 'to', header: 'Until', cell: ({ row }) => date(row.original.endsOn) }
	];
	type Subscription = (typeof data.subscriptions)[number];
	const subscriptionColumns: ColumnDef<Subscription>[] = [
		{ id: 'number', header: 'Subscription', cell: ({ row }) => link('subscription', row.original.id, row.original.number) },
		{ id: 'coffee', header: 'Coffee', cell: ({ row }) => link('variant', row.original.variantId, row.original.product) },
		{ id: 'frequency', header: 'Every', cell: ({ row }) => humanize(row.original.frequency) },
		{ id: 'left', header: 'Deliveries left', meta: { align: 'right' }, cell: ({ row }) => row.original.left },
		{ id: 'next', header: 'Next roast', cell: ({ row }) => date(row.original.nextRoastDate) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
	type Booking = (typeof data.bookings)[number];
	const bookingColumns: ColumnDef<Booking>[] = [
		{ id: 'number', header: 'Booking', cell: ({ row }) => link('booking', row.original.id, row.original.number) },
		{ id: 'what', header: 'What', cell: ({ row }) => link('bookable', row.original.bookableId, row.original.bookable) },
		{ id: 'when', header: 'When', cell: ({ row }) => dateTime(row.original.confirmedStartsAt) },
		{ id: 'party', header: 'Party', meta: { align: 'right' }, cell: ({ row }) => row.original.partySize },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
	type Submission = (typeof data.submissions)[number];
	const submissionColumns: ColumnDef<Submission>[] = [
		{ id: 'subject', header: 'Submission', cell: ({ row }) => link('submission', row.original.id, row.original.subject ?? humanize(row.original.formType)) },
		{ id: 'type', header: 'Form', cell: ({ row }) => humanize(row.original.formType) },
		{ id: 'at', header: 'Sent', cell: ({ row }) => dateTime(row.original.submittedAt) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
	type Message = (typeof data.messages)[number];
	const messageColumns: ColumnDef<Message>[] = [
		{ id: 'key', header: 'Message', cell: ({ row }) => link('notification', row.original.id, row.original.templateKey) },
		{ id: 'channel', header: 'Channel', cell: ({ row }) => row.original.channel.toUpperCase() },
		{ id: 'to', header: 'To', cell: ({ row }) => row.original.recipient },
		{ id: 'at', header: 'Queued', cell: ({ row }) => dateTime(row.original.createdAt) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
	type Chat = (typeof data.chats)[number];
	const chatColumns: ColumnDef<Chat>[] = [
		{ id: 'chat', header: 'Conversation', cell: ({ row }) => link('conversation', row.original.id, `#${row.original.id}`) },
		{ id: 'channel', header: 'Channel', cell: ({ row }) => humanize(row.original.channel) },
		{ id: 'started', header: 'Started', cell: ({ row }) => dateTime(row.original.startedAt) },
		{ id: 'last', header: 'Last message', cell: ({ row }) => dateTime(row.original.lastMessageAt) },
		{ id: 'messages', header: 'Messages', meta: { align: 'right' }, cell: ({ row }) => row.original.messages }
	];
	type Business = (typeof data.businesses)[number];
	const businessColumns: ColumnDef<Business>[] = [
		{ id: 'name', header: 'Business', cell: ({ row }) => link('business', row.original.id, row.original.name) },
		{ id: 'type', header: 'Type', cell: ({ row }) => humanize(row.original.type) },
		{ id: 'role', header: 'Role', cell: ({ row }) => (row.original.isAdmin ? 'Administrator' : 'Orders for it') },
		{ id: 'status', header: 'Approval', cell: ({ row }) => status(row.original.approvalStatus) }
	];
</script>

<PageHeader title={title} eyebrow="Customer" description={c.businessName ?? (data.account ? 'Has a sign-in' : 'Guest')}>
	{#snippet badges()}
		{#if c.anonymizedAt}
			<Statuses status="neutral" label="Anonymised" />
		{:else}
			<Statuses {...flagBadge(c.isActive, 'Active', 'Switched off')} />
		{/if}
	{/snippet}
	{#snippet actions()}
		{#if data.canManage && !c.anonymizedAt}
			<FormDialog title="Edit {title}" action="?/edit" data={data.editForm} schema={customerEditSchema}>
				{#snippet fields({ form, errors })}
					<InputComp type="hidden" name="id" {form} {errors} />
					<CustomerFields form={form as never} errors={errors as never} />
					<InputComp
						label="Active"
						name="isActive"
						type="checkboxSingle"
						placeholder="Offered in pickers and messaged"
						description="Switch off a customer you no longer deal with: their history stays."
						{form}
						{errors}
					/>
				{/snippet}
			</FormDialog>
			<ConfirmAction
				action="?/anonymise"
				label="Anonymise"
				icon={UserX}
				variant="outline"
				title="Wipe {title}'s personal data?"
				description="Name, phone, email, TIN, notes and addresses are erased and the sign-in is unlinked. Orders, tickets and payments stay, with no name attached. This cannot be undone."
			/>
			<ConfirmAction
				action="?/delete"
				label="Delete"
				icon={Trash2}
				variant="destructive"
				title="Delete {title}?"
				description="Only a customer nothing names can be deleted. One with orders, tickets, memberships, bookings or credit is refused: switch them off or anonymise instead."
			/>
		{/if}
	{/snippet}
</PageHeader>

{#if c.anonymizedAt}
	<Notice tone="info" class="mt-4" title="Anonymised {formatDateTime(c.anonymizedAt)}">
		Their personal data was wiped. What they bought stays below for the books.
	</Notice>
{/if}

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard stat={{ key: 'orders', label: 'Orders', value: data.orders.length, format: 'count', group: 'customer' }} />
	<StatCard stat={{ key: 'spent', label: 'Spent, less refunds', value: data.spent, format: 'money', group: 'customer', tone: 'positive' }} />
	<StatCard stat={{ key: 'credit', label: 'Store credit', value: data.creditBalance, format: 'money', group: 'customer' }} />
	<StatCard stat={{ key: 'tickets', label: 'Tickets', value: data.tickets.length, format: 'count', group: 'customer' }} />
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Contact">
			<SingleTable
				singleTable={[
					{ name: 'Phone', value: c.phone ?? '—', kind: 'phone' },
					{ name: 'Email', value: c.email ?? '—' },
					{ name: 'Language', value: c.locale.toUpperCase() },
					{ name: 'TIN', value: c.tin ?? '—' },
					{ name: 'Business', value: c.businessName ?? '—' },
					{ name: 'Telegram', value: c.telegramChatId ?? '—' },
					{ name: 'Source', value: humanize(c.source) },
					{ name: 'Sign-in', value: data.account ? `${data.account.name} (${data.account.email})` : 'Guest — no sign-in', href: href('user', data.account?.id) },
					{ name: 'Last active', value: formatDateTime(c.lastActivityAt) },
					{ name: 'Notes', value: c.notes ?? '—', long: 40 },
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>

		<PageSection title="Addresses">
			{#snippet actions()}
				{#if data.canManage && !c.anonymizedAt}
					<FormDialog
						title="Add an address"
						triggerLabel="Add address" triggerIcon={Plus} submitIcon={Plus}
						action="?/addAddress"
						data={data.addressForm}
						schema={addressSchema}
						resetOnSuccess
					>
						{#snippet fields({ form, errors })}
							<AddressFields form={form as never} errors={errors as never} areas={data.areas} />
						{/snippet}
					</FormDialog>
				{/if}
			{/snippet}
			{#if data.addresses.length}
				<ul class="grid grid-cols-1 gap-3">
					{#each data.addresses as a (a.id)}
						<li class="rounded-lg border p-3">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="flex items-center gap-1.5 font-medium">
										<MapPin class="size-4 text-muted-foreground" />
										{a.label ?? 'Address'}
										{#if a.isDefault}<Statuses status="active" label="Default" />{/if}
									</p>
									<p class="text-sm">{a.line1}{a.landmark ? ` · ${a.landmark}` : ''}</p>
									<p class="text-sm text-muted-foreground">
										{[a.area, a.woreda, a.city].filter(Boolean).join(', ')}{a.zone ? ` — ${a.zone}` : ''}
									</p>
									{#if a.recipientName || a.phone}
										<p class="text-sm text-muted-foreground">{[a.recipientName, a.phone].filter(Boolean).join(' · ')}</p>
									{/if}
								</div>
								{#if data.canManage && !c.anonymizedAt}
									<div class="flex shrink-0 gap-1">
										<Button size="sm" variant="ghost" onclick={() => editAddress(a)}>
											<SquarePen class="size-4" /> Edit
										</Button>
										<ConfirmAction
											action="?/deleteAddress"
											label="Remove"
											variant="ghost"
											title="Remove this address?"
											description="Past orders keep the address they were delivered to."
											fields={{ id: a.id }}
										/>
									</div>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{:else}<Empty message="No addresses saved" />{/if}
			<FormDialog
				title="Edit address"
				action="?/editAddress"
				data={data.addressEditForm}
				schema={addressEditSchema}
				bind:open={editOpen}
				seed={addressSeed}
				hideTrigger
			>
				{#snippet fields({ form, errors })}
					<InputComp type="hidden" name="id" {form} {errors} />
					<AddressFields form={form as never} errors={errors as never} areas={data.areas} />
				{/snippet}
			</FormDialog>
		</PageSection>

		<PageSection title="Marketing consent" hint="Marketing goes only to a channel with a granted consent. No row: never asked.">
			{#snippet actions()}
				{#if data.canManage && !c.anonymizedAt}
					<FormDialog
						title="Record consent"
						triggerLabel="Record"
						action="?/consent"
						data={data.consentForm}
						schema={consentSchema}
						resetOnSuccess
					>
						{#snippet fields({ form, errors })}
							<InputComp label="Channel" name="channel" type="select" items={CONTACT_CHANNELS.map((v) => ({ value: v, name: v.toUpperCase() }))} {form} {errors} required />
							<InputComp label="Consent" name="granted" type="radio" items={[{ value: 'granted', name: 'Granted' }, { value: 'withdrawn', name: 'Withdrawn' }]} {form} {errors} required />
							<InputComp label="How it was given" name="source" placeholder="phone call, desk form, email reply…" {form} {errors} required />
						{/snippet}
					</FormDialog>
				{/if}
			{/snippet}
			<SingleTable
				singleTable={data.consentNow.map((x) => ({
					name: x.channel.toUpperCase(),
					value: x.granted === null ? 'neutral' : x.granted ? 'active' : 'inactive',
					label: x.granted === null ? 'Never asked' : x.granted ? `Granted ${formatDateTime(x.at)}` : `Withdrawn ${formatDateTime(x.at)}`,
					kind: 'status' as const
				}))}
			/>
			{#if data.consents.length}
				<div class="mt-4">
					<DataTable variant="compact" columns={consentColumns} data={data.consents} />
				</div>
			{/if}
		</PageSection>
	</div>

	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Store credit" hint="Balance {money(data.creditBalance)} — expired lines no longer count.">
			{#snippet actions()}
				{#if data.canManage && !c.anonymizedAt}
					<FormDialog
						title="Credit or debit store credit"
						triggerLabel="Add credit" triggerIcon={Plus} submitIcon={Plus}
						action="?/credit"
						data={data.creditForm}
						schema={creditSchema}
						resetOnSuccess
					>
						{#snippet fields({ form, errors })}
							<InputComp label="Direction" name="direction" type="radio" items={[{ value: 'credit', name: 'Credit (give)' }, { value: 'debit', name: 'Debit (take back)' }]} {form} {errors} required />
							<InputComp label="Amount (ETB)" name="amount" type="number" step="0.01" {form} {errors} required />
							<InputComp label="Reason" name="reason" type="select" items={choicesOf(CREDIT_REASONS)} {form} {errors} required />
							<InputComp label="Expires" name="expiresAt" type="date" futureDays {form} {errors} />
							<InputComp label="Note" name="note" {form} {errors} />
						{/snippet}
					</FormDialog>
				{/if}
			{/snippet}
			{#if data.credits.length}
				<DataTable variant="compact" columns={creditColumns} data={data.credits} />
			{:else}<Empty message="No store credit" />{/if}
		</PageSection>

		<PageSection title="Orders">
			{#if data.orders.length}
				<DataTable variant="compact" columns={orderColumns} data={data.orders} />
			{:else}<Empty message="No orders yet" />{/if}
		</PageSection>
		{#if data.invoices.length}
			<PageSection title="Invoices">
				<DataTable variant="compact" columns={invoiceColumns} data={data.invoices} />
			</PageSection>
		{/if}
		{#if data.tickets.length}
			<PageSection title="Tickets">
				<DataTable variant="compact" columns={ticketColumns} data={data.tickets} />
			</PageSection>
		{/if}
		{#if data.memberships.length}
			<PageSection title="Memberships">
				<DataTable variant="compact" columns={membershipColumns} data={data.memberships} />
			</PageSection>
		{/if}
		{#if data.subscriptions.length}
			<PageSection title="Subscriptions">
				<DataTable variant="compact" columns={subscriptionColumns} data={data.subscriptions} />
			</PageSection>
		{/if}
		{#if data.bookings.length}
			<PageSection title="Bookings">
				<DataTable variant="compact" columns={bookingColumns} data={data.bookings} />
			</PageSection>
		{/if}
		{#if data.businesses.length}
			<PageSection title="Business accounts">
				<DataTable variant="compact" columns={businessColumns} data={data.businesses} />
			</PageSection>
		{/if}
		{#if data.submissions.length}
			<PageSection title="Form submissions">
				<DataTable variant="compact" columns={submissionColumns} data={data.submissions} />
			</PageSection>
		{/if}
		{#if data.chats.length}
			<PageSection title="AI agent conversations">
				<DataTable variant="compact" columns={chatColumns} data={data.chats} />
			</PageSection>
		{/if}
		{#if data.messages.length}
			<PageSection title="Messages sent" hint="The latest 30 from the outbox.">
				<DataTable variant="compact" columns={messageColumns} data={data.messages} />
			</PageSection>
		{/if}
	</div>
</div>
