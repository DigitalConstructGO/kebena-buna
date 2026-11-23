<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { fileUrl } from '@nahu/admin-kit/files';
	import { date, link, status } from '#lib/cells.ts';
	import { humanize, money, pct, tr, yesNo } from '#lib/format.ts';
	import { badge, flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';

	let { data } = $props();
	const p = $derived(data.plan);
	const href = useLinks();
	const countOf = (s: string) => data.byStatus.find((b) => b.status === s)?.count ?? 0;

	type Row = (typeof data.recent)[number];
	const columns: ColumnDef<Row>[] = [
		{
			id: 'number',
			header: 'Membership',
			cell: ({ row }) => link('membership', row.original.id, row.original.number)
		},
		{
			id: 'customer',
			header: 'Customer',
			cell: ({ row }) => link('customer', row.original.customerId, row.original.customer)
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{ id: 'startsOn', header: 'Starts', cell: ({ row }) => date(row.original.startsOn) },
		{ id: 'endsOn', header: 'Ends', cell: ({ row }) => date(row.original.endsOn) }
	];
</script>

<PageHeader
	title={tr(p.name)}
	eyebrow="Membership plan"
	description={`${p.code} · ${money(p.price)} for ${p.durationMonths} months`}
>
	{#snippet badges()}
		<Statuses {...badge(p.publishStatus)} />
		<Statuses {...flag(p.isActive)} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<!-- A page of its own: thirty-odd fields were too many for a dialog. -->
			<Button
				href="/dashboard/memberships/plans/{p.id}/edit"
				variant="ghost"
				size="sm"
				class="gap-1"
			>
				<SquarePen class="size-4" /> Edit
			</Button>
			<ConfirmAction
				action="?/delete"
				label="Delete"
				icon={Trash2}
				variant="destructive"
				title="Delete {tr(p.name)}?"
				description="Only a plan nothing was sold on can be deleted. Otherwise switch it off: existing members keep their terms."
			/>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
	<StatCard
		stat={{
			key: 'active',
			label: 'Active',
			value: countOf('active'),
			format: 'count',
			group: 'plan',
			tone: 'positive'
		}}
	/>
	<StatCard
		stat={{
			key: 'grace',
			label: 'In grace',
			value: countOf('grace'),
			format: 'count',
			group: 'plan',
			tone: 'warning'
		}}
	/>
	<StatCard
		stat={{
			key: 'pending',
			label: 'Awaiting payment',
			value: countOf('pending_payment'),
			format: 'count',
			group: 'plan'
		}}
	/>
	<StatCard
		stat={{
			key: 'lapsed',
			label: 'Lapsed',
			value: countOf('lapsed'),
			format: 'count',
			group: 'plan',
			tone: 'negative'
		}}
	/>
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Plan">
		{#if p.image}<img
				src={fileUrl(p.image)}
				alt=""
				class="mb-4 max-h-40 rounded-lg object-cover"
			/>{/if}
		<SingleTable
			singleTable={[
				{ name: 'Name (Amharic)', value: p.name?.am ?? '—' },
				{ name: 'Price', value: money(p.price) },
				{ name: 'Tax', value: data.tax ?? '—' },
				{ name: 'Duration', value: `${p.durationMonths} months, ${p.graceDays} days' grace` },
				{ name: 'Covers', value: `${p.maxAdults} adult(s), ${p.maxChildren} child(ren)` },
				{ name: 'Shared card admits', value: p.sharedCardAdmits ?? 'A card each' },
				{ name: 'Proof needed', value: tr(p.requiresProof) || '—' },
				{ name: 'Free entry', value: yesNo(p.freeEntry) },
				{ name: 'Shop discount', value: pct(p.shopDiscountPct) },
				{ name: 'Free delivery', value: yesNo(p.freeDelivery) },
				{ name: 'Members-only events', value: yesNo(p.membersOnlyEvents) },
				{
					name: 'Monthly coffee',
					value: data.variant ?? '—',
					href: href('variant', data.variantId)
				},
				{ name: 'Description', value: tr(p.description) || '—', long: 40 },
				{ name: 'Benefits by hand', value: tr(p.benefits) || '—', long: 40 },
				{ name: 'Status', value: humanize(p.publishStatus), kind: 'status' },
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<PageSection title="Memberships on this plan" hint="The latest hundred.">
		{#if data.recent.length}
			<DataTable variant="compact" {columns} data={data.recent} />
		{:else}<Empty message="None sold yet" />{/if}
	</PageSection>
</div>
