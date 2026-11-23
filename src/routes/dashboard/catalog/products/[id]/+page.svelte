<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Globe from '@lucide/svelte/icons/globe';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Save from '@lucide/svelte/icons/save';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import LookupFileCell from '@nahu/admin-kit/components/lookup/LookupFileCell.svelte';
	import { childActionPaths } from '@nahu/admin-kit/components/lookup/actions';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import GalleryUpload from '@nahu/admin-kit/formComponents/GalleryUpload.svelte';
	import RichEditor from '@nahu/admin-kit/formComponents/RichEditor.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { amount, date, dateTime, kg, link, percent, status, user } from '#lib/cells.ts';
	import { humanize, tr, yesNo } from '#lib/format.ts';
	import { badge, flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import {
		productDescriptionSchema,
		productImageSchema,
		productOptionsSchema,
		productOriginSchema,
		productPhotosSchema,
		variantEditSchema,
		variantSchema
	} from '#lib/schemas/catalog.ts';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';
	import OptionFields from '../OptionFields.svelte';

	let { data } = $props();
	const p = $derived(data.product);
	const href = useLinks();
	const name = $derived(tr(p.name));
	const onHand = $derived(data.variants.rows.reduce((sum, v) => sum + Number(v.packed), 0));
	const sold = $derived(data.lines.reduce((sum, l) => sum + Number(l.quantity), 0));

	// svelte-ignore state_referenced_locally
	const description = createForm(data.descriptionForm, productDescriptionSchema, { taintedMessage: confirmLeave, resetForm: false });
	const { form: descForm, enhance: descEnhance, delayed: descDelayed, allErrors: descErrors } =
		description;

	type Origin = (typeof data.origins)[number];
	const originColumns: ColumnDef<Origin>[] = [
		{ id: 'station', header: 'Station', cell: ({ row }) => link('station', row.original.stationId, row.original.station) },
		{ id: 'lot', header: 'Lot', cell: ({ row }) => link('lot', row.original.lotId, row.original.lot) },
		{ id: 'share', header: 'Share', meta: { align: 'right' }, cell: ({ row }) => percent(row.original.sharePercent) },
		{
			id: 'remove',
			header: '',
			cell: ({ row }) =>
				data.canManage
					? renderComponent(ConfirmAction, {
							action: '?/deleteOrigin',
							label: 'Remove',
							variant: 'ghost',
							title: 'Remove this origin?',
							description: 'The product page stops naming it under “Where this comes from”.',
							fields: { originId: row.original.id }
						})
					: ''
		}
	];

	type Stock = (typeof data.stock)[number];
	const stockColumns: ColumnDef<Stock>[] = [
		{ id: 'sku', header: 'Size', cell: ({ row }) => link('variant', row.original.variantId, row.original.sku) },
		{ id: 'roast', header: 'Roast', cell: ({ row }) => row.original.roastLevel },
		{ id: 'location', header: 'Location', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'run', header: 'Packing run', cell: ({ row }) => link('packingRun', row.original.packingRunId, row.original.packingRun) },
		{ id: 'bestBefore', header: 'Best before', cell: ({ row }) => date(row.original.bestBefore) },
		{ id: 'units', header: 'Bags', meta: { align: 'right' }, cell: ({ row }) => row.original.units },
		{ id: 'reserved', header: 'Reserved', meta: { align: 'right' }, cell: ({ row }) => row.original.reserved }
	];

	type Batch = (typeof data.batches)[number];
	const batchColumns: ColumnDef<Batch>[] = [
		{ id: 'code', header: 'Batch', cell: ({ row }) => link('roastBatch', row.original.id, row.original.code) },
		{ id: 'at', header: 'Roasted', cell: ({ row }) => dateTime(row.original.roastedAt) },
		{ id: 'roast', header: 'Roast', cell: ({ row }) => row.original.roastLevel },
		{ id: 'in', header: 'Green in', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.greenKgIn) },
		{ id: 'out', header: 'Roasted out', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.roastedKgOut) },
		{ id: 'loss', header: 'Loss', meta: { align: 'right' }, cell: ({ row }) => percent(row.original.weightLossPct) },
		{ id: 'roaster', header: 'Roaster', cell: ({ row }) => user(row.original.roasterId, row.original.roaster) }
	];

	type Line = (typeof data.lines)[number];
	const lineColumns: ColumnDef<Line>[] = [
		{ id: 'order', header: 'Order', cell: ({ row }) => link('order', row.original.orderId, row.original.number) },
		{ id: 'placed', header: 'Placed', cell: ({ row }) => dateTime(row.original.placedAt) },
		{ id: 'sku', header: 'Size', cell: ({ row }) => link('variant', row.original.variantId, row.original.sku) },
		{ id: 'qty', header: 'Qty', meta: { align: 'right' }, cell: ({ row }) => row.original.quantity },
		{ id: 'price', header: 'Unit (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.unitPrice) },
		{ id: 'total', header: 'Total (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.lineTotal) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];

	const listOf = (items: { name: string; isDefault: boolean }[]) =>
		items.map((i) => (i.isDefault ? `${i.name} (default)` : i.name)).join(', ') || '—';
</script>

<PageHeader title={name} eyebrow="Product" description={`${data.category ?? 'No category'} · ${humanize(p.kind)} · ${humanize(p.fulfilment)}`}>
	{#snippet badges()}
		<Statuses {...badge(p.publishStatus)} />
		{#if !p.isActive}<Statuses {...flag(false)} />{/if}
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<!-- A page of its own: 40-odd fields were too many for a dialog. -->
			<Button href="/dashboard/catalog/products/{p.id}/edit" variant="ghost" size="sm" class="gap-1">
				<SquarePen class="size-4" /> Edit
			</Button>
			{#if p.publishStatus === 'published'}
				<ConfirmAction action="?/publish" fields={{ to: 'draft' }} label="Unpublish" icon={EyeOff} variant="outline" title="Take {name} off the website?" description="It goes back to draft; nothing already sold changes." />
			{:else}
				<ConfirmAction action="?/publish" fields={{ to: 'published' }} label="Publish" icon={Globe} title="Publish {name}?" description="It appears in the shop with its active sizes." />
			{/if}
			<ConfirmAction
				action="?/delete"
				label="Delete"
				icon={Trash2}
				variant="destructive"
				title="Delete {name}?"
				description="Only a product never sold can be deleted, with its sizes. A sold one keeps its history: archive it instead."
			/>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard stat={{ key: 'sizes', label: 'Sizes', value: data.variants.rows.length, format: 'count', group: 'product' }} />
	<StatCard stat={{ key: 'onHand', label: 'Bags on hand', value: onHand, format: 'count', group: 'product', tone: onHand ? 'positive' : 'warning' }} />
	<StatCard stat={{ key: 'batches', label: 'Roast batches', value: data.batches.length, format: 'count', group: 'product' }} />
	<StatCard stat={{ key: 'sold', label: 'Bags sold (recent orders)', value: sold, format: 'count', group: 'product' }} />
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Pictures">
			{#snippet actions()}
				{#if data.canManage}
					<FormDialog title="Main picture" action="?/image" data={data.imageForm} schema={productImageSchema} multipart triggerLabel="Main picture">
						{#snippet fields({ form, errors })}
							<InputComp label="Picture" name="image" type="file" accept="image/*" image={p.image ?? ''} removable={false} {form} {errors} />
						{/snippet}
					</FormDialog>
					<FormDialog title="Add photos" action="?/addPhotos" data={data.photosForm} schema={productPhotosSchema} multipart resetOnSuccess triggerLabel="Add photos" triggerIcon={Plus} submitIcon={Plus}>
						{#snippet fields({ form })}
							<GalleryUpload {form} name="photos" label="Photos" hint="Shown after the main picture on the product page." />
						{/snippet}
					</FormDialog>
				{/if}
			{/snippet}
			{#if p.image || data.photos.length}
				<div class="flex flex-wrap items-start gap-3">
					{#if p.image}
						<div class="grid grid-cols-1 justify-items-start gap-1">
							<LookupFileCell name={p.image} image alt={name} gallery={data.photos.map((ph) => ph.fileName)} />
							<span class="text-xs text-muted-foreground">Main</span>
						</div>
					{/if}
					{#each data.photos as photo (photo.id)}
						<div class="grid grid-cols-1 justify-items-start gap-1">
							<LookupFileCell name={photo.fileName} image alt={name} />
							{#if data.canManage}
								<ConfirmAction action="?/deletePhoto" fields={{ imageId: photo.id }} label="Remove" variant="ghost" title="Remove this photo?" />
							{/if}
						</div>
					{/each}
				</div>
			{:else}<Empty message="No pictures yet" />{/if}
		</PageSection>

		<PageSection title="Details">
			<SingleTable
				singleTable={[
					{ name: 'Address', value: p.slug },
					{ name: 'Category', value: data.category ?? '—' },
					{ name: 'Kind', value: humanize(p.kind) },
					{ name: 'Fulfilment', value: humanize(p.fulfilment) },
					{ name: 'Dispatch', value: `${p.dispatchDays} working day${p.dispatchDays === 1 ? '' : 's'}` },
					{ name: 'Tax', value: data.taxRate ?? '—' },
					{ name: 'Roasted low-stock level', value: p.lowStockRoastedKg ? `${p.lowStockRoastedKg} kg` : 'Setting' },
					{ name: 'Members only', value: yesNo(p.isMemberOnly) },
					{ name: 'Subscribable', value: yesNo(p.isSubscribable) },
					{ name: 'Wholesale', value: yesNo(p.isWholesale) },
					{ name: 'Order in the shop', value: p.sortOrder },
					{ name: 'Summary', value: tr(p.summary) || '—', long: 40 },
					{ name: 'Tasting notes', value: tr(p.tastingNotes) || '—', long: 40 },
					{ name: 'Origin story', value: tr(p.originStory) || '—', long: 40 },
					{ name: 'SEO title', value: tr(p.seoTitle) || '—', long: 40 },
					{ name: 'SEO description', value: tr(p.seoDescription) || '—', long: 40 },
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>

		<PageSection title="Allowed options">
			{#snippet actions()}
				{#if data.canManage}
					<FormDialog title="Allowed options" action="?/options" data={data.optionsForm} schema={productOptionsSchema} dataType="json" triggerLabel="Change">
						{#snippet fields({ form, errors })}
							<OptionFields form={form as never} errors={errors as never} options={data.options} />
						{/snippet}
					</FormDialog>
				{/if}
			{/snippet}
			<SingleTable
				singleTable={[
					{ name: 'Roast levels', value: listOf(data.roasts) },
					{ name: 'Grinds', value: listOf(data.grinds) },
					{ name: 'Packaging', value: listOf(data.packagings) }
				]}
			/>
		</PageSection>
	</div>

	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Sizes and prices" hint="Price changes are kept in the audit log; past orders keep the price they were sold at.">
			<LookupSection
				config={{
					entity: 'Size',
					plural: 'Sizes',
					detailEntity: 'variant',
					fields: [
						{ name: 'sku', label: 'SKU', type: 'text' },
						{ name: 'bagSizeId', label: 'Bag size', type: 'reference', display: 'bagSize', picker: 'select', required: false },
						{ name: 'nameEn', label: 'Name (English)', type: 'text', required: false, placeholder: 'For sizes with no bag size: “Set of 6”, “XL”' },
						{ name: 'nameAm', label: 'Name (Amharic)', type: 'text', required: false, inTable: false },
						{ name: 'nameOm', label: 'Name (Afaan Oromo)', type: 'text', required: false, inTable: false },
						{ name: 'nameAr', label: 'Name (Arabic)', type: 'text', required: false, inTable: false },
						{ name: 'nameIt', label: 'Name (Italian)', type: 'text', required: false, inTable: false },
						{ name: 'nameFr', label: 'Name (French)', type: 'text', required: false, inTable: false },
						{ name: 'price', label: 'Price', type: 'money' },
						{ name: 'compareAtPrice', label: 'Was (struck through)', type: 'money', required: false },
						{ name: 'lowStockUnits', label: 'Low-stock bags', type: 'number', required: false, inTable: false },
						{ name: 'barcode', label: 'Barcode', type: 'text', required: false, inTable: false },
						{ name: 'sortOrder', label: 'Order', type: 'number', inTable: false },
						{ name: 'status', label: 'Status', type: 'boolean' }
					],
					extraColumns: [{ id: 'packed', header: 'Bags on hand', cell: ({ row }) => String(row.original.packed ?? 0) }]
				}}
				rows={data.variants.rows}
				addForm={data.variants.addForm}
				editForm={data.variants.editForm}
				canDelete={data.canManage}
				readonly={!data.canManage}
				options={{ bagSizeId: data.options.bagSizes }}
				actions={childActionPaths('Variant')}
				schemas={{ add: variantSchema, edit: variantEditSchema }}
			/>
		</PageSection>

		<PageSection title="Description" hint="Shown on the product page. Pasted formatting is cleaned on save.">
			{#if data.canManage}
				<form method="POST" action="?/description" use:descEnhance class="grid grid-cols-1 gap-4">
					<Errors allErrors={$descErrors} />
					<LanguageTabs form={descForm as never} errors={description.errors as never} fields={['description']}>
						{#snippet children({ suffix, language })}
							<RichEditor
								name="description{suffix}"
								label="Description ({language})"
								bind:value={$descForm[`description${suffix}`]}
								minHeight="12rem"
							/>
						{/snippet}
					</LanguageTabs>
					<Button type="submit" class="justify-self-start" disabled={$descDelayed}>
						{#if $descDelayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save description{/if}
					</Button>
				</form>
			{:else if tr(data.description)}
				<!-- Sanitised on save (`sanitizeRichHtml`), so it is safe to render. -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="prose prose-sm max-w-none dark:prose-invert">{@html tr(data.description)}</div>
			{:else}<Empty message="No description yet" />{/if}
		</PageSection>

		<PageSection title="Where this comes from" hint="The stations and lots the product page names. A bag's own QR page uses its actual roast batch.">
			{#snippet actions()}
				{#if data.canManage}
					<FormDialog title="Add an origin" action="?/addOrigin" data={data.originForm} schema={productOriginSchema} resetOnSuccess triggerLabel="Add origin" triggerIcon={Plus} submitIcon={Plus}>
						{#snippet fields({ form, errors })}
							<InputComp label="Station" name="stationId" type="combo" items={data.options.stations} {form} {errors} />
							<InputComp label="Lot" name="lotId" type="combo" items={data.options.lots} description="A lot fills in its station." {form} {errors} />
							<InputComp label="Share of a blend (%)" name="sharePercent" type="number" {form} {errors} />
							<InputComp label="Order" name="sortOrder" type="number" {form} {errors} />
						{/snippet}
					</FormDialog>
				{/if}
			{/snippet}
			{#if data.origins.length}
				<DataTable variant="compact" columns={originColumns} data={data.origins} />
			{:else}
				<Notice tone="warning">No origin yet: the product page will not say where this coffee comes from.</Notice>
			{/if}
		</PageSection>

		<PageSection title="Packed stock" hint="Bags on the shelf by size, roast and packing run — oldest first.">
			{#if data.stock.length}
				<DataTable variant="compact" columns={stockColumns} data={data.stock} />
			{:else}<Empty message="No packed bags on hand" />{/if}
		</PageSection>

		<PageSection title="Roast batches">
			{#if data.batches.length}
				<DataTable variant="compact" columns={batchColumns} data={data.batches} />
			{:else}<Empty message="Nothing roasted for this product yet" />{/if}
		</PageSection>

		<PageSection title="Recent orders">
			{#if data.lines.length}
				<DataTable variant="compact" columns={lineColumns} data={data.lines} />
			{:else}<Empty message="Not sold yet" />{/if}
		</PageSection>
	</div>
</div>
