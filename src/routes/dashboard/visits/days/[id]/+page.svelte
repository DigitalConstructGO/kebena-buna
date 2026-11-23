<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import RowButton from '@nahu/admin-kit/components/RowButton.svelte';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { localClock } from '@nahu/admin-kit/time';
	import { flag as flagCell, link, status } from '#lib/cells.ts';
	import { formatDate, tr } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { dayEditSchema, slotEditSchema } from '#lib/schemas/visits.ts';

	let { data } = $props();
	const d = $derived(data.day);
	const href = useLinks();
	const checkedIn = $derived(data.slots.reduce((sum, s) => sum + s.checkedIn, 0));

	type Slot = (typeof data.slots)[number];
	let slotOpen = $state(false);
	let slotSeed = $state<{ slotId: number; capacity: number; isClosed: boolean }>();
	let slotTitle = $state('');
	const time = (s: Slot) => `${localClock(s.startsAt)}–${localClock(s.endsAt)}`;
	function editSlot(s: Slot) {
		slotSeed = { slotId: s.id, capacity: s.capacity, isClosed: s.isClosed };
		slotTitle = `Slot ${time(s)}`;
		slotOpen = true;
	}

	const slotColumns: ColumnDef<Slot>[] = [
		{
			id: 'time',
			header: 'Slot',
			cell: ({ row }) =>
				data.canManage
					? renderComponent(RowButton, {
							label: time(row.original),
							onclick: () => editSlot(row.original)
						})
					: time(row.original)
		},
		{
			id: 'capacity',
			header: 'Capacity',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.capacity
		},
		{ id: 'sold', header: 'Sold', meta: { align: 'right' }, cell: ({ row }) => row.original.sold },
		{ id: 'held', header: 'Held', meta: { align: 'right' }, cell: ({ row }) => row.original.held },
		{
			id: 'free',
			header: 'Free',
			meta: { align: 'right' },
			cell: ({ row }) =>
				row.original.isClosed ? 0 : row.original.capacity - row.original.sold - row.original.held
		},
		{
			id: 'checkedIn',
			header: 'Checked in',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.checkedIn
		},
		{
			id: 'open',
			header: 'Status',
			cell: ({ row }) => flagCell(!row.original.isClosed, 'Open', 'Closed')
		}
	];

	type Ticket = (typeof data.tickets)[number];
	const ticketColumns: ColumnDef<Ticket>[] = [
		{
			id: 'code',
			header: 'Ticket',
			cell: ({ row }) => link('ticket', row.original.id, row.original.code)
		},
		{ id: 'slot', header: 'Slot', cell: ({ row }) => localClock(row.original.slotStart) },
		{
			id: 'type',
			header: 'Type',
			cell: ({ row }) => link('ticketType', row.original.typeId, row.original.type)
		},
		{
			id: 'audience',
			header: 'Audience',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => row.original.audience
		},
		{
			id: 'holder',
			header: 'Holder',
			cell: ({ row }) =>
				row.original.customerId
					? link(
							'customer',
							row.original.customerId,
							row.original.customer ?? row.original.holderName
						)
					: (row.original.holderName ?? '—')
		},
		{
			id: 'admits',
			header: 'In / admits',
			meta: { align: 'right' },
			cell: ({ row }) => `${row.original.checkedIn} / ${row.original.admits}`
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
</script>

<PageHeader title={formatDate(d.date)} eyebrow="Visit day" description={data.location}>
	{#snippet badges()}
		<Statuses {...flag(!d.isClosed, 'Open', 'Closed')} />
	{/snippet}
	{#snippet actions()}
		<FormDialog
			title="Edit {formatDate(d.date)}"
			action="?/day"
			data={data.dayForm}
			schema={dayEditSchema}
			disabled={!data.canManage}
		>
			{#snippet fields({ form, errors })}
				<InputComp type="hidden" name="id" {form} {errors} />
				<InputComp
					label="Day capacity"
					name="capacity"
					type="number"
					min={0}
					{form}
					{errors}
					required
				/>
				<InputComp
					label="Closed"
					name="isClosed"
					type="checkboxSingle"
					placeholder="Closed: closes every slot of the day"
					{form}
					{errors}
				/>
				<InputComp label="Why it is closed (English)" name="closedReasonEn" {form} {errors} />
				<InputComp label="Why it is closed (Amharic)" name="closedReasonAm" {form} {errors} />
				<InputComp label="Why it is closed (Afaan Oromo)" name="closedReasonOm" {form} {errors} />
				<InputComp label="Why it is closed (Arabic)" name="closedReasonAr" {form} {errors} />
				<InputComp label="Why it is closed (Italian)" name="closedReasonIt" {form} {errors} />
				<InputComp label="Why it is closed (French)" name="closedReasonFr" {form} {errors} />
			{/snippet}
		</FormDialog>
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
	<StatCard
		stat={{ key: 'capacity', label: 'Capacity', value: d.capacity, format: 'count', group: 'day' }}
	/>
	<StatCard
		stat={{
			key: 'sold',
			label: 'Sold',
			value: d.sold,
			format: 'count',
			group: 'day',
			tone: 'positive'
		}}
	/>
	<StatCard
		stat={{
			key: 'held',
			label: 'Held for groups',
			value: d.held,
			format: 'count',
			group: 'day',
			tone: d.held ? 'warning' : 'neutral'
		}}
	/>
	<StatCard
		stat={{ key: 'in', label: 'Checked in', value: checkedIn, format: 'count', group: 'day' }}
	/>
</div>

<FormDialog
	title={slotTitle}
	action="?/slot"
	data={data.slotForm}
	schema={slotEditSchema}
	bind:open={slotOpen}
	seed={slotSeed}
	hideTrigger
>
	{#snippet fields({ form, errors })}
		<InputComp type="hidden" name="slotId" {form} {errors} />
		<InputComp label="Capacity" name="capacity" type="number" min={0} {form} {errors} required />
		<InputComp
			label="Closed"
			name="isClosed"
			type="checkboxSingle"
			placeholder="Closed: nothing more is sold for it"
			{form}
			{errors}
		/>
	{/snippet}
</FormDialog>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
	<PageSection title="Day">
		<SingleTable
			singleTable={[
				{ name: 'Location', value: data.location, href: href('location', d.locationId) },
				{ name: 'Free places', value: d.isClosed ? 0 : d.capacity - d.sold - d.held },
				{ name: 'Closed because', value: tr(d.closedReason) || '—' },
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection
			title="Slots"
			hint={data.canManage ? 'Click a slot to change its capacity or close it.' : undefined}
		>
			{#if data.slots.length}
				<DataTable variant="compact" columns={slotColumns} data={data.slots} defaultPageSize={20} />
			{:else}<Empty message="This day has no slots" />{/if}
		</PageSection>
		<PageSection title="Tickets">
			{#if data.tickets.length}
				<DataTable columns={ticketColumns} data={data.tickets} fileName="Tickets {d.date}" />
			{:else}<Empty message="No tickets for this day yet" />{/if}
		</PageSection>
	</div>
</div>
