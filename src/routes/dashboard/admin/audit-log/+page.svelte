<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { dateTime, link, longText, sortable, status, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { ACTION_TONE } from './tones';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'createdAt',
			accessorKey: 'createdAt',
			header: sortable('When'),
			cell: ({ row }) => link('auditEntry', row.original.id, dateTime(row.original.createdAt))
		},
		{
			id: 'userId',
			header: 'Who',
			cell: ({ row }) =>
				row.original.userId ? user(row.original.userId, row.original.userName ?? '—') : 'System'
		},
		{
			id: 'action',
			header: 'Action',
			cell: ({ row }) =>
				status(ACTION_TONE[row.original.action] ?? 'neutral', humanize(row.original.action))
		},
		{
			id: 'tableName',
			accessorKey: 'tableName',
			header: sortable('Table'),
			cell: ({ row }) => humanize(row.original.tableName)
		},
		{
			id: 'recordId',
			header: 'Record',
			cell: ({ row }) =>
				row.original.recordEntity
					? link(row.original.recordEntity, row.original.recordId, `#${row.original.recordId}`)
					: `#${row.original.recordId}`
		},
		{ id: 'summary', header: 'Changes', cell: ({ row }) => longText(row.original.summary, 60) },
		{
			id: 'ipAddress',
			header: 'IP',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => row.original.ipAddress ?? '—'
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Audit log"
	eyebrow="Admin"
	description="Changes to prices, refunds, stock, users, roles and settings — who, when, from where, and only the fields that moved. Kept five years. Passwords are never recorded."
/>

<DataTable
	rowHref={(row) => href('auditEntry', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['tableName', 'action', 'userId']}
	facetLabels={{ tableName: 'Table', action: 'Action', userId: 'User' }}
	charts
	dateFilter="Changed"
	fileName="Audit log"
/>
