<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { dateTime, link, longText, sortable, user } from '#lib/cells.ts';
	import { humanize, languageName } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{ id: 'id', header: 'Chat', cell: ({ row }) => link('conversation', row.original.id, `#${row.original.id}`) },
		{ id: 'channel', header: 'Channel', cell: ({ row }) => humanize(row.original.channel) },
		{ id: 'locale', header: 'Language', cell: ({ row }) => languageName(row.original.locale) },
		{ id: 'customer', header: 'Customer', cell: ({ row }) => (row.original.customerId ? link('customer', row.original.customerId, row.original.customer) : 'Visitor') },
		{ id: 'lastText', header: 'Last message', meta: { class: 'hidden md:table-cell' }, cell: ({ row }) => longText(row.original.lastText, 40) },
		{ id: 'messages', accessorKey: 'messages', header: sortable('Messages'), meta: { align: 'right' } },
		{ id: 'handedOff', header: 'Handled by', cell: ({ row }) => (row.original.handedOffToId ? user(row.original.handedOffToId, row.original.handedOffTo) : 'Agent') },
		{ id: 'lastMessageAt', accessorKey: 'lastMessageAt', header: sortable('Last activity'), cell: ({ row }) => dateTime(row.original.lastMessageAt) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="AI conversations"
	description="Every chat with the agent on the website and in Telegram. Open one to read it, or to take over from the agent."
/>

<DataTable
	rowHref={(row) => href('conversation', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['channel', 'locale', 'handedOff']}
	facetLabels={{ channel: 'Channel', locale: 'Language', handedOff: 'Handled by' }}
	dateFilter="Started"
	charts
	fileName="AI conversations"
/>
