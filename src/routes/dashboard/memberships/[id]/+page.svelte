<script lang="ts">
	import Ban from '@lucide/svelte/icons/ban';
	import type { ColumnDef } from '@tanstack/table-core';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { date, dateTime, link, status, user } from '#lib/cells.ts';
	import { choicesOf, formatDate, humanize, money } from '#lib/format.ts';
	import { badge } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { MEMBERSHIP_STATUSES, RENEWAL_METHODS } from '#lib/constants.ts';
	import {
		cancelSchema,
		memberEditSchema,
		memberSchema,
		membershipTermSchema
	} from '#lib/schemas/memberships.ts';

	let { data } = $props();
	const m = $derived(data.membership);
	const href = useLinks();
	const memberName = $derived(
		Object.fromEntries(
			data.members.rows.map((r) => [r.id, String((r as Record<string, unknown>).name)])
		)
	);

	type Scan = (typeof data.scans)[number];
	const scanColumns: ColumnDef<Scan>[] = [
		{ id: 'at', header: 'Scanned', cell: ({ row }) => dateTime(row.original.scannedAt) },
		{ id: 'member', header: 'Member', cell: ({ row }) => memberName[row.original.memberId ?? 0] ?? '—' },
		{ id: 'result', header: 'Result', cell: ({ row }) => status(row.original.result) },
		{ id: 'headcount', header: 'People', meta: { align: 'right' }, cell: ({ row }) => row.original.headcount },
		{ id: 'location', header: 'Where', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'by', header: 'By', cell: ({ row }) => user(row.original.scannedById, row.original.scannedBy) }
	];
	type Sub = (typeof data.subscriptions)[number];
	const subColumns: ColumnDef<Sub>[] = [
		{ id: 'number', header: 'Subscription', cell: ({ row }) => link('subscription', row.original.id, row.original.number) },
		{ id: 'sku', header: 'Coffee', cell: ({ row }) => row.original.sku },
		{ id: 'frequency', header: 'Every', cell: ({ row }) => humanize(row.original.frequency) },
		{ id: 'next', header: 'Next roast', cell: ({ row }) => date(row.original.nextRoastDate) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
</script>

<PageHeader title={m.number} eyebrow="Membership" description={`${data.customer ?? 'Customer'} · ${data.plan}`}>
	{#snippet badges()}
		<Statuses {...badge(m.status)} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog title="Edit {m.number}" triggerLabel="Edit term" action="?/term" data={data.termForm} schema={membershipTermSchema}>
				{#snippet fields({ form, errors })}
					<InputComp label="Plan" name="planId" type="select" items={data.plans} {form} {errors} required />
					<InputComp label="Status" name="status" type="select" items={choicesOf(MEMBERSHIP_STATUSES)} {form} {errors} required />
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<InputComp label="Starts" name="startsOn" type="date" futureDays {form} {errors} />
						<InputComp label="Ends" name="endsOn" type="date" futureDays {form} {errors} />
						<InputComp label="Grace ends" name="graceEndsOn" type="date" futureDays {form} {errors} />
					</div>
					<InputComp label="Renews by" name="renewalMethod" type="select" items={choicesOf(RENEWAL_METHODS)} {form} {errors} />
				{/snippet}
			</FormDialog>
			{#if m.status === 'pending_payment' || m.status === 'grace' || m.status === 'lapsed'}
				<ConfirmAction
					action="?/activate"
					label="Mark paid & active"
					icon={BadgeCheck}
					title="Activate {m.number}?"
					description="For a payment taken by hand (desk or bank transfer). A term with no dates, or one already over, starts today."
				/>
			{/if}
			{#if m.status !== 'pending_payment' && m.status !== 'cancelled' && !data.renewedBy.some((r) => r.status !== 'cancelled')}
				<ConfirmAction
					action="?/renew"
					label="Renew"
					icon={RefreshCw}
					variant="outline"
					title="Renew {m.number}?"
					description="Creates the next {data.planMonths}-month term, awaiting payment, starting the day after this one ends. Its members are carried over with new cards."
				/>
			{/if}
			{#if m.status !== 'cancelled'}
				<FormDialog title="Cancel {m.number}" triggerLabel="Cancel" triggerIcon={Ban} submitIcon={Ban} submitVariant="destructive" action="?/cancel" data={data.cancelForm} schema={cancelSchema} submitLabel="Cancel membership">
					{#snippet fields({ form, errors })}
						<InputComp label="Reason" name="reason" type="textarea" rows={3} {form} {errors} required />
					{/snippet}
				</FormDialog>
			{/if}
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Term">
			<SingleTable
				singleTable={[
					{ name: 'Customer', value: data.customer ?? '—', href: href('customer', m.customerId) },
					{ name: 'Phone', value: data.customerPhone, kind: 'phone' },
					{ name: 'Plan', value: `${data.plan} · ${money(data.planPrice)}`, href: href('membershipPlan', m.planId) },
					{ name: 'Status', value: m.status, kind: 'status', label: humanize(m.status) },
					{ name: 'Starts', value: formatDate(m.startsOn) },
					{ name: 'Ends', value: formatDate(m.endsOn) },
					{ name: 'Grace ends', value: formatDate(m.graceEndsOn) },
					{ name: 'Renews by', value: humanize(m.renewalMethod) },
					{ name: 'Paid on order', value: data.orderNumber ?? '—', href: href('order', data.orderId) },
					{ name: 'Renews', value: data.renews?.number ?? '—', href: href('membership', data.renews?.id) },
					...data.renewedBy.map((r) => ({ name: 'Renewed by', value: `${r.number} (${humanize(r.status)})`, href: href('membership', r.id) })),
					...(m.cancelledAt
						? [
								{ name: 'Cancelled', value: formatDate(m.cancelledAt) },
								{ name: 'Reason', value: m.cancelReason ?? '—', long: 40 }
							]
						: []),
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>
	</div>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Members" hint="Each named person carries their own card QR.">
			<LookupSection
				config={{
					entity: 'Member',
					plural: 'Members',
					fields: [
						{ name: 'name', label: 'Name', type: 'text' },
						{ name: 'cardCode', label: 'Card code', type: 'text', inForm: false },
						{ name: 'isChild', label: 'Child', type: 'checkbox', trueLabel: 'Child', falseLabel: 'Adult' },
						{ name: 'birthYear', label: 'Birth year', type: 'number', required: false },
						{ name: 'photo', label: 'Photo', type: 'image', required: false },
						{ name: 'status', label: 'Card', type: 'boolean', trueLabel: 'Valid', falseLabel: 'Blocked', inTable: true }
					]
				}}
				rows={data.members.rows as never}
				addForm={data.members.addForm}
				editForm={data.members.editForm}
				canDelete={data.canManage}
				readonly={!data.canManage}
				schemas={{ add: memberSchema, edit: memberEditSchema }}
				actions={{ add: '?/addMember', edit: '?/editMember', delete: '?/deleteMember' }}
			/>
		</PageSection>
		<PageSection title="Card scans" hint="Entries on this membership's cards.">
			{#if data.scans.length}
				<DataTable variant="compact" columns={scanColumns} data={data.scans} />
			{:else}<Empty message="No card has been scanned yet" />{/if}
		</PageSection>
		{#if data.subscriptions.length}
			<PageSection title="Monthly coffee" hint="The Patron's bag, sent through the subscription engine.">
				<DataTable variant="compact" columns={subColumns} data={data.subscriptions} />
			</PageSection>
		{/if}
	</div>
</div>
