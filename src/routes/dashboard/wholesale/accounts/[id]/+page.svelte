<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
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
	import { fileUrl } from '@nahu/admin-kit/files';
	import { amount, date, dateTime, link, phone, status } from '#lib/cells.ts';
	import { formatDateTime, humanize, kg, money, pct } from '#lib/format.ts';
	import { badge, flag as flagBadge } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import {
		accountEditSchema,
		businessAddressEditSchema,
		businessAddressSchema,
		decisionSchema,
		memberSchema,
		termsSchema
	} from '#lib/schemas/wholesale.ts';
	import AccountFields from '../AccountFields.svelte';
	import BusinessAddressFields from './BusinessAddressFields.svelte';

	let { data } = $props();
	const a = $derived(data.account);
	const href = useLinks();

	type Address = (typeof data.addresses)[number];
	let editing = $state<Address | null>(null);
	let editOpen = $state(false);
	const addressSeed = $derived(
		editing
			? {
					id: editing.id,
					label: editing.label,
					areaId: editing.areaId,
					city: editing.city,
					line1: editing.line1,
					landmark: editing.landmark,
					latitude: editing.latitude,
					longitude: editing.longitude,
					isBilling: editing.isBilling,
					isDefaultDelivery: editing.isDefaultDelivery
				}
			: undefined
	);

	type Member = (typeof data.members)[number];
	const memberColumns: ColumnDef<Member>[] = $derived([
		{ id: 'name', header: 'Person', cell: ({ row }) => link('customer', row.original.customerId, row.original.name ?? 'Customer') },
		{ id: 'phone', header: 'Phone', cell: ({ row }) => phone(row.original.phone) },
		{ id: 'role', header: 'Role', cell: ({ row }) => (row.original.isAdmin ? 'Administrator' : 'Orders for it') },
		...(data.canManage
			? [
					{
						id: 'admin',
						header: '',
						cell: ({ row }: { row: { original: Member } }) =>
							renderComponent(ConfirmAction, {
								action: '?/toggleAdmin',
								label: row.original.isAdmin ? 'Make orderer' : 'Make admin',
								variant: 'ghost',
								title: row.original.isAdmin
									? `${row.original.name} stops administering the account?`
									: `Let ${row.original.name} administer the account?`,
								description: 'Administrators add and remove the people who order for the business.',
								fields: { id: row.original.id, isAdmin: row.original.isAdmin ? '0' : '1' }
							})
					},
					{
						id: 'remove',
						header: '',
						cell: ({ row }: { row: { original: Member } }) =>
							renderComponent(ConfirmAction, {
								action: '?/removeMember',
								label: 'Remove',
								variant: 'ghost',
								title: `Remove ${row.original.name} from ${a.name}?`,
								description: 'They keep their own customer account and history.',
								fields: { id: row.original.id }
							})
					}
				]
			: [])
	]);
	type Order = (typeof data.orders)[number];
	const orderColumns: ColumnDef<Order>[] = [
		{ id: 'number', header: 'Order', cell: ({ row }) => link('order', row.original.id, row.original.number) },
		{ id: 'placed', header: 'Placed', cell: ({ row }) => dateTime(row.original.placedAt) },
		{ id: 'by', header: 'Ordered by', cell: ({ row }) => link('customer', row.original.customerId, row.original.customer) },
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
		{ id: 'balance', header: 'Balance (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.balance) }
	];
</script>

<PageHeader title={a.name} eyebrow="Business account" description={`${humanize(a.type)} · TIN ${a.tin}`}>
	{#snippet badges()}
		<Statuses {...badge(a.approvalStatus)} />
		<Statuses {...flagBadge(a.isActive, 'Active', 'Switched off')} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			{#if data.canRelease}
				<FormDialog
					title="Decide {a.name}'s application"
					triggerLabel={a.approvalStatus === 'pending' ? 'Approve or reject' : 'Change decision'}
					action="?/decide"
					data={data.decisionForm}
					schema={decisionSchema}
					description={data.releaseOverrides
						? 'You entered this application. As a super admin you may still decide it; the record will say so.'
						: 'Approved accounts see wholesale prices and can order.'}
				>
					{#snippet fields({ form, errors })}
						<InputComp label="Decision" name="decision" type="radio" items={[{ value: 'approve', name: 'Approve' }, { value: 'reject', name: 'Reject' }]} {form} {errors} required />
						<InputComp label="Reason (needed to reject)" name="reason" type="textarea" rows={3} {form} {errors} />
					{/snippet}
				</FormDialog>
			{/if}
			<FormDialog title="Credit and discount terms" triggerLabel="Terms" action="?/terms" data={data.termsForm} schema={termsSchema}>
				{#snippet fields({ form, errors })}
					<InputComp label="Extra discount (%)" name="discountPct" type="number" step="0.01" description="On top of the quantity tier." {form} {errors} />
					<InputComp label="Minimum order (kg)" name="minOrderKg" type="number" step="0.001" description="Leave empty to use the shop default from Admin › Settings." {form} {errors} />
					<InputComp label="Credit approved" name="creditApproved" type="checkboxSingle" placeholder="May order on invoice (an exception)" {form} {errors} />
					<InputComp label="Credit limit (ETB)" name="creditLimit" type="number" step="0.01" {form} {errors} />
					<InputComp label="Payment terms (days)" name="paymentTermsDays" type="number" {form} {errors} />
				{/snippet}
			</FormDialog>
			<FormDialog title="Edit {a.name}" action="?/edit" data={data.editForm} schema={accountEditSchema} multipart>
				{#snippet fields({ form, errors })}
					<InputComp type="hidden" name="id" {form} {errors} />
					<AccountFields form={form as never} errors={errors as never} storedLicence={a.tradeLicenceFile} />
					<InputComp label="Active" name="isActive" type="checkboxSingle" placeholder="May sign in and order" {form} {errors} />
				{/snippet}
			</FormDialog>
			<ConfirmAction
				action="?/delete"
				label="Delete"
				icon={Trash2}
				variant="destructive"
				title="Delete {a.name}?"
				description="Only a business with no orders can be deleted; one that has ordered is switched off instead."
			/>
		{/if}
	{/snippet}
</PageHeader>

{#if a.approvalStatus === 'pending'}
	<Notice tone="warning" class="mt-4" title="Awaiting approval">
		Entered {formatDateTime(a.createdAt)}{data.people.requestedBy ? ` by ${data.people.requestedBy}` : ''}. Until approved
		they see retail prices only.
	</Notice>
{:else if a.approvalStatus === 'rejected'}
	<Notice tone="danger" class="mt-4" title="Rejected {formatDateTime(a.rejectedAt)}">
		{a.rejectionReason ?? 'No reason recorded.'}
	</Notice>
{/if}

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard stat={{ key: 'orders', label: 'Orders', value: data.orders.length, format: 'count', group: 'business' }} />
	<StatCard stat={{ key: 'owed', label: 'Owed on open invoices', value: data.owed, format: 'money', group: 'business', tone: data.owed > Number(a.creditLimit) && a.creditApproved ? 'negative' : 'neutral' }} />
	<StatCard stat={{ key: 'limit', label: 'Credit limit', value: Number(a.creditApproved ? a.creditLimit : 0), format: 'money', group: 'business' }} />
	<StatCard stat={{ key: 'discount', label: 'Extra discount', value: Number(a.discountPct), format: 'percent', group: 'business' }} />
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Business">
			<SingleTable
				singleTable={[
					{ name: 'Type', value: humanize(a.type) },
					{ name: 'Trade licence', value: a.tradeLicenceNumber },
					{ name: 'Licence file', value: a.tradeLicenceFile ? 'View' : 'Not uploaded', href: a.tradeLicenceFile ? fileUrl(a.tradeLicenceFile) : null },
					{ name: 'TIN', value: a.tin },
					{ name: 'VAT number', value: a.vatNumber ?? '—' },
					{ name: 'Contact', value: a.contactName },
					{ name: 'Phone', value: a.contactPhone, kind: 'phone' },
					{ name: 'Email', value: a.contactEmail ?? '—' },
					{ name: 'Expected / month', value: a.expectedMonthlyKg ? kg(a.expectedMonthlyKg) : '—' },
					{ name: 'Notes', value: a.notes ?? '—', long: 40 }
				]}
			/>
		</PageSection>
		<PageSection title="Terms">
			<SingleTable
				singleTable={[
					{ name: 'Extra discount', value: pct(a.discountPct) },
					{ name: 'Minimum order', value: a.minOrderKg ? kg(a.minOrderKg) : 'Setting' },
					{ name: 'Credit', value: a.creditApproved ? 'active' : 'neutral', label: a.creditApproved ? 'Approved' : 'Prepaid only', kind: 'status' },
					{ name: 'Credit limit', value: a.creditApproved ? money(a.creditLimit) : '—' },
					{ name: 'Payment terms', value: a.creditApproved ? `${a.paymentTermsDays} days` : '—' }
				]}
			/>
		</PageSection>
		<PageSection title="Approval">
			<SingleTable
				singleTable={[
					{ name: 'Status', value: a.approvalStatus, label: humanize(a.approvalStatus), kind: 'status' },
					{ name: 'Entered by', value: data.people.requestedBy ?? '—', href: href('user', a.requestedBy) },
					{ name: 'Approved by', value: data.people.approvedBy ?? '—', href: href('user', a.approvedBy) },
					{ name: 'Approved', value: formatDateTime(a.approvedAt) },
					{ name: 'Rejected by', value: data.people.rejectedBy ?? '—', href: href('user', a.rejectedBy) },
					{ name: 'Rejected', value: formatDateTime(a.rejectedAt) },
					{ name: 'Reason', value: a.rejectionReason ?? '—', long: 40 },
					{ name: 'Overridden', value: a.approvalOverridden ? 'Yes — decided by the person who entered it' : 'No' },
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>
	</div>

	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="People who order" hint="Customers who may order for this business.">
			{#snippet actions()}
				{#if data.canManage}
					<FormDialog title="Add a person" triggerLabel="Add person" triggerIcon={Plus} submitIcon={Plus} action="?/addMember" data={data.memberForm} schema={memberSchema} resetOnSuccess>
						{#snippet fields({ form, errors })}
							<InputComp label="Customer" name="customerId" type="combo" items={data.customers} {form} {errors} required />
							<InputComp label="Administrator" name="isAdmin" type="checkboxSingle" placeholder="May add and remove people" {form} {errors} />
						{/snippet}
					</FormDialog>
				{/if}
			{/snippet}
			{#if data.members.length}
				<DataTable variant="compact" columns={memberColumns} data={data.members} />
			{:else}<Empty message="Nobody orders for it yet" />{/if}
		</PageSection>

		<PageSection title="Addresses">
			{#snippet actions()}
				{#if data.canManage}
					<FormDialog title="Add an address" triggerLabel="Add address" triggerIcon={Plus} submitIcon={Plus} action="?/addAddress" data={data.addressForm} schema={businessAddressSchema} resetOnSuccess>
						{#snippet fields({ form, errors })}
							<BusinessAddressFields form={form as never} errors={errors as never} areas={data.areas} />
						{/snippet}
					</FormDialog>
				{/if}
			{/snippet}
			{#if data.addresses.length}
				<ul class="grid grid-cols-1 gap-3 md:grid-cols-2">
					{#each data.addresses as ad (ad.id)}
						<li class="rounded-lg border p-3">
							<p class="flex flex-wrap items-center gap-1.5 font-medium">
								<MapPin class="size-4 text-muted-foreground" />
								{ad.label ?? 'Address'}
								{#if ad.isBilling}<Statuses status="ready" label="Billing" />{/if}
								{#if ad.isDefaultDelivery}<Statuses status="active" label="Default delivery" />{/if}
							</p>
							<p class="text-sm">{ad.line1}{ad.landmark ? ` · ${ad.landmark}` : ''}</p>
							<p class="text-sm text-muted-foreground">
								{[ad.area, ad.city].filter(Boolean).join(', ')}{ad.zone ? ` — ${ad.zone}` : ''}
							</p>
							{#if data.canManage}
								<div class="mt-2 flex gap-1">
									<Button size="sm" variant="ghost" onclick={() => { editing = ad; editOpen = true; }}>
										<SquarePen class="size-4" /> Edit
									</Button>
									<ConfirmAction action="?/deleteAddress" label="Remove" variant="ghost" title="Remove this address?" description="Past orders keep the address they were delivered to." fields={{ id: ad.id }} />
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}<Empty message="No addresses yet" />{/if}
			<FormDialog title="Edit address" action="?/editAddress" data={data.addressEditForm} schema={businessAddressEditSchema} bind:open={editOpen} seed={addressSeed} hideTrigger>
				{#snippet fields({ form, errors })}
					<InputComp type="hidden" name="id" {form} {errors} />
					<BusinessAddressFields form={form as never} errors={errors as never} areas={data.areas} />
				{/snippet}
			</FormDialog>
		</PageSection>

		<PageSection title="Orders">
			{#if data.orders.length}
				<DataTable variant="compact" columns={orderColumns} data={data.orders} />
			{:else}<Empty message="No orders yet" />{/if}
		</PageSection>
		<PageSection title="Invoices">
			{#if data.invoices.length}
				<DataTable variant="compact" columns={invoiceColumns} data={data.invoices} />
			{:else}<Empty message="No invoices yet" />{/if}
		</PageSection>
	</div>
</div>
