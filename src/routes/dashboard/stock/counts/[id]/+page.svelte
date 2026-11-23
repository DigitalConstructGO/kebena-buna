<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { amount, link } from '#lib/cells.ts';
	import { formatDateTime, humanize, qty } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';

	let { data } = $props();
	const c = $derived(data.count);
	const href = useLinks();
	const unit = $derived(c.stage === 'packed' ? 'bags' : 'kg');

	type Row = (typeof data.corrections)[number];
	const columns: ColumnDef<Row>[] = $derived([
		{
			id: 'item',
			header: 'What',
			cell: ({ row }) =>
				row.original.lotId
					? link('lot', row.original.lotId, row.original.lot)
					: row.original.roastBatchId
						? link('roastBatch', row.original.roastBatchId, row.original.batch)
						: link(
								'packingRun',
								row.original.packingRunId,
								`${row.original.sku ?? ''} · ${row.original.run ?? ''}`
							)
		},
		{ id: 'reason', header: 'Posted as', cell: ({ row }) => humanize(row.original.reason) },
		{
			id: 'qty',
			header: 'Correction',
			meta: { align: 'right' },
			cell: ({ row }) => qty(row.original.quantity, unit)
		},
		{
			id: 'value',
			header: 'Value (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(Number(row.original.quantity) * Number(row.original.unitCost))
		}
	]);
</script>

<PageHeader
	title="Count #{c.id}"
	eyebrow="Stock count"
	description={`${data.location} · ${humanize(c.stage)} · ${formatDateTime(c.countedAt)}`}
>
	{#snippet badges()}
		<Statuses {...flag(c.isOpening, 'Opening count', 'Periodic count')} />
		<Statuses {...flag(Boolean(c.postedAt), 'Posted', 'Not posted')} />
	{/snippet}
</PageHeader>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Count">
		<SingleTable
			singleTable={[
				{ name: 'Location', value: data.location, href: href('location', c.locationId) },
				{ name: 'Stage', value: humanize(c.stage) },
				{ name: 'Counted', value: formatDateTime(c.countedAt) },
				{ name: 'Posted', value: formatDateTime(c.postedAt) },
				{ name: 'Lines counted', value: c.lineCount },
				{ name: 'Note', value: c.note ?? '—', long: 40 },
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<PageSection title="Corrections posted" hint="Lines that agreed with the books post nothing.">
		{#if data.corrections.length}
			<DataTable variant="compact" {columns} data={data.corrections} />
		{:else}<Empty message="Everything counted agreed with the books" />{/if}
	</PageSection>
</div>
