<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { dateTime, link, longText, sortable, status, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { REF_ENTITY } from '#lib/refs.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'scheduledFor',
			accessorKey: 'scheduledFor',
			header: sortable('Due'),
			cell: ({ row }) =>
				link(
					'notification',
					row.original.id,
					`#${row.original.id} · ${dateTime(row.original.scheduledFor)}`
				)
		},
		{ id: 'templateKey', accessorKey: 'templateKey', header: 'Message' },
		{ id: 'channel', header: 'Channel', cell: ({ row }) => humanize(row.original.channel) },
		{
			id: 'to',
			header: 'To',
			cell: ({ row }) =>
				row.original.customerId
					? link(
							'customer',
							row.original.customerId,
							row.original.customer ?? row.original.recipient
						)
					: row.original.userId
						? user(row.original.userId, row.original.userName ?? row.original.recipient)
						: row.original.recipient
		},
		{
			id: 'about',
			header: 'About',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => {
				const { refType, refId } = row.original;
				if (!refType || !refId) return '—';
				const label = `${humanize(refType)} #${refId}`;
				return REF_ENTITY[refType] ? link(REF_ENTITY[refType], refId, label) : label;
			}
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{
			id: 'attempts',
			accessorKey: 'attempts',
			header: sortable('Tries'),
			meta: { align: 'right' }
		},
		{
			id: 'sentAt',
			accessorKey: 'sentAt',
			header: sortable('Sent'),
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => dateTime(row.original.sentAt)
		},
		{
			id: 'error',
			header: 'Error',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => longText(row.original.lastError, 25)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Outbox"
	eyebrow="Messages"
	description="Every SMS, email and Telegram message is queued here first and sent by a worker, so a failed gateway retries instead of losing it. Marketing messages go only to customers who agreed."
/>

<DataTable
	rowHref={(row) => href('notification', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['status', 'channel', 'templateKey']}
	facetLabels={{ status: 'Status', channel: 'Channel', templateKey: 'Message' }}
	dateFilter="Due"
	charts
	fileName="Outbox"
/>
