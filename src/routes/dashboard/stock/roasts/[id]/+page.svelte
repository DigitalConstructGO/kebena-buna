<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Package from '@lucide/svelte/icons/package';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { amount, dateTime, kg, link, status, user } from '#lib/cells.ts';
	import { formatDateTime, humanize, pct, qty } from '#lib/format.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { roastEditSchema } from '#lib/schemas/stock.ts';

	let { data } = $props();
	const b = $derived(data.batch);
	const href = useLinks();
	const loss = $derived(Number(b.weightLossPct ?? 0));
	const offRange = $derived(loss < data.lossRange.min || loss > data.lossRange.max);
	const onHand = $derived(data.stock.reduce((sum, s) => sum + Number(s.kg), 0));
	const packedKg = $derived(data.runs.reduce((sum, r) => sum + Number(r.roastedKg), 0));

	type Input = (typeof data.inputs)[number];
	const inputColumns: ColumnDef<Input>[] = [
		{
			id: 'lot',
			header: 'Lot',
			cell: ({ row }) => link('lot', row.original.lotId, row.original.code)
		},
		{
			id: 'kg',
			header: 'Green kg',
			meta: { align: 'right' },
			cell: ({ row }) => kg(row.original.greenKg)
		},
		{
			id: 'cost',
			header: 'Cost / kg (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.unitCost)
		},
		{
			id: 'value',
			header: 'Value (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(Number(row.original.greenKg) * row.original.unitCost)
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
			id: 'kg',
			header: 'On hand',
			meta: { align: 'right' },
			cell: ({ row }) => kg(row.original.kg)
		},
		{
			id: 'reserved',
			header: 'Held for orders',
			meta: { align: 'right' },
			cell: ({ row }) => kg(row.original.reservedKg)
		},
		{ id: 'updated', header: 'Updated', cell: ({ row }) => dateTime(row.original.updatedAt) }
	];
	type Run = (typeof data.runs)[number];
	const runColumns: ColumnDef<Run>[] = [
		{
			id: 'code',
			header: 'Packing run',
			cell: ({ row }) => link('packingRun', row.original.id, row.original.code)
		},
		{ id: 'at', header: 'Packed', cell: ({ row }) => dateTime(row.original.packedAt) },
		{
			id: 'variant',
			header: 'Bag',
			cell: ({ row }) => link('variant', row.original.variantId, row.original.sku)
		},
		{
			id: 'units',
			header: 'Bags',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.units
		},
		{
			id: 'kg',
			header: 'Roasted kg used',
			meta: { align: 'right' },
			cell: ({ row }) => kg(row.original.roastedKg)
		}
	];
	type Line = (typeof data.lines)[number];
	const lineColumns: ColumnDef<Line>[] = [
		{
			id: 'order',
			header: 'Order',
			cell: ({ row }) => link('order', row.original.orderId, row.original.number)
		},
		{ id: 'what', header: 'Line', cell: ({ row }) => row.original.description?.en ?? '—' },
		{
			id: 'qty',
			header: 'Qty',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.quantity
		},
		{ id: 'status', header: 'Order status', cell: ({ row }) => status(row.original.status) }
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
			id: 'what',
			header: 'Lot / run',
			cell: ({ row }) =>
				row.original.lotId
					? link('lot', row.original.lotId, row.original.lot)
					: row.original.packingRunId
						? link('packingRun', row.original.packingRunId, `Run #${row.original.packingRunId}`)
						: '—'
		},
		{
			id: 'qty',
			header: 'kg',
			meta: { align: 'right' },
			cell: ({ row }) => qty(row.original.quantity)
		},
		{ id: 'by', header: 'By', cell: ({ row }) => user(row.original.byId, row.original.by) }
	];
</script>

<PageHeader
	title={b.code}
	eyebrow="Roast batch"
	description={`${data.roastLevel} · ${formatDateTime(b.roastedAt)} · ${data.location}`}
>
	{#snippet badges()}
		{#if offRange}
			<Statuses
				status="failed"
				label="Loss {pct(loss)} — outside {data.lossRange.min}–{data.lossRange.max}%"
			/>
		{/if}
		{#if b.isToOrder}<Statuses status="ready" label="Roast-day batch" />{/if}
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<Button href="/dashboard/stock/packing/new?batch={b.id}" variant="outline">
				<Package class="size-4" /> Pack from this batch
			</Button>
			<FormDialog
				title="Edit {b.code}"
				action="?/edit"
				data={data.editForm}
				schema={roastEditSchema}
				description="Weights moved stock and stay as recorded; correct them with an adjustment on Stock on hand."
			>
				{#snippet fields({ form, errors })}
					<!-- The dialog posts only the fields it renders: without this the save has no batch. -->
					<InputComp type="hidden" name="id" {form} {errors} />
					<InputComp
						label="Machine"
						name="machineId"
						type="combo"
						items={data.options.machines}
						{form}
						{errors}
					/>
					<InputComp
						label="Roaster"
						name="roasterId"
						type="combo"
						items={data.options.staff}
						{form}
						{errors}
					/>
					<InputComp
						label="Roasted for"
						name="productId"
						type="combo"
						items={data.options.products}
						{form}
						{errors}
					/>
					<InputComp
						label="Duration (min)"
						name="durationMin"
						type="number"
						step="0.01"
						{form}
						{errors}
					/>
					<InputComp
						label="Drop temperature (°C)"
						name="dropTempC"
						type="number"
						step="0.1"
						{form}
						{errors}
					/>
					<InputComp
						label="Cupping score"
						name="cuppingScore"
						type="number"
						step="0.25"
						{form}
						{errors}
					/>
					<InputComp label="Notes" name="notes" type="textarea" rows={3} {form} {errors} />
					<InputComp
						label="Roast-day batch"
						name="isToOrder"
						type="checkboxSingle"
						placeholder="For roast-to-order and subscription lines"
						{form}
						{errors}
					/>
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard
		stat={{
			key: 'in',
			label: 'Green in (kg)',
			value: Number(b.greenKgIn),
			format: 'count',
			group: 'batch',
			hint: qty(b.greenKgIn, 'kg')
		}}
	/>
	<StatCard
		stat={{
			key: 'out',
			label: 'Roasted out (kg)',
			value: Number(b.roastedKgOut),
			format: 'count',
			group: 'batch',
			hint: qty(b.roastedKgOut, 'kg')
		}}
	/>
	<StatCard
		stat={{
			key: 'loss',
			label: 'Weight loss',
			value: loss,
			format: 'percent',
			group: 'batch',
			tone: offRange ? 'warning' : 'positive'
		}}
	/>
	<StatCard
		stat={{
			key: 'left',
			label: 'Still on hand (kg)',
			value: Math.round(onHand * 1000) / 1000,
			format: 'count',
			group: 'batch',
			hint: `${qty(onHand, 'kg')} here · ${qty(packedKg, 'kg')} packed so far`
		}}
	/>
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Batch">
		<SingleTable
			singleTable={[
				{ name: 'Roasted for', value: data.product ?? '—', href: href('product', b.productId) },
				{ name: 'Roast level', value: data.roastLevel },
				{ name: 'Roaster', value: data.roaster ?? '—', href: href('user', b.roasterId) },
				{ name: 'Machine', value: data.machine ?? '—' },
				{ name: 'Location', value: data.location, href: href('location', b.locationId) },
				{ name: 'Duration', value: b.durationMin ? `${b.durationMin} min` : '—' },
				{ name: 'Drop temperature', value: b.dropTempC ? `${b.dropTempC} °C` : '—' },
				{ name: 'Cupping score', value: b.cuppingScore ?? '—' },
				{ name: 'Cost per roasted kg', value: `ETB ${amount(data.costPerKg)}` },
				{ name: 'Notes', value: b.notes ?? '—', long: 40 },
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Green lots used">
			<DataTable variant="compact" columns={inputColumns} data={data.inputs} />
		</PageSection>
		<PageSection title="Roasted stock">
			{#if data.stock.length}
				<DataTable variant="compact" columns={stockColumns} data={data.stock} />
			{:else}<Empty message="None of this batch is left" />{/if}
		</PageSection>
		<PageSection title="Packed into">
			{#if data.runs.length}
				<DataTable variant="compact" columns={runColumns} data={data.runs} />
			{:else}<Empty message="Not packed yet" />{/if}
		</PageSection>
		<PageSection title="Orders roasted in this batch" hint="Roast-to-order and subscription lines.">
			{#if data.lines.length}
				<DataTable variant="compact" columns={lineColumns} data={data.lines} />
			{:else}<Empty message="No order lines name this batch" />{/if}
		</PageSection>
		<PageSection title="Stock movements">
			<DataTable variant="compact" columns={moveColumns} data={data.movements} />
		</PageSection>
	</div>
</div>
