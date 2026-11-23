<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { dateTime, sortable } from '#lib/cells.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const kind = (key: string) => key.split(':')[0].replaceAll('_', ' ');
	const columns: ColumnDef<Row>[] = [
		{ id: 'key', accessorKey: 'key', header: sortable('Series') },
		{ id: 'kind', accessorFn: (r) => kind(r.key), header: 'Document' },
		{ id: 'nextValue', accessorKey: 'nextValue', header: sortable('Next number'), meta: { align: 'right' } },
		{ id: 'used', accessorFn: (r) => r.nextValue - 1, header: 'Issued', meta: { align: 'right' } },
		{ id: 'updatedAt', header: 'Last issued', cell: ({ row }) => dateTime(row.original.updatedAt) }
	];
</script>

<PageHeader
	title="Document numbers"
	eyebrow="Admin"
	description="Order, lot and roast-batch numbers are taken from these series under a lock, so no two documents share one and a cancelled write never skips one. Read-only."
/>

<div class="mt-4">
	<DataTable {columns} data={data.rows} facetKeys={['kind']} facetLabels={{ kind: 'Document' }} fileName="Document numbers" />
</div>
