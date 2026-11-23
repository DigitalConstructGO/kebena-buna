<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import { useKit } from '@nahu/admin-kit/context';
	import { date, dateTime, flag as flagCell, kg, link } from '#lib/cells.ts';
	import { humanize, tr, yesNo } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { locationSchema } from '#lib/schemas/admin.ts';
	import LocationFields from '../LocationFields.svelte';
	import HoursEditor from './HoursEditor.svelte';

	let { data } = $props();
	const l = $derived(data.location);
	const href = useLinks();
	const kit = useKit();
	const canEdit = $derived(kit.canOpen('/dashboard/admin/locations'));

	type Child = (typeof data.children)[number];
	const childColumns: ColumnDef<Child>[] = [
		{
			id: 'name',
			header: 'Location',
			cell: ({ row }) => link('location', row.original.id, row.original.name)
		},
		{ id: 'type', header: 'Type', cell: ({ row }) => humanize(row.original.type) }
	];
	type Machine = (typeof data.machines)[number];
	const machineColumns: ColumnDef<Machine>[] = [
		{ id: 'name', accessorKey: 'name', header: 'Machine' },
		{
			id: 'cap',
			header: 'Capacity',
			meta: { align: 'right' },
			cell: ({ row }) => kg(row.original.capacityKg)
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => flagCell(row.original.status) }
	];
	type Device = (typeof data.devices)[number];
	const deviceColumns: ColumnDef<Device>[] = [
		{ id: 'name', accessorKey: 'name', header: 'Scanner' },
		{ id: 'sync', header: 'Last sync', cell: ({ row }) => dateTime(row.original.lastSyncAt) },
		{ id: 'status', header: 'Status', cell: ({ row }) => flagCell(row.original.isActive) }
	];
	type Exception = (typeof data.exceptions)[number];
	const exceptionColumns: ColumnDef<Exception>[] = [
		{ id: 'date', header: 'Date', cell: ({ row }) => date(row.original.date) },
		{ id: 'name', accessorKey: 'name', header: 'What' },
		{ id: 'closed', header: 'Closed', cell: ({ row }) => yesNo(row.original.isClosed) },
		{
			id: 'scope',
			header: 'Applies to',
			cell: ({ row }) => (row.original.everywhere ? 'Every location' : 'This location')
		}
	];
</script>

<PageHeader
	title={tr(l.name)}
	eyebrow="Location · {humanize(l.type)}"
	description={l.address ?? undefined}
>
	{#snippet badges()}
		<Statuses {...flag(l.isActive)} />
	{/snippet}
	{#snippet actions()}
		{#if canEdit}
			<FormDialog
				title="Edit {tr(l.name)}"
				action="?/edit"
				data={data.editForm}
				schema={locationSchema}
			>
				{#snippet fields({ form, errors })}
					<LocationFields form={form as never} errors={errors as never} parents={data.parents} />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

{#if l.holdsStock}
	<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
		<StatCard
			stat={{
				key: 'green',
				label: 'Green coffee (kg)',
				value: data.stock.green,
				format: 'count',
				group: 'stock'
			}}
		/>
		<StatCard
			stat={{
				key: 'roasted',
				label: 'Roasted coffee (kg)',
				value: data.stock.roasted,
				format: 'count',
				group: 'stock'
			}}
		/>
		<StatCard
			stat={{
				key: 'packed',
				label: 'Packed bags',
				value: data.stock.packed,
				format: 'count',
				group: 'stock'
			}}
		/>
	</div>
{/if}

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Details">
		<SingleTable
			singleTable={[
				{ name: 'Code', value: l.code },
				{ name: 'Amharic name', value: l.name?.am ?? '—' },
				{ name: 'Afaan Oromo name', value: l.name?.om ?? '—' },
				{ name: 'Arabic name', value: l.name?.ar ?? '—' },
				{ name: 'Type', value: humanize(l.type) },
				{
					name: 'Inside',
					value: data.parent?.name ?? '—',
					href: href('location', data.parent?.id)
				},
				{ name: 'Phone', value: l.phone ?? '—', kind: 'phone' },
				{ name: 'Coordinates', value: l.latitude ? `${l.latitude}, ${l.longitude}` : '—' },
				{ name: 'Holds stock', value: yesNo(l.holdsStock) },
				{ name: 'Sells at the desk', value: yesNo(l.sellsAtDesk) },
				{ name: 'Fulfils online orders', value: yesNo(l.fulfilsOnline) },
				{ name: 'Pickup point', value: yesNo(l.isPickupPoint) },
				{ name: 'Admits visitors', value: yesNo(l.admitsVisitors) },
				{ name: 'Controls capacity', value: yesNo(l.controlsCapacity) },
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection
			title="Opening hours"
			hint={data.hasHours
				? 'The weekly pattern; holidays and closures override it.'
				: 'No hours set yet: save the week to set them.'}
		>
			<HoursEditor data={data.hoursForm} disabled={!canEdit} />
		</PageSection>
		<PageSection title="Holidays & closures">
			{#if data.exceptions.length}
				<DataTable variant="compact" columns={exceptionColumns} data={data.exceptions} />
			{:else}<Empty message="No holidays or closures recorded" />{/if}
		</PageSection>
		{#if data.children.length}
			<PageSection title="Inside this location">
				<DataTable variant="compact" columns={childColumns} data={data.children} />
			</PageSection>
		{/if}
		{#if data.machines.length}
			<PageSection title="Roasting machines">
				<DataTable variant="compact" columns={machineColumns} data={data.machines} />
			</PageSection>
		{/if}
		{#if data.devices.length}
			<PageSection title="Scanner devices">
				<DataTable variant="compact" columns={deviceColumns} data={data.devices} />
			</PageSection>
		{/if}
	</div>
</div>
