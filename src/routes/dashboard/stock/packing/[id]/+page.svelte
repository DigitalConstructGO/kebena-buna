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
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { dateTime, kg, link, user } from '#lib/cells.ts';
	import { amount, formatDate, formatDateTime, humanize, qty } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { packingEditSchema } from '#lib/schemas/stock.ts';

	let { data } = $props();
	const r = $derived(data.run);
	const href = useLinks();
	const onHand = $derived(data.stock.reduce((sum, s) => sum + s.units, 0));

	type Source = (typeof data.sources)[number];
	const sourceColumns: ColumnDef<Source>[] = [
		{
			id: 'batch',
			header: 'Roast batch',
			cell: ({ row }) => link('roastBatch', row.original.roastBatchId, row.original.code)
		},
		{ id: 'at', header: 'Roasted', cell: ({ row }) => dateTime(row.original.roastedAt) },
		{
			id: 'kg',
			header: 'Roasted kg used',
			meta: { align: 'right' },
			cell: ({ row }) => kg(row.original.roastedKg)
		}
	];
	type Lot = (typeof data.lots)[number];
	const lotColumns: ColumnDef<Lot>[] = [
		{
			id: 'lot',
			header: 'Lot',
			cell: ({ row }) => link('lot', row.original.lotId, row.original.code)
		},
		{
			id: 'station',
			header: 'Station',
			cell: ({ row }) => link('station', row.original.stationId, row.original.station)
		},
		{ id: 'process', header: 'Process', cell: ({ row }) => humanize(row.original.process) },
		{ id: 'crop', header: 'Crop year', cell: ({ row }) => row.original.cropYear },
		{
			id: 'batch',
			header: 'Via batch',
			cell: ({ row }) =>
				link('roastBatch', row.original.roastBatchId, `#${row.original.roastBatchId}`)
		}
	];
	type Stock = (typeof data.stock)[number];
	const stockColumns: ColumnDef<Stock>[] = [
		{
			id: 'location',
			header: 'Location',
			cell: ({ row }) => link('location', row.original.locationId, row.original.location)
		},
		{
			id: 'units',
			header: 'Bags',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.units
		},
		{
			id: 'reserved',
			header: 'Held for orders',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.reservedUnits
		},
		{ id: 'updated', header: 'Updated', cell: ({ row }) => dateTime(row.original.updatedAt) }
	];
	type Move = (typeof data.movements)[number];
	const moveColumns: ColumnDef<Move>[] = [
		{ id: 'at', header: 'When', cell: ({ row }) => dateTime(row.original.occurredAt) },
		{ id: 'reason', header: 'Reason', cell: ({ row }) => humanize(row.original.reason) },
		{
			id: 'location',
			header: 'Location',
			cell: ({ row }) => link('location', row.original.locationId, row.original.location)
		},
		{
			id: 'batch',
			header: 'Batch',
			cell: ({ row }) =>
				row.original.roastBatchId
					? link('roastBatch', row.original.roastBatchId, `#${row.original.roastBatchId}`)
					: '—'
		},
		{
			id: 'qty',
			header: 'Qty',
			meta: { align: 'right' },
			cell: ({ row }) => qty(row.original.quantity, row.original.stage === 'packed' ? 'bags' : 'kg')
		},
		{
			id: 'ref',
			header: 'Document',
			cell: ({ row }) =>
				row.original.refType === 'stock_count'
					? link('stockCount', row.original.refId, `Count #${row.original.refId}`)
					: (row.original.note ?? '—')
		},
		{ id: 'by', header: 'By', cell: ({ row }) => user(row.original.byId, row.original.by) }
	];
</script>

<PageHeader
	title={r.code}
	eyebrow="Packing run"
	description={`${data.product} · ${data.sku} · ${data.roastLevel}`}
>
	{#snippet badges()}
		<Statuses {...flag(Boolean(r.labelPrintedAt), 'Label printed', 'Label not printed')} />
		{#if r.isToOrder}<Statuses status="ready" label="For one order" />{/if}
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog
				title="Edit {r.code}"
				action="?/edit"
				data={data.editForm}
				schema={packingEditSchema}
			>
				{#snippet fields({ form, errors })}
					<!-- The dialog posts only the fields it renders: without this the save has no batch. -->
					<InputComp type="hidden" name="id" {form} {errors} />
					<InputComp label="Best before" name="bestBefore" type="date" futureDays {form} {errors} />
					<InputComp
						label="Label printed"
						name="labelPrinted"
						type="checkboxSingle"
						placeholder="The run's label and QR are on the bags"
						{form}
						{errors}
					/>
					<InputComp
						label="Active"
						name="isActive"
						type="checkboxSingle"
						placeholder="Offered when selling and transferring"
						{form}
						{errors}
					/>
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
	<StatCard
		stat={{ key: 'packed', label: 'Bags packed', value: r.units, format: 'count', group: 'run' }}
	/>
	<StatCard
		stat={{ key: 'left', label: 'Bags on hand', value: onHand, format: 'count', group: 'run' }}
	/>
	<StatCard
		stat={{
			key: 'cost',
			label: 'Cost per bag',
			value: data.costPerBag,
			format: 'money',
			group: 'run'
		}}
		amharicMoney={false}
	/>
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Run">
		<SingleTable
			singleTable={[
				{ name: 'Product', value: data.product, href: href('product', data.productId) },
				{ name: 'Bag', value: data.sku, href: href('variant', r.variantId) },
				{ name: 'Roast', value: data.roastLevel },
				{ name: 'Grind', value: data.grind ?? '—' },
				{ name: 'Packed', value: formatDateTime(r.packedAt) },
				{ name: 'Packed by', value: data.packer ?? '—', href: href('user', r.packedBy) },
				{ name: 'Packed into', value: data.location, href: href('location', r.locationId) },
				{ name: 'Best before', value: formatDate(r.bestBefore) },
				{ name: 'Label printed', value: formatDateTime(r.labelPrintedAt) },
				{ name: 'Public trace page', value: `/trace/${r.code}` },
				{ name: 'Cost per bag', value: `ETB ${amount(data.costPerBag)}` },
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Roast batches used">
			<DataTable variant="compact" columns={sourceColumns} data={data.sources} />
		</PageSection>
		<PageSection
			title="Where the coffee comes from"
			hint="The lots in those batches, and their stations — what the bag's QR page shows."
		>
			{#if data.lots.length}
				<DataTable variant="compact" columns={lotColumns} data={data.lots} />
			{:else}<Empty message="No lots recorded for these batches" />{/if}
		</PageSection>
		<PageSection title="Bags on hand">
			{#if data.stock.length}
				<DataTable variant="compact" columns={stockColumns} data={data.stock} />
			{:else}<Empty message="None of this run is left" />{/if}
		</PageSection>
		<PageSection title="Stock movements">
			<DataTable variant="compact" columns={moveColumns} data={data.movements} />
		</PageSection>
	</div>
</div>
