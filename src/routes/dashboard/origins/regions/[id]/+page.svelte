<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';
	import { flag as flagCell, kg, link } from '#lib/cells.ts';
	import { humanize, tr } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';
	import { useLinks } from '#lib/links.ts';
	import { regionEditSchema } from '#lib/schemas/origins.ts';

	let { data } = $props();
	const r = $derived(data.region);
	const href = useLinks();
	const name = $derived(tr(r.name));

	type Child = (typeof data.children)[number];
	const childColumns: ColumnDef<Child>[] = [
		{ id: 'name', header: 'Region', cell: ({ row }) => link('region', row.original.id, row.original.name) },
		{ id: 'level', header: 'Level', cell: ({ row }) => humanize(row.original.level) },
		{ id: 'status', header: 'Status', cell: ({ row }) => flagCell(row.original.status) }
	];
	type Station = (typeof data.stations)[number];
	const stationColumns: ColumnDef<Station>[] = [
		{ id: 'code', header: 'Station', cell: ({ row }) => link('station', row.original.id, `${row.original.code} — ${row.original.name}`) },
		{ id: 'type', header: 'Type', cell: ({ row }) => humanize(row.original.type) },
		{ id: 'lots', header: 'Lots', meta: { align: 'right' }, cell: ({ row }) => row.original.lots },
		{ id: 'kg', header: 'Green on hand', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.greenKg) }
	];
	type Lot = (typeof data.lots)[number];
	const lotColumns: ColumnDef<Lot>[] = [
		{ id: 'code', header: 'Lot', cell: ({ row }) => link('lot', row.original.id, row.original.code) },
		{ id: 'station', header: 'Station', cell: ({ row }) => link('station', row.original.stationId, row.original.station) },
		{ id: 'process', header: 'Process', cell: ({ row }) => humanize(row.original.process) },
		{ id: 'year', header: 'Crop year', cell: ({ row }) => row.original.cropYear },
		{ id: 'kg', header: 'Green on hand', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.greenKg) }
	];
</script>

<PageHeader
	title={name}
	eyebrow={humanize(r.level)}
	description={data.path.length ? data.path.map((p) => p.name).join(' › ') + ` › ${name}` : 'Top of the tree'}
>
	{#snippet badges()}
		<Statuses {...flag(r.status)} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog title="Edit {name}" action="?/edit" data={data.editForm} schema={regionEditSchema}>
				{#snippet fields({ form, errors })}
					<InputComp type="hidden" name="id" {form} {errors} />
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="col-span-full">
							<LanguageTabs {form} {errors} fields={['name', 'story']}>
								{#snippet children({ lang, suffix, language })}
									<InputComp label="Name ({language})" name="name{suffix}" {form} {errors} required={lang === 'en'} />
									<InputComp label="Story ({language})" name="story{suffix}" type="textarea" rows={3} {form} {errors} />
								{/snippet}
							</LanguageTabs>
						</div>
						<InputComp label="Level" name="level" placeholder="region, zone, woreda" {form} {errors} required />
						<InputComp label="Inside" name="parentId" type="combo" items={data.regions} {form} {errors} />
					</div>
					<InputComp label="Active" name="status" type="checkboxSingle" placeholder="Offered in pickers" {form} {errors} />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Region">
		<SingleTable
			singleTable={[
				{ name: 'Level', value: humanize(r.level) },
				...data.path.map((p, i) => ({ name: i === data.path.length - 1 ? 'Inside' : 'Within', value: p.name, href: href('region', p.id) })),
				{ name: 'Story', value: tr(r.story) || '—', long: 40 }
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		{#if data.children.length}
			<PageSection title="Inside {name}">
				<DataTable variant="compact" columns={childColumns} data={data.children} />
			</PageSection>
		{/if}
		<PageSection title="Stations & farms">
			{#if data.stations.length}
				<DataTable variant="compact" columns={stationColumns} data={data.stations} />
			{:else}<Empty message="No station is in this region itself" />{/if}
		</PageSection>
		<PageSection title="Lots">
			{#if data.lots.length}
				<DataTable variant="compact" columns={lotColumns} data={data.lots} />
			{:else}<Empty message="No lot names this region" />{/if}
		</PageSection>
	</div>
</div>
