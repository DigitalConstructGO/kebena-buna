<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PackagePlus from '@lucide/svelte/icons/package-plus';
	import Flame from '@lucide/svelte/icons/flame';
	import Package from '@lucide/svelte/icons/package';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { amount, date, kg, link, sortable } from '#lib/cells.ts';
	import { choicesOf, qty } from '#lib/format.ts';
	import { STOCK_STAGES } from '#lib/constants.ts';
	import { adjustSchema, transferSchema } from '#lib/schemas/stock.ts';

	let { data } = $props();

	const greenKg = $derived(data.green.reduce((sum, r) => sum + Number(r.kg), 0));
	const roastedKg = $derived(data.roasted.reduce((sum, r) => sum + Number(r.kg), 0));
	const bags = $derived(data.packed.reduce((sum, r) => sum + r.units, 0));
	const value = $derived(
		data.green.reduce((sum, r) => sum + Number(r.kg) * Number(r.costPerKg), 0) +
			data.roasted.reduce((sum, r) => sum + Number(r.kg) * Number(r.costPerKg), 0) +
			data.packed.reduce((sum, r) => sum + r.units * Number(r.costPerBag), 0)
	);
	const reasons = [
		{ value: 'adjustment', name: 'Correction (+ or −)' },
		{ value: 'waste', name: 'Waste' },
		{ value: 'internal_use', name: 'Café / internal use' }
	];
	const unitOf = (stage: string) => (stage === 'packed' ? 'bags' : 'kg');

	type Green = (typeof data.green)[number];
	const greenColumns: ColumnDef<Green>[] = [
		{ id: 'code', accessorKey: 'code', header: sortable('Lot'), cell: ({ row }) => link('lot', row.original.lotId, row.original.code) },
		{ id: 'station', header: 'Station', cell: ({ row }) => link('station', row.original.stationId, row.original.station) },
		{ id: 'location', accessorKey: 'location', header: 'Location', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'kg', accessorFn: (r) => Number(r.kg), header: sortable('On hand'), meta: { align: 'right' }, cell: ({ row }) => kg(row.original.kg) },
		{ id: 'cost', header: 'Cost / kg (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.costPerKg) },
		{ id: 'value', header: 'Value (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(Number(row.original.kg) * Number(row.original.costPerKg)) }
	];
	type Roasted = (typeof data.roasted)[number];
	const roastedColumns: ColumnDef<Roasted>[] = [
		{ id: 'code', accessorKey: 'code', header: sortable('Batch'), cell: ({ row }) => link('roastBatch', row.original.roastBatchId, row.original.code) },
		{ id: 'roastedAt', accessorKey: 'roastedAt', header: sortable('Roasted'), cell: ({ row }) => date(row.original.roastedAt) },
		{ id: 'product', header: 'For', cell: ({ row }) => link('product', row.original.productId, row.original.product) },
		{ id: 'roast', accessorKey: 'roastLevel', header: 'Roast' },
		{ id: 'location', accessorKey: 'location', header: 'Location', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'kg', accessorFn: (r) => Number(r.kg), header: sortable('On hand'), meta: { align: 'right' }, cell: ({ row }) => kg(row.original.kg) },
		{ id: 'reserved', header: 'Held for orders', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.reservedKg) },
		{ id: 'value', header: 'Value (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(Number(row.original.kg) * Number(row.original.costPerKg)) }
	];
	type Packed = (typeof data.packed)[number];
	const packedColumns: ColumnDef<Packed>[] = [
		{ id: 'product', accessorKey: 'product', header: sortable('Product'), cell: ({ row }) => link('product', row.original.productId, row.original.product) },
		{ id: 'size', header: 'Size', cell: ({ row }) => link('variant', row.original.variantId, row.original.size) },
		{ id: 'roast', accessorKey: 'roastLevel', header: 'Roast' },
		{ id: 'run', header: 'Packing run', cell: ({ row }) => link('packingRun', row.original.packingRunId, row.original.code) },
		{ id: 'location', accessorKey: 'location', header: 'Location', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'bestBefore', header: 'Best before', cell: ({ row }) => date(row.original.bestBefore) },
		{ id: 'units', accessorKey: 'units', header: sortable('Bags'), meta: { align: 'right' } },
		{ id: 'reserved', header: 'Held', meta: { align: 'right' }, cell: ({ row }) => row.original.reservedUnits },
		{ id: 'value', header: 'Value (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.units * Number(row.original.costPerBag)) }
	];
	type Low = (typeof data.low)[number];
	const lowColumns: ColumnDef<Low>[] = [
		{ id: 'kind', accessorKey: 'kind', header: 'Stage' },
		{ id: 'name', header: 'What', cell: ({ row }) => link(row.original.entity, row.original.id, row.original.name) },
		{ id: 'have', header: 'Free now', meta: { align: 'right' }, cell: ({ row }) => qty(row.original.have, row.original.unit) },
		{ id: 'level', header: 'Alert below', meta: { align: 'right' }, cell: ({ row }) => qty(row.original.level, row.original.unit) }
	];
</script>

<PageHeader title="Stock on hand" description="Green kilograms per lot, roasted kilograms per batch and packed bags per run, at every location.">
	{#snippet actions()}
		{#if data.canManage}
			<Button href="/dashboard/stock/receive" variant="outline"><PackagePlus class="size-4" /> Receive green</Button>
			<Button href="/dashboard/stock/roasts/new" variant="outline"><Flame class="size-4" /> Record roast</Button>
			<Button href="/dashboard/stock/packing/new" variant="outline"><Package class="size-4" /> Record packing</Button>
			<Button href="/dashboard/stock/counts/new" variant="outline"><ClipboardList class="size-4" /> Count stock</Button>
			<FormDialog title="Adjust stock" triggerLabel="Adjust" action="?/adjust" data={data.adjustForm} schema={adjustSchema} resetOnSuccess description="A correction, waste, or what the café used. Every change is a ledger line, audited.">
				{#snippet fields({ form, errors, values })}
					<InputComp label="Stage" name="stage" type="select" items={choicesOf(STOCK_STAGES)} {form} {errors} required />
					<InputComp label="What" name="itemId" type="combo" items={data.items[values.stage]} {form} {errors} required />
					<InputComp label="Location" name="locationId" type="combo" items={data.locations} {form} {errors} required />
					<InputComp label="Reason" name="reason" type="select" items={reasons} {form} {errors} required />
					<InputComp
						label="Quantity ({unitOf(values.stage)})"
						name="quantity"
						type="number"
						step={values.stage === 'packed' ? '1' : '0.001'}
						description={values.reason === 'adjustment' ? 'Negative takes stock out.' : 'Taken out of stock.'}
						{form}
						{errors}
						required
					/>
					<InputComp label="Date" name="date" type="date" {form} {errors} required />
					<InputComp label="Why" name="note" {form} {errors} required />
				{/snippet}
			</FormDialog>
			<FormDialog title="Transfer stock" triggerLabel="Transfer" action="?/transfer" data={data.transferForm} schema={transferSchema} resetOnSuccess>
				{#snippet fields({ form, errors, values })}
					<InputComp label="Stage" name="stage" type="select" items={choicesOf(STOCK_STAGES)} {form} {errors} required />
					<InputComp label="What" name="itemId" type="combo" items={data.items[values.stage]} {form} {errors} required />
					<InputComp label="From" name="fromLocationId" type="combo" items={data.locations} {form} {errors} required />
					<InputComp label="To" name="toLocationId" type="combo" items={data.locations} {form} {errors} required />
					<InputComp label="Quantity ({unitOf(values.stage)})" name="quantity" type="number" step="any" {form} {errors} required />
					<InputComp label="Date" name="date" type="date" {form} {errors} required />
					<InputComp label="Note" name="note" {form} {errors} />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard stat={{ key: 'green', label: 'Green coffee (kg)', value: Math.round(greenKg), format: 'count', group: 'stock' }} />
	<StatCard stat={{ key: 'roasted', label: 'Roasted coffee (kg)', value: Math.round(roastedKg * 10) / 10, format: 'count', group: 'stock' }} />
	<StatCard stat={{ key: 'bags', label: 'Packed bags', value: bags, format: 'count', group: 'stock' }} />
	<StatCard stat={{ key: 'value', label: 'Stock value', value: Math.round(value), format: 'money', group: 'stock', hint: 'At the cost on the ledger' }} amharicMoney={false} />
</div>

{#if data.low.length}
	<Notice tone="warning" title="{data.low.length} item(s) below their low-stock level" class="mt-6">
		Levels are set per lot, product and size; empty ones use the stock.* settings ({data.levels.greenLow} kg green, {data.levels.roastedLow} kg roasted, {data.levels.packedLow} bags).
	</Notice>
	<PageSection title="Low stock" class="mt-4">
		<DataTable variant="compact" columns={lowColumns} data={data.low} />
	</PageSection>
{/if}

<div class="mt-6 grid grid-cols-1 gap-6">
	<PageSection title="Packed bags" hint="Ready to sell, oldest run first to go.">
		{#if data.packed.length}
			<DataTable columns={packedColumns} data={data.packed} fileName="Packed stock" defaultPageSize={10} />
		{:else}<Empty message="No packed bags in stock" />{/if}
	</PageSection>
	<PageSection title="Roasted coffee" hint="Per batch; the café's use comes out of here.">
		{#if data.roasted.length}
			<DataTable columns={roastedColumns} data={data.roasted} fileName="Roasted stock" defaultPageSize={10} />
		{:else}<Empty message="No roasted coffee in stock" />{/if}
	</PageSection>
	<PageSection title="Green coffee" hint="Per lot and location.">
		{#if data.green.length}
			<DataTable columns={greenColumns} data={data.green} fileName="Green stock" defaultPageSize={10} />
		{:else}<Empty message="No green coffee in stock" />{/if}
	</PageSection>
</div>
