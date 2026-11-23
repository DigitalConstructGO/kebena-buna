<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { amount, date, kg, link, percent, phone, sortable, status, user } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			accessorKey: 'name',
			header: sortable('Business'),
			cell: ({ row }) => link('business', row.original.id, row.original.name)
		},
		{ id: 'type', header: 'Type', cell: ({ row }) => humanize(row.original.type) },
		{
			id: 'contact',
			header: 'Contact',
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => row.original.contactName
		},
		{
			id: 'phone',
			header: 'Phone',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => phone(row.original.contactPhone)
		},
		{
			id: 'approvalStatus',
			header: 'Approval',
			cell: ({ row }) => status(row.original.approvalStatus)
		},
		{
			id: 'expectedMonthlyKg',
			accessorKey: 'expectedMonthlyKg',
			header: sortable('Expected / month'),
			meta: { align: 'right', class: 'hidden md:table-cell' },
			cell: ({ row }) => kg(row.original.expectedMonthlyKg)
		},
		{
			id: 'discountPct',
			accessorKey: 'discountPct',
			header: sortable('Extra discount'),
			meta: { align: 'right' },
			cell: ({ row }) => percent(row.original.discountPct)
		},
		{
			id: 'credit',
			header: 'Credit',
			cell: ({ row }) =>
				row.original.creditApproved
					? `${amount(row.original.creditLimit)} · ${row.original.paymentTermsDays} days`
					: 'Prepaid'
		},
		{
			id: 'members',
			header: 'People',
			meta: { align: 'right', class: 'hidden lg:table-cell' },
			cell: ({ row }) => row.original.members
		},
		{
			id: 'orders',
			accessorKey: 'orders',
			header: sortable('Orders'),
			meta: { align: 'right' },
			cell: ({ row }) => row.original.orders
		},
		{
			id: 'requestedBy',
			header: 'Entered by',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => user(row.original.requestedById, row.original.requestedBy)
		},
		{
			id: 'createdAt',
			accessorKey: 'createdAt',
			header: sortable('Applied'),
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => date(row.original.createdAt)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Business accounts"
	description="Cafés, hotels, offices and retailers. They see wholesale prices only once approved; credit is an exception set per account."
>
	{#snippet actions()}
		{#if data.canManage}
			<Button href="/dashboard/wholesale/accounts/new"><Plus class="size-4" /> New account</Button>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('business', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['approvalStatus', 'type', 'credit']}
	facetLabels={{ approvalStatus: 'Approval', type: 'Type', credit: 'On credit' }}
	dateFilter="Applied"
	charts
	fileName="Business accounts"
/>
