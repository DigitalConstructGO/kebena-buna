<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { date, link, sortable, status } from '#lib/cells.ts';
	import { humanize } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const columns: ColumnDef<Row>[] = [
		{ id: 'number', accessorKey: 'number', header: sortable('Subscription'), cell: ({ row }) => link('subscription', row.original.id, row.original.number) },
		{ id: 'customer', accessorKey: 'customer', header: sortable('Customer'), cell: ({ row }) => link('customer', row.original.customerId, row.original.customer) },
		{ id: 'coffee', header: 'Coffee', cell: ({ row }) => link('product', row.original.productId, `${row.original.quantity} × ${row.original.coffee}`) },
		{ id: 'roast', header: 'Roast', meta: { class: 'hidden md:table-cell' }, cell: ({ row }) => row.original.roast },
		{ id: 'frequency', header: 'Every', cell: ({ row }) => (row.original.frequency === 'biweekly' ? '2 weeks' : 'Month') },
		{ id: 'nextRoastDate', accessorKey: 'nextRoastDate', header: sortable('Next roast'), cell: ({ row }) => date(row.original.nextRoastDate) },
		{ id: 'left', accessorKey: 'left', header: sortable('Deliveries left'), meta: { align: 'right' } },
		{ id: 'membership', header: 'Membership', meta: { class: 'hidden lg:table-cell' }, cell: ({ row }) => link('membership', row.original.membershipId, row.original.membership) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status, humanize(row.original.status)) }
	];
	const href = useLinks();
</script>

<PageHeader
	title="Subscriptions"
	description="Prepaid coffee deliveries on a roast-day schedule. A Patron's monthly bag is a subscription tied to their membership."
/>

<DataTable
	rowHref={(row) => href('subscription', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['status', 'frequency']}
	facetLabels={{ status: 'Status', frequency: 'Frequency' }}
	dateFilter="Next roast"
	charts
	fileName="Subscriptions"
/>
