<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { amount, dateTime, link, longText, sortable, user } from '#lib/cells.ts';
	import { humanize, qty } from '#lib/format.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	/** What the movement is about, linked: a lot, a batch, or a run and its bag. */
	const item = (r: Row) =>
		r.stage === 'green'
			? link('lot', r.lotId, r.lot)
			: r.stage === 'roasted'
				? link('roastBatch', r.roastBatchId, r.batch)
				: link('packingRun', r.packingRunId, r.run ? `${r.run} · ${r.sku ?? ''}` : null);

	/** The document that caused it, where it has a page. */
	const source = (r: Row) => {
		if (r.orderId) return link('order', r.orderId, r.orderNumber);
		if (r.refType === 'stock_count') return link('stockCount', r.refId, `Count #${r.refId}`);
		if (r.refType === 'roast_batch') return link('roastBatch', r.refId, `Roast #${r.refId}`);
		if (r.refType === 'packing_run') return link('packingRun', r.refId, `Packing #${r.refId}`);
		if (r.transferKey) return 'Transfer';
		return r.refType ? `${humanize(r.refType)} ${r.refId ?? ''}` : '—';
	};

	const columns: ColumnDef<Row>[] = [
		{
			id: 'occurredAt',
			accessorKey: 'occurredAt',
			header: sortable('When'),
			cell: ({ row }) => dateTime(row.original.occurredAt)
		},
		{ id: 'stage', header: 'Stage', cell: ({ row }) => humanize(row.original.stage) },
		{ id: 'reason', header: 'Reason', cell: ({ row }) => humanize(row.original.reason) },
		{ id: 'item', header: 'What', cell: ({ row }) => item(row.original) },
		{
			id: 'locationId',
			header: 'Location',
			cell: ({ row }) => link('location', row.original.locationId, row.original.location)
		},
		{
			id: 'quantity',
			accessorKey: 'quantity',
			header: sortable('Qty'),
			meta: { align: 'right' },
			cell: ({ row }) => qty(row.original.quantity, row.original.stage === 'packed' ? 'bags' : 'kg')
		},
		{
			id: 'unitCost',
			accessorKey: 'unitCost',
			header: sortable('Unit cost (ETB)'),
			meta: { align: 'right', class: 'hidden lg:table-cell' },
			cell: ({ row }) => amount(row.original.unitCost)
		},
		{
			id: 'source',
			header: 'Document',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => source(row.original)
		},
		{
			id: 'note',
			header: 'Note',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => longText(row.original.note)
		},
		{
			id: 'by',
			header: 'By',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => user(row.original.byId, row.original.by)
		}
	];
</script>

<PageHeader
	title="Stock movements"
	description="The ledger: every receipt, roast, packing, sale, café use, transfer and count, as one signed line. A mistake is corrected with a new line, never an edit."
/>

<DataTable
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['stage', 'reason', 'locationId']}
	facetLabels={{ stage: 'Stage', reason: 'Reason', locationId: 'Location' }}
	dateFilter="Happened"
	charts
	fileName="Stock movements"
	rowClass={(r) => (Number(r.quantity) < 0 ? 'text-muted-foreground' : null)}
/>
