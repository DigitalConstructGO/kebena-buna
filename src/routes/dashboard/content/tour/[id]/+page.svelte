<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import RowButton from '@nahu/admin-kit/components/RowButton.svelte';
	import ImageViewer from '@nahu/admin-kit/components/ImageViewer.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { fileUrl } from '@nahu/admin-kit/files';
	import { link } from '#lib/cells.ts';
	import { flag } from '#lib/status.ts';
	import { humanize } from '#lib/format.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { hotspotEditSchema, hotspotSchema, sceneEditSchema } from '#lib/schemas/content.ts';
	import SceneFields from '../SceneFields.svelte';
	import HotspotFields from '../HotspotFields.svelte';

	let { data } = $props();
	const s = $derived(data.scene);
	const href = useLinks();

	type Hotspot = (typeof data.hotspots)[number];
	let editing = $state<Hotspot | null>(null);
	let editOpen = $state(false);
	let viewerOpen = $state(false);

	/** The record a hotspot opens, as a link to that record's page. */
	function targetOf(h: Hotspot) {
		if (h.kind === 'product') return link('product', h.productId, h.product);
		if (h.kind === 'lot') return link('lot', h.lotId, h.lot);
		if (h.kind === 'origin_map') return link('station', h.stationId, h.station);
		if (h.kind === 'booking') return link('bookable', h.bookableId, h.bookable);
		if (h.kind === 'scene') return link('scene', h.targetSceneId, h.targetScene);
		if (h.kind === 'link') return h.url ?? '—';
		return h.eventId ? link('event', h.eventId, h.event) : '—';
	}

	const columns: ColumnDef<Hotspot>[] = [
		{ id: 'title', header: 'Hotspot', cell: ({ row }) => row.original.title },
		{ id: 'kind', header: 'Kind', cell: ({ row }) => humanize(row.original.kind) },
		{ id: 'target', header: 'Opens', cell: ({ row }) => targetOf(row.original) },
		{
			id: 'position',
			header: 'Yaw / pitch',
			meta: { align: 'right' },
			cell: ({ row }) => `${row.original.yaw}° / ${row.original.pitch}°`
		},
		{
			id: 'sortOrder',
			header: 'Order',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.sortOrder
		},
		{
			id: 'edit',
			header: '',
			cell: ({ row }) =>
				renderComponent(RowButton, {
					label: 'Edit',
					onclick: () => {
						editing = row.original;
						editOpen = true;
					}
				})
		},
		{
			id: 'delete',
			header: '',
			cell: ({ row }) =>
				renderComponent(ConfirmAction, {
					action: '?/deleteHotspot',
					fields: { id: row.original.id },
					label: 'Remove',
					variant: 'ghost',
					title: `Remove “${row.original.title}”?`,
					description: 'It disappears from the scene.'
				})
		}
	];
</script>

<PageHeader title={s.title} eyebrow="Tour scene" description={s.site}>
	{#snippet badges()}
		<Statuses {...flag(s.isActive)} />
		{#if s.isStart}<Statuses status="active" label="Start scene" />{/if}
	{/snippet}
	{#snippet actions()}
		<Button href="/dashboard/content/tour" variant="outline">
			<ArrowLeft class="size-4" /> Tour
		</Button>
		<Button variant="outline" onclick={() => (viewerOpen = true)}>View panorama</Button>
		<FormDialog
			title="Edit {s.title}"
			action="?/edit"
			data={data.editForm}
			schema={sceneEditSchema}
			multipart
		>
			{#snippet fields({ form, errors })}
				<InputComp type="hidden" name="id" {form} {errors} />
				<SceneFields
					{form}
					{errors}
					locations={data.locations}
					panorama={s.panorama}
					preview={s.preview ?? ''}
				/>
			{/snippet}
		</FormDialog>
		<ConfirmAction
			action="?/delete"
			label="Delete"
			icon={Trash2}
			variant="destructive"
			title="Delete this scene?"
			description="It leaves the tour with its hotspots; hotspots in other scenes that led here stop leading anywhere."
		/>
	{/snippet}
</PageHeader>

<ImageViewer bind:open={viewerOpen} images={[fileUrl(s.panorama)]} />

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
	<PageSection title="Scene">
		<SingleTable
			singleTable={[
				{ name: 'Site', value: s.site, href: href('location', s.locationId) },
				{ name: 'Address', value: s.slug },
				{
					name: 'Start facing',
					value: s.initialYaw !== null ? `${s.initialYaw}° yaw, ${s.initialPitch ?? 0}° pitch` : '—'
				},
				{ name: 'Order', value: s.sortOrder },
				{
					name: 'Description',
					value: (s.description as Record<string, string> | null)?.en ?? '—',
					long: 40
				},
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<PageSection
		title="Hotspots"
		hint="The points visitors click in this scene, and what each one opens."
	>
		{#snippet actions()}
			<FormDialog
				title="Add a hotspot"
				triggerLabel="Add hotspot"
				triggerIcon={Plus}
				submitIcon={Plus}
				action="?/addHotspot"
				data={data.addForm}
				schema={hotspotSchema}
				resetOnSuccess
			>
				{#snippet fields({ form, errors, values })}
					<HotspotFields {form} {errors} kind={String(values.kind)} options={data.options} />
				{/snippet}
			</FormDialog>
		{/snippet}
		{#if data.hotspots.length}
			<DataTable variant="compact" {columns} data={data.hotspots} />
		{:else}<Empty message="No hotspots in this scene yet" />{/if}
	</PageSection>
</div>

<FormDialog
	title="Edit hotspot"
	action="?/editHotspot"
	data={data.hotspotForm}
	schema={hotspotEditSchema}
	bind:open={editOpen}
	hideTrigger
	seed={editing ?? undefined}
>
	{#snippet fields({ form, errors, values })}
		<InputComp type="hidden" name="id" {form} {errors} />
		<HotspotFields {form} {errors} kind={String(values.kind)} options={data.options} />
	{/snippet}
</FormDialog>
