<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { dateTime, link, phone, sortable, status, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];
	/** A score this high is very likely spam (8.5): tinted, never hidden. */
	const SPAM = 50;

	const columns: ColumnDef<Row>[] = [
		{
			id: 'submittedAt',
			accessorKey: 'submittedAt',
			header: sortable('Received'),
			cell: ({ row }) => link('submission', row.original.id, dateTime(row.original.submittedAt))
		},
		{ id: 'formType', header: 'Form', cell: ({ row }) => humanize(row.original.formType) },
		{
			id: 'subject',
			header: 'Subject',
			cell: ({ row }) => link('submission', row.original.id, row.original.subject ?? '(no subject)')
		},
		{
			id: 'name',
			header: 'From',
			cell: ({ row }) => link('customer', row.original.customerId, row.original.name)
		},
		{
			id: 'phone',
			header: 'Phone',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => phone(row.original.phone)
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{
			id: 'assignedTo',
			header: 'Handled by',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => user(row.original.assignedTo, row.original.assignee)
		},
		{
			id: 'rating',
			accessorKey: 'rating',
			header: sortable('Rating'),
			meta: { align: 'right', class: 'hidden lg:table-cell' },
			cell: ({ row }) => (row.original.rating ? '★'.repeat(row.original.rating) : '—')
		},
		{
			id: 'spamScore',
			accessorKey: 'spamScore',
			header: sortable('Spam'),
			meta: { align: 'right', class: 'hidden lg:table-cell' },
			cell: ({ row }) => row.original.spamScore ?? '—'
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Inbox"
	description="Every public form — bookings, enquiries, feedback, quotes and wholesale applications — in one shared workflow."
/>

<DataTable
	rowHref={(row) => href('submission', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['formType', 'status', 'assignedTo']}
	facetLabels={{ formType: 'Form', status: 'Status', assignedTo: 'Handled by' }}
	dateFilter="Received"
	rowClass={(row) =>
		(row.spamScore ?? 0) >= SPAM ? 'opacity-60' : row.status === 'new' ? 'font-medium' : null}
	charts
	fileName="Inbox"
/>
