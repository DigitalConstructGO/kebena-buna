<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import ActionForm from '@nahu/admin-kit/formComponents/ActionForm.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { selectColumn } from '@nahu/admin-kit/components/Table/select-column';
	import Package from '@lucide/svelte/icons/package';
	import Truck from '@lucide/svelte/icons/truck';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Printer from '@lucide/svelte/icons/printer';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { amount, dateTime, link, sortable, status, user } from '#lib/cells.ts';
	import { deliveryName, humanize, money } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	const href = useLinks();
	type Row = (typeof data.rows)[number];

	/*
	 * Posted with the list's own query, so the filters and page are still there afterwards: a bare
	 * `?/bulk` replaced them and dropped the reader back on every order.
	 */
	const bulkAction = $derived(`${page.url.search ? `${page.url.search}&` : '?'}/bulk`);

	/** Orders ticked for a step at the packing bench; kept across pages. */
	let selected = $state<Row[]>([]);
	const BULK = [
		{ step: 'packed', label: 'Mark packed', icon: Package },
		{ step: 'sent', label: 'Mark sent', icon: Truck },
		{ step: 'delivered', label: 'Mark delivered or collected', icon: CircleCheck }
	] as const;

	const baseColumns: ColumnDef<Row>[] = [
		{
			id: 'number',
			accessorKey: 'number',
			header: sortable('Order'),
			cell: ({ row }) => link('order', row.original.id, row.original.number)
		},
		{
			id: 'placedAt',
			accessorKey: 'placedAt',
			header: sortable('Placed'),
			cell: ({ row }) => dateTime(row.original.placedAt)
		},
		{
			id: 'customer',
			header: 'Customer',
			cell: ({ row }) => link('customer', row.original.customerId, row.original.customer)
		},
		{
			id: 'business',
			header: 'Business',
			meta: { class: 'hidden 2xl:table-cell' },
			cell: ({ row }) => link('business', row.original.businessId, row.original.business)
		},
		{
			id: 'channel',
			header: 'Channel',
			meta: { class: 'hidden xl:table-cell' },
			cell: ({ row }) => humanize(row.original.channel)
		},
		{
			id: 'deliveryMethod',
			header: 'Delivery',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => deliveryName(row.original.deliveryMethod)
		},
		{
			id: 'rider',
			header: 'Rider',
			meta: { class: 'hidden 2xl:table-cell' },
			cell: ({ row }) => user(row.original.riderId, row.original.rider)
		},
		{
			id: 'status',
			accessorKey: 'status',
			header: sortable('Status'),
			cell: ({ row }) => status(row.original.status)
		},
		{ id: 'paymentState', header: 'Payment', cell: ({ row }) => status(row.original.paymentState) },
		{
			id: 'total',
			accessorKey: 'total',
			header: sortable('Total (ETB)'),
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.total)
		}
	];
	const columns = $derived(
		data.canManage ? [selectColumn<Row>((row) => row.number), ...baseColumns] : baseColumns
	);
</script>

<PageHeader
	title="Orders"
	description="Every sale — web, desk, Telegram and wholesale — from payment to delivery."
>
	<p class="text-sm text-muted-foreground">
		Shown: {money(data.sums.total)} ordered · {money(data.sums.paid)} received net of refunds
	</p>
</PageHeader>

{#if data.server.filters?.open === '1'}
	<Notice tone="info" class="mt-4" title="Orders still to fulfil">
		Paid, roasting, packed, ready for pickup or out for delivery.
		<a href={resolve('/dashboard/orders')} class="font-medium underline underline-offset-2">
			Show every order
		</a>
	</Notice>
{/if}

{#if selected.length}
	<!-- What the bench does next, for every ticked order; each goes to its own next status. -->
	<div
		class="sticky top-20 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur"
		role="region"
		aria-label="Ticked orders"
	>
		<span class="text-sm font-medium">
			{selected.length}
			{selected.length === 1 ? 'order' : 'orders'} ticked
		</span>
		{#each BULK as b (b.step)}
			{@const Icon = b.icon}
			<ActionForm
				action={bulkAction}
				fields={{ step: b.step, ids: selected.map((r) => r.id).join(',') }}
				onDone={() => (selected = [])}
			>
				{#snippet children({ busy })}
					<Button type="submit" size="sm" variant="outline" class="gap-1.5" disabled={!!busy}>
						{#if busy}<LoadingBtn name="Moving" />{:else}<Icon class="size-4" /> {b.label}{/if}
					</Button>
				{/snippet}
			</ActionForm>
		{/each}
		<Button
			href="/dashboard/orders/slips?ids={selected.map((r) => r.id).join(',')}"
			size="sm"
			variant="outline"
			class="gap-1.5"
		>
			<Printer class="size-4" /> Print packing slips
		</Button>
		<Button size="sm" variant="ghost" class="ml-auto" onclick={() => (selected = [])}>Clear</Button>
	</div>
{/if}

<DataTable
	{columns}
	bind:selected
	getRowId={(row) => String(row.id)}
	data={data.rows}
	server={data.server}
	facetKeys={['status', 'paymentState', 'channel', 'deliveryMethod']}
	facetLabels={{
		status: 'Status',
		paymentState: 'Payment',
		channel: 'Channel',
		deliveryMethod: 'Delivery'
	}}
	tabs="status"
	rowHref={(row) => href('order', row.id)}
	dateFilter="Placed"
	charts
	fileName="Orders"
/>
