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
	import { amount, dateTime, kg, link, percent, user } from '#lib/cells.ts';
	import { humanize, tr } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { lotEditSchema } from '#lib/schemas/origins.ts';
	import LotFields from '../LotFields.svelte';

	let { data } = $props();
	const l = $derived(data.lot);
	const href = useLinks();
	const onHand = $derived(data.stock.reduce((sum, s) => sum + Number(s.kg), 0));
	const roasted = $derived(data.roasts.reduce((sum, r) => sum + Number(r.greenKg), 0));

	type Stock = (typeof data.stock)[number];
	const stockColumns: ColumnDef<Stock>[] = [
		{ id: 'location', header: 'Location', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'kg', header: 'On hand', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.kg) },
		{ id: 'cost', header: 'Cost / kg (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.costPerKg) },
		{ id: 'updated', header: 'Updated', cell: ({ row }) => dateTime(row.original.updatedAt) }
	];
	type Roast = (typeof data.roasts)[number];
	const roastColumns: ColumnDef<Roast>[] = [
		{ id: 'code', header: 'Batch', cell: ({ row }) => link('roastBatch', row.original.id, row.original.code) },
		{ id: 'at', header: 'Roasted', cell: ({ row }) => dateTime(row.original.roastedAt) },
		{ id: 'roast', header: 'Roast', cell: ({ row }) => row.original.roastLevel },
		{ id: 'kg', header: 'Green used', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.greenKg) },
		{ id: 'loss', header: 'Loss', meta: { align: 'right' }, cell: ({ row }) => percent(row.original.weightLossPct) },
		{ id: 'roaster', header: 'Roaster', cell: ({ row }) => user(row.original.roasterId, row.original.roaster) }
	];
	type Move = (typeof data.movements)[number];
	const moveColumns: ColumnDef<Move>[] = [
		{ id: 'at', header: 'When', cell: ({ row }) => dateTime(row.original.occurredAt) },
		{ id: 'reason', header: 'Reason', cell: ({ row }) => humanize(row.original.reason) },
		{ id: 'location', header: 'Location', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'qty', header: 'kg', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.quantity) },
		{ id: 'batch', header: 'Roast batch', cell: ({ row }) => row.original.roastBatchId ? link('roastBatch', row.original.roastBatchId, `#${row.original.roastBatchId}`) : '—' },
		{ id: 'by', header: 'By', cell: ({ row }) => user(row.original.byId, row.original.by) }
	];
</script>

<PageHeader title={l.code} eyebrow="Green lot" description={`${data.station} · ${humanize(l.process)} · crop ${l.cropYear}`}>
	{#snippet badges()}
		<Statuses {...flag(l.isActive)} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog title="Edit {l.code}" action="?/edit" data={data.editForm} schema={lotEditSchema} dataType="json">
				{#snippet fields({ form, errors })}
					<LotFields form={form as never} errors={errors as never} options={data.options} lowDefault={data.greenLowDefault} locked />
					<InputComp label="Active" name="isActive" type="checkboxSingle" placeholder="Offered when recording roasts" {form} {errors} />
				{/snippet}
			</FormDialog>
			<ConfirmAction
				action="?/delete"
				label="Delete"
				icon={Trash2}
				variant="destructive"
				title="Delete {l.code}?"
				description="Only a lot that never held stock can be deleted. A lot with stock or movements keeps its traceability: switch it off instead."
			/>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
	<StatCard stat={{ key: 'onHand', label: 'Green on hand (kg)', value: onHand, format: 'count', group: 'lot', tone: onHand < Number(l.lowStockKg ?? 60) ? 'warning' : 'positive' }} />
	<StatCard stat={{ key: 'roasted', label: 'Roasted so far (kg green)', value: roasted, format: 'count', group: 'lot' }} />
	<StatCard stat={{ key: 'batches', label: 'Roast batches', value: data.roasts.length, format: 'count', group: 'lot' }} />
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Lot">
			<SingleTable
				singleTable={[
					{ name: 'Station', value: `${data.stationCode} — ${data.station}`, href: href('station', l.stationId) },
					{ name: 'Region', value: data.region, href: href('region', l.regionId) },
					{ name: 'Process', value: humanize(l.process) },
					{ name: 'Crop year', value: l.cropYear },
					{ name: 'Grade', value: l.grade ?? '—' },
					{ name: 'Cupping score', value: l.cuppingScore ?? '—' },
					{ name: 'Altitude', value: l.altitudeM ? `${l.altitudeM} m` : '—' },
					{ name: 'Farmers', value: l.farmerCount ?? '—' },
					{ name: 'External ref.', value: l.externalRef ?? '—' },
					{ name: 'Low-stock level', value: l.lowStockKg ? `${l.lowStockKg} kg` : 'Setting (60 kg)' },
					{ name: 'Varieties', value: data.varieties.map((v) => v.name).join(', ') || '—' },
					{ name: 'Certifications', value: data.certifications.map((c) => (c.number ? `${c.name} (${c.number})` : c.name)).join(', ') || '—' },
					{ name: 'Tasting notes', value: tr(l.tastingNotes) || '—', long: 40 },
					{ name: 'Story', value: tr(l.story) || '—', long: 40 },
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>
		<PageSection title="Sold as">
			{#if data.products.length}
				<SingleTable singleTable={data.products.map((p) => ({ name: p.share ? `${p.share}%` : 'Product', value: p.name, href: href('product', p.id) }))} />
			{:else}<Empty message="No product names this lot as its origin" />{/if}
		</PageSection>
	</div>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Green stock by location">
			{#if data.stock.length}
				<DataTable variant="compact" columns={stockColumns} data={data.stock} />
			{:else}<Empty message="None of this lot is in stock" />{/if}
		</PageSection>
		<PageSection title="Roast batches">
			{#if data.roasts.length}
				<DataTable variant="compact" columns={roastColumns} data={data.roasts} />
			{:else}<Empty message="Not roasted yet" />{/if}
		</PageSection>
		<PageSection title="Stock movements" hint="The ledger: every receipt, roast and adjustment of this lot.">
			{#if data.movements.length}
				<DataTable variant="compact" columns={moveColumns} data={data.movements} />
			{:else}<Empty message="No movements yet" />{/if}
		</PageSection>
	</div>
</div>
