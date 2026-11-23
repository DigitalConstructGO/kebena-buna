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
	import { amount, date, dateTime, link, status, user } from '#lib/cells.ts';
	import { humanize, money, tr } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { variantEditSchema } from '#lib/schemas/catalog.ts';

	let { data } = $props();
	const v = $derived(data.variant);
	const href = useLinks();
	const size = $derived(data.bagSize ?? tr(v.name) ?? '');
	const onHand = $derived(data.stock.reduce((sum, s) => sum + Number(s.units), 0));
	const reserved = $derived(data.stock.reduce((sum, s) => sum + Number(s.reserved), 0));

	type Run = (typeof data.runs)[number];
	const runColumns: ColumnDef<Run>[] = [
		{ id: 'code', header: 'Run', cell: ({ row }) => link('packingRun', row.original.id, row.original.code) },
		{ id: 'at', header: 'Packed', cell: ({ row }) => dateTime(row.original.packedAt) },
		{ id: 'roast', header: 'Roast', cell: ({ row }) => row.original.roastLevel },
		{ id: 'grind', header: 'Grind', cell: ({ row }) => row.original.grind ?? '—' },
		{ id: 'units', header: 'Bags', meta: { align: 'right' }, cell: ({ row }) => row.original.units },
		{ id: 'bestBefore', header: 'Best before', cell: ({ row }) => date(row.original.bestBefore) },
		{ id: 'location', header: 'Location', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'by', header: 'Packed by', cell: ({ row }) => user(row.original.packedById, row.original.packedBy) }
	];
	type Stock = (typeof data.stock)[number];
	const stockColumns: ColumnDef<Stock>[] = [
		{ id: 'location', header: 'Location', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'roast', header: 'Roast', cell: ({ row }) => row.original.roastLevel },
		{ id: 'run', header: 'Packing run', cell: ({ row }) => link('packingRun', row.original.packingRunId, row.original.packingRun) },
		{ id: 'units', header: 'Bags', meta: { align: 'right' }, cell: ({ row }) => row.original.units },
		{ id: 'reserved', header: 'Reserved', meta: { align: 'right' }, cell: ({ row }) => row.original.reserved }
	];
	type Line = (typeof data.lines)[number];
	const lineColumns: ColumnDef<Line>[] = [
		{ id: 'order', header: 'Order', cell: ({ row }) => link('order', row.original.orderId, row.original.number) },
		{ id: 'placed', header: 'Placed', cell: ({ row }) => dateTime(row.original.placedAt) },
		{ id: 'customer', header: 'Customer', cell: ({ row }) => link('customer', row.original.customerId, row.original.customer) },
		{ id: 'qty', header: 'Qty', meta: { align: 'right' }, cell: ({ row }) => row.original.quantity },
		{ id: 'price', header: 'Unit (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.unitPrice) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
	type Sub = (typeof data.subscriptions)[number];
	const subColumns: ColumnDef<Sub>[] = [
		{ id: 'number', header: 'Subscription', cell: ({ row }) => link('subscription', row.original.id, row.original.number) },
		{ id: 'customer', header: 'Customer', cell: ({ row }) => link('customer', row.original.customerId, row.original.customer) },
		{ id: 'frequency', header: 'Every', cell: ({ row }) => humanize(row.original.frequency) },
		{ id: 'qty', header: 'Bags', meta: { align: 'right' }, cell: ({ row }) => row.original.quantity },
		{ id: 'next', header: 'Next roast', cell: ({ row }) => date(row.original.nextRoastDate) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
	type Price = (typeof data.priceChanges)[number];
	const priceColumns: ColumnDef<Price>[] = [
		{ id: 'at', header: 'When', cell: ({ row }) => dateTime(row.original.at) },
		{
			id: 'price',
			header: 'Price (ETB)',
			cell: ({ row }) =>
				row.original.to === null ? '—' : `${amount(row.original.from as number)} → ${amount(row.original.to as number)}`
		},
		{
			id: 'was',
			header: 'Was-price (ETB)',
			cell: ({ row }) =>
				row.original.wasTo === null ? '—' : `${amount(row.original.wasFrom as number)} → ${amount(row.original.wasTo as number)}`
		},
		{ id: 'by', header: 'By', cell: ({ row }) => user(row.original.byId, row.original.by) }
	];
</script>

<PageHeader title={v.sku} eyebrow="Variant" description={`${data.product} · ${size} · ${money(v.price)}`}>
	{#snippet badges()}
		<Statuses {...flag(v.isActive)} />
		<Statuses {...flag(onHand >= data.lowAt, 'In stock', 'Low stock')} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog title="Edit {v.sku}" action="?/edit" data={data.editForm} schema={variantEditSchema}>
				{#snippet fields({ form, errors })}
					<InputComp type="hidden" name="id" {form} {errors} />
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<InputComp label="SKU" name="sku" {form} {errors} required />
						<InputComp label="Bag size" name="bagSizeId" type="select" items={data.bagSizes} {form} {errors} />
						<InputComp label="Name (English)" name="nameEn" {form} {errors} />
						<InputComp label="Name (Amharic)" name="nameAm" {form} {errors} />
						<InputComp label="Name (Afaan Oromo)" name="nameOm" {form} {errors} />
						<InputComp label="Name (Arabic)" name="nameAr" {form} {errors} />
						<InputComp label="Name (Italian)" name="nameIt" {form} {errors} />
						<InputComp label="Name (French)" name="nameFr" {form} {errors} />
						<InputComp label="Price (ETB)" name="price" type="number" step="0.01" {form} {errors} required />
						<InputComp label="Was (struck through)" name="compareAtPrice" type="number" step="0.01" {form} {errors} />
						<InputComp label="Low-stock bags" name="lowStockUnits" type="number" description="Leave empty to use the shop default: {data.lowDefault} bags (Admin › Settings)." {form} {errors} />
						<InputComp label="Barcode" name="barcode" {form} {errors} />
						<InputComp label="Order" name="sortOrder" type="number" {form} {errors} />
					</div>
					<InputComp label="Active" name="status" type="checkboxSingle" placeholder="Offered for sale" {form} {errors} />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard stat={{ key: 'price', label: 'Price', value: Number(v.price), format: 'money', group: 'variant' }} />
	<StatCard stat={{ key: 'onHand', label: 'Bags on hand', value: onHand, format: 'count', group: 'variant', tone: onHand < data.lowAt ? 'warning' : 'positive' }} />
	<StatCard stat={{ key: 'reserved', label: 'Reserved for orders', value: reserved, format: 'count', group: 'variant' }} />
	<StatCard stat={{ key: 'subs', label: 'Subscriptions', value: data.subscriptions.length, format: 'count', group: 'variant' }} />
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Variant">
		<SingleTable
			singleTable={[
				{ name: 'Product', value: data.product, href: href('product', v.productId) },
				{ name: 'Size', value: size || '—' },
				{ name: 'Price', value: money(v.price) },
				{ name: 'Was', value: Number(v.compareAtPrice) ? money(v.compareAtPrice) : '—' },
				{ name: 'Currency', value: v.currency },
				{ name: 'Low-stock level', value: v.lowStockUnits ? `${v.lowStockUnits} bags` : `Setting (${data.lowAt} bags)` },
				{ name: 'Barcode', value: v.barcode ?? '—' },
				...data.plans.map((p) => ({ name: 'Monthly bag of', value: p.name, href: href('membershipPlan', p.id) })),
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Packed stock">
			{#if data.stock.length}
				<DataTable variant="compact" columns={stockColumns} data={data.stock} />
			{:else}<Empty message="No bags of this size on hand" />{/if}
		</PageSection>
		<PageSection title="Packing runs">
			{#if data.runs.length}
				<DataTable variant="compact" columns={runColumns} data={data.runs} />
			{:else}<Empty message="Never packed" />{/if}
		</PageSection>
		<PageSection title="Price history" hint="From the audit log: every change to the price or the was-price.">
			{#if data.priceChanges.length}
				<DataTable variant="compact" columns={priceColumns} data={data.priceChanges} />
			{:else}<Empty message="The price has not changed since it was set" />{/if}
		</PageSection>
		<PageSection title="Recent orders">
			{#if data.lines.length}
				<DataTable variant="compact" columns={lineColumns} data={data.lines} />
			{:else}<Empty message="Not sold yet" />{/if}
		</PageSection>
		<PageSection title="Subscriptions">
			{#if data.subscriptions.length}
				<DataTable variant="compact" columns={subColumns} data={data.subscriptions} />
			{:else}<Empty message="No subscription sends this size" />{/if}
		</PageSection>
	</div>
</div>
