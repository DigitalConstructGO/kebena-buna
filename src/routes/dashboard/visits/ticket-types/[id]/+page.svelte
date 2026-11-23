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
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { amount, date, link, status } from '#lib/cells.ts';
	import { tr, yesNo } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { ticketTypeEditSchema } from '#lib/schemas/visits.ts';
	import TicketTypeFields from '../TicketTypeFields.svelte';

	let { data } = $props();
	const t = $derived(data.type);
	const href = useLinks();
	const count = (s: string) => data.byStatus.find((b) => b.status === s)?.tickets ?? 0;

	type Price = (typeof data.grid)[number];
	const priceColumns: ColumnDef<Price>[] = [
		{ id: 'audience', header: 'Audience', cell: ({ row }) => row.original.name },
		{ id: 'code', header: 'Code', cell: ({ row }) => row.original.code },
		{
			id: 'price',
			header: 'Price (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => (row.original.price === null ? 'Not sold' : amount(row.original.price))
		}
	];
	type Recent = (typeof data.recent)[number];
	const recentColumns: ColumnDef<Recent>[] = [
		{
			id: 'code',
			header: 'Ticket',
			cell: ({ row }) => link('ticket', row.original.id, row.original.code)
		},
		{ id: 'date', header: 'Visit', cell: ({ row }) => date(row.original.visitDate) },
		{ id: 'holder', header: 'Holder', cell: ({ row }) => row.original.holderName ?? '—' },
		{ id: 'audience', header: 'Audience', cell: ({ row }) => row.original.audience },
		{
			id: 'admits',
			header: 'Admits',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.admits
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
</script>

<PageHeader
	title={tr(t.name)}
	eyebrow={t.eventId ? 'Event ticket type' : 'Entry ticket type'}
	description={t.code}
>
	{#snippet badges()}
		<Statuses {...flag(t.isActive, 'On sale', 'Off sale')} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog
				title="Edit {tr(t.name)}"
				action="?/edit"
				data={data.editForm}
				schema={ticketTypeEditSchema}
			>
				{#snippet fields({ form, errors })}
					<InputComp type="hidden" name="id" {form} {errors} />
					<TicketTypeFields
						form={form as never}
						errors={errors as never}
						taxRates={data.taxRates}
						events={data.events}
					/>
				{/snippet}
			</FormDialog>
			<ConfirmAction
				action="?/delete"
				label="Delete"
				icon={Trash2}
				variant="destructive"
				title="Delete {tr(t.name)}?"
				description="Only a type no ticket was ever issued for can be deleted. Otherwise take it off sale (Edit, untick Active)."
			/>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
	<StatCard
		stat={{
			key: 'valid',
			label: 'Valid',
			value: count('valid'),
			format: 'count',
			group: 'type',
			tone: 'neutral'
		}}
	/>
	<StatCard
		stat={{
			key: 'used',
			label: 'Used',
			value: count('used'),
			format: 'count',
			group: 'type',
			tone: 'positive'
		}}
	/>
	<StatCard
		stat={{
			key: 'cancelled',
			label: 'Cancelled or refunded',
			value: count('cancelled') + count('refunded'),
			format: 'count',
			group: 'type',
			tone: 'negative'
		}}
	/>
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Ticket type">
			<SingleTable
				singleTable={[
					{ name: 'Name (English)', value: t.name?.en ?? '—' },
					{ name: 'Name (Amharic)', value: t.name?.am ?? '—' },
					{ name: 'Event', value: data.event ?? 'Museum entry', href: href('event', t.eventId) },
					{ name: 'Description', value: tr(t.description) || '—', long: 40 },
					{ name: 'Proof at the door', value: tr(t.requiresProof) || '—' },
					{ name: 'People per ticket', value: t.admitsPerTicket },
					{
						name: 'Per order',
						value: `${t.minQuantity}${t.maxQuantity ? `–${t.maxQuantity}` : '+'}`
					},
					{ name: 'Counts toward capacity', value: yesNo(t.countsTowardCapacity) },
					{ name: 'Staff only', value: yesNo(t.isStaffOnly) },
					{ name: 'Members only', value: yesNo(t.isMemberOnly) },
					{ name: 'VAT', value: data.taxRate ?? '—' },
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>
	</div>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection
			title="Prices"
			hint="A missing price means the type is not sold to that audience. Every change is in the audit log."
		>
			{#snippet actions()}
				<FormDialog
					title="Prices for {tr(t.name)}"
					triggerLabel="Edit prices"
					action="?/prices"
					data={data.priceForm}
					schema={undefined}
					disabled={!data.canManage}
				>
					{#snippet fields({ form, errors })}
						{#each data.grid as a (a.id)}
							<InputComp
								label="{a.name} (ETB)"
								name="p{a.id}"
								type="number"
								step="0.01"
								description="Empty: not sold to this audience."
								{form}
								{errors}
							/>
						{/each}
					{/snippet}
				</FormDialog>
			{/snippet}
			<DataTable variant="compact" columns={priceColumns} data={data.grid} />
		</PageSection>
		<PageSection title="Latest tickets">
			{#if data.recent.length}
				<DataTable variant="compact" columns={recentColumns} data={data.recent} />
			{:else}<Empty message="No tickets of this type yet" />{/if}
		</PageSection>
	</div>
</div>
