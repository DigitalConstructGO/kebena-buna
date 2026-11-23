<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { dateTime, flag, link, longText, status } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const state = (r: Row) => (r.error ? 'failed' : r.processedAt ? 'done' : 'pending');
	const columns: ColumnDef<Row>[] = [
		{
			id: 'receivedAt',
			header: 'Received',
			cell: ({ row }) => link('webhook', row.original.id, dateTime(row.original.receivedAt))
		},
		{ id: 'provider', header: 'Gateway', cell: ({ row }) => humanize(row.original.provider) },
		{ id: 'eventType', header: 'Event', cell: ({ row }) => row.original.eventType ?? '—' },
		{ id: 'eventId', accessorKey: 'eventId', header: 'Gateway event id' },
		{
			id: 'signature',
			header: 'Signature',
			cell: ({ row }) => flag(row.original.signatureValid, 'Valid', 'Invalid')
		},
		{
			id: 'state',
			header: 'Processed',
			cell: ({ row }) => status(state(row.original), humanize(state(row.original)))
		},
		{ id: 'error', header: 'Error', cell: ({ row }) => longText(row.original.error, 30) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Payment webhooks"
	eyebrow="Messages"
	description="Every callback Chapa and the wallets sent, as received. A duplicate is stored once, so a retried webhook never pays an order twice; any one can be replayed."
/>

<DataTable
	rowHref={(row) => href('webhook', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['provider', 'eventType']}
	facetLabels={{ provider: 'Gateway', eventType: 'Event' }}
	dateFilter="Received"
	fileName="Webhooks"
/>
