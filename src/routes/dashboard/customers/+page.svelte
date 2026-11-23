<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { amount, date, dateTime, link, phone, sortable, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			accessorKey: 'name',
			header: sortable('Customer'),
			cell: ({ row }) =>
				link(
					'customer',
					row.original.id,
					row.original.anonymizedAt ? 'Anonymised customer' : (row.original.name ?? 'Guest')
				)
		},
		{ id: 'phone', header: 'Phone', cell: ({ row }) => phone(row.original.phone) },
		{
			id: 'email',
			header: 'Email',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => row.original.email ?? '—'
		},
		{
			id: 'orders',
			accessorKey: 'orders',
			header: sortable('Orders'),
			meta: { align: 'right' },
			cell: ({ row }) => row.original.orders
		},
		{
			id: 'spent',
			accessorKey: 'spent',
			header: sortable('Spent (ETB)'),
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.spent)
		},
		{
			id: 'credit',
			accessorKey: 'credit',
			header: sortable('Credit (ETB)'),
			meta: { align: 'right', class: 'hidden md:table-cell' },
			cell: ({ row }) => amount(row.original.credit)
		},
		{
			id: 'lastActivityAt',
			accessorKey: 'lastActivityAt',
			header: sortable('Last active'),
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => dateTime(row.original.lastActivityAt)
		},
		{
			id: 'signIn',
			header: 'Sign-in',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => (row.original.userId ? user(row.original.userId, row.original.userName) : 'Guest')
		},
		{
			id: 'source',
			header: 'Source',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => humanize(row.original.source)
		},
		{
			id: 'locale',
			header: 'Language',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => row.original.locale.toUpperCase()
		},
		{
			id: 'createdBy',
			header: 'Added by',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => user(row.original.createdById, row.original.createdBy)
		},
		{
			id: 'createdAt',
			accessorKey: 'createdAt',
			header: sortable('Added'),
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => date(row.original.createdAt)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Customers"
	description="One record per person, with or without a sign-in: their orders, tickets, memberships, subscriptions and bookings."
>
	{#snippet actions()}
		{#if data.canManage}
			<Button href="/dashboard/customers/new"><Plus class="size-4" /> New customer</Button>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('customer', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['source', 'locale', 'signIn']}
	facetLabels={{ source: 'Source', locale: 'Language', signIn: 'Has sign-in' }}
	dateFilter="Added"
	charts
	fileName="Customers"
/>
