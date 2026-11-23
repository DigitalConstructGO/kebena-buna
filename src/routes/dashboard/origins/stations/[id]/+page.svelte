<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import LookupFileCell from '@nahu/admin-kit/components/lookup/LookupFileCell.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { flag as flagCell, kg, link, status } from '#lib/cells.ts';
	import { humanize, tr } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { stationEditSchema, stationPhotoSchema } from '#lib/schemas/origins.ts';
	import StationFields from '../StationFields.svelte';

	let { data } = $props();
	const s = $derived(data.station);
	const href = useLinks();
	const name = $derived(tr(s.name));
	const onHand = $derived(data.lots.reduce((sum, l) => sum + Number(l.greenKg), 0));
	const map = $derived(
		s.latitude && s.longitude
			? `https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=13/${s.latitude}/${s.longitude}`
			: null
	);

	type Lot = (typeof data.lots)[number];
	const lotColumns: ColumnDef<Lot>[] = [
		{ id: 'code', header: 'Lot', cell: ({ row }) => link('lot', row.original.id, row.original.code) },
		{ id: 'process', header: 'Process', cell: ({ row }) => humanize(row.original.process) },
		{ id: 'year', header: 'Crop year', cell: ({ row }) => row.original.cropYear },
		{ id: 'grade', header: 'Grade', meta: { align: 'right' }, cell: ({ row }) => row.original.grade ?? '—' },
		{ id: 'score', header: 'Cupping', meta: { align: 'right' }, cell: ({ row }) => row.original.cuppingScore ?? '—' },
		{ id: 'kg', header: 'Green on hand', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.greenKg) },
		{ id: 'active', header: 'Status', cell: ({ row }) => flagCell(row.original.isActive) }
	];
	type Product = (typeof data.products)[number];
	const productColumns: ColumnDef<Product>[] = [
		{ id: 'name', header: 'Product', cell: ({ row }) => link('product', row.original.id, row.original.name) },
		{ id: 'status', header: 'Website', cell: ({ row }) => status(row.original.publishStatus) }
	];
</script>

<PageHeader title={name} eyebrow={humanize(s.type)} description={`${s.code} · ${data.region}`}>
	{#snippet badges()}
		<Statuses {...flag(s.isActive)} />
	{/snippet}
	{#snippet actions()}
		{#if map}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an outside map -->
			<Button href={map} target="_blank" rel="noopener" variant="outline"><MapPin class="size-4" /> Map</Button>
		{/if}
		{#if data.canManage}
			<FormDialog title="Edit {name}" action="?/edit" data={data.editForm} schema={stationEditSchema} dataType="json">
				{#snippet fields({ form, errors })}
					<StationFields form={form as never} errors={errors as never} options={data.options} />
					<InputComp label="Active" name="isActive" type="checkboxSingle" placeholder="Offered when entering lots" {form} {errors} />
				{/snippet}
			</FormDialog>
			<FormDialog title="Photo" action="?/photo" data={data.photoForm} schema={stationPhotoSchema} multipart triggerLabel="Photo">
				{#snippet fields({ form, errors })}
					<InputComp label="Photo" name="photo" type="file" accept="image/*" image={s.photo ?? ''} removable={false} {form} {errors} />
				{/snippet}
			</FormDialog>
			<ConfirmAction
				action="?/delete"
				label="Delete"
				icon={Trash2}
				variant="destructive"
				title="Delete {name}?"
				description="Only a station with no lots can be deleted. One that supplied lots keeps them traceable: switch it off instead."
			/>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
	<StatCard stat={{ key: 'lots', label: 'Lots', value: data.lots.length, format: 'count', group: 'station' }} />
	<StatCard stat={{ key: 'onHand', label: 'Green on hand (kg)', value: onHand, format: 'count', group: 'station' }} />
	<StatCard stat={{ key: 'farmers', label: 'Farmers', value: s.farmerCount ?? 0, format: 'count', group: 'station' }} />
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		{#if s.photo}
			<PageSection title="Photo">
				<LookupFileCell name={s.photo} image alt={name} />
			</PageSection>
		{/if}
		<PageSection title="Station">
			<SingleTable
				singleTable={[
					{ name: 'Code', value: s.code },
					{ name: 'Type', value: humanize(s.type) },
					{ name: 'Region', value: data.region, href: href('region', s.regionId) },
					{ name: 'Altitude', value: s.altitudeMinM ? `${s.altitudeMinM}–${s.altitudeMaxM ?? '?'} m` : '—' },
					{ name: 'Coordinates', value: s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : '—', href: map },
					{ name: 'Farmers', value: s.farmerCount?.toLocaleString('en-US') ?? '—' },
					{ name: 'Certifications', value: data.certifications.map((c) => c.name).join(', ') || '—' },
					{ name: 'Story', value: tr(s.story) || '—', long: 40 },
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>
	</div>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Lots">
			{#if data.lots.length}
				<DataTable variant="compact" columns={lotColumns} data={data.lots} />
			{:else}<Empty message="No lots from this station yet" />{/if}
		</PageSection>
		<PageSection title="Products sourcing it">
			{#if data.products.length}
				<DataTable variant="compact" columns={productColumns} data={data.products} />
			{:else}<Empty message="No product names this station as an origin" />{/if}
		</PageSection>
	</div>
</div>
