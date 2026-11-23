<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import ReportChart from '@nahu/admin-kit/components/reports/ReportChart.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import PeriodFilter from '@nahu/admin-kit/formComponents/PeriodFilter.svelte';
	import { amount, date, dateTime, kg, link, percent, status } from '#lib/cells.ts';
	import { formatDate, humanize } from '#lib/format.ts';

	let { data } = $props();
	const p = $derived(data.period);

	type Group = NonNullable<typeof data.sales>['byGroup'][number];
	const groupColumns: ColumnDef<Group>[] = [
		{ id: 'group', accessorKey: 'group', header: 'Sold as' },
		{ id: 'lines', accessorKey: 'lines', header: 'Items', meta: { align: 'right' } },
		{
			id: 'net',
			header: 'Before VAT (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.revenue - row.original.vat)
		},
		{
			id: 'vat',
			header: 'VAT (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.vat)
		},
		{
			id: 'revenue',
			header: 'Total (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.revenue)
		}
	];

	type Seller = (typeof data.bestSellers)[number];
	const sellerColumns: ColumnDef<Seller>[] = [
		{
			id: 'product',
			header: 'Coffee',
			// Size and roast in the one cell: the table shares its row with another.
			cell: ({ row }) =>
				link(
					'variant',
					row.original.variantId,
					[row.original.product, row.original.size, row.original.roast].filter(Boolean).join(' · ')
				)
		},
		{ id: 'bags', accessorKey: 'bags', header: 'Sold', meta: { align: 'right' } },
		{
			id: 'revenue',
			header: 'Revenue (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.revenue)
		}
	];

	type Aud = NonNullable<typeof data.visits>['byAudience'][number];
	const audienceColumns: ColumnDef<Aud>[] = [
		{ id: 'audience', accessorKey: 'audience', header: 'Audience' },
		{ id: 'tickets', accessorKey: 'tickets', header: 'Tickets', meta: { align: 'right' } },
		{ id: 'admits', accessorKey: 'admits', header: 'Visitors', meta: { align: 'right' } },
		{ id: 'checkedIn', accessorKey: 'checkedIn', header: 'Checked in', meta: { align: 'right' } }
	];

	type Renewal = NonNullable<typeof data.members>['renewals'][number];
	const renewalColumns: ColumnDef<Renewal>[] = [
		{
			id: 'number',
			header: 'Membership',
			cell: ({ row }) => link('membership', row.original.id, row.original.number)
		},
		{
			id: 'customer',
			header: 'Member',
			cell: ({ row }) => link('customer', row.original.customerId, row.original.customer)
		},
		{ id: 'plan', accessorKey: 'plan', header: 'Plan' },
		{ id: 'endsOn', header: 'Ends', cell: ({ row }) => date(row.original.endsOn) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];

	type Roast = (typeof data.roasts)[number];
	const roastColumns: ColumnDef<Roast>[] = [
		{
			id: 'code',
			header: 'Batch',
			cell: ({ row }) => link('roastBatch', row.original.id, row.original.code)
		},
		{ id: 'at', header: 'Roasted', cell: ({ row }) => dateTime(row.original.roastedAt) },
		{ id: 'roast', accessorKey: 'roast', header: 'Roast' },
		{ id: 'lots', header: 'Lots', cell: ({ row }) => row.original.lots ?? '—' },
		{
			id: 'in',
			header: 'Green in',
			meta: { align: 'right' },
			cell: ({ row }) => kg(row.original.greenKgIn)
		},
		{
			id: 'out',
			header: 'Roasted out',
			meta: { align: 'right' },
			cell: ({ row }) => kg(row.original.roastedKgOut)
		},
		{
			id: 'loss',
			header: 'Loss',
			meta: { align: 'right' },
			cell: ({ row }) => {
				const loss = Number(row.original.weightLossPct ?? 0);
				return loss && (loss < 12 || loss > 20)
					? status('overdue', percent(loss))
					: percent(row.original.weightLossPct);
			}
		}
	];

	type Count = { status: string; count: number };
	const countColumns: ColumnDef<Count>[] = [
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{ id: 'count', accessorKey: 'count', header: 'Count', meta: { align: 'right' } }
	];

	type Discount = (typeof data.discounts)[number];
	const discountColumns: ColumnDef<Discount>[] = [
		{
			id: 'code',
			header: 'Code',
			cell: ({ row }) => link('discount', row.original.id, row.original.code)
		},
		{ id: 'kind', header: 'Kind', cell: ({ row }) => humanize(row.original.kind) },
		{ id: 'uses', accessorKey: 'uses', header: 'Uses', meta: { align: 'right' } },
		{
			id: 'discount',
			header: 'Discount given (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.discount)
		}
	];

	const avgLoss = $derived(
		data.roasts.length
			? data.roasts.reduce((sum, r) => sum + Number(r.weightLossPct ?? 0), 0) / data.roasts.length
			: 0
	);
	const nothing = $derived(
		!data.sales && !data.visits && !data.members && !data.stock && !data.workflow
	);
</script>

<PageHeader
	title="Reports"
	description="{formatDate(p.from)} – {formatDate(
		p.to
	)}. Every table exports to CSV and Excel from its toolbar."
>
	<div class="mt-3"><PeriodFilter from={p.from} to={p.to} /></div>
</PageHeader>

{#if nothing}
	<div class="mt-6"><Empty message="Your role opens no records these reports sum." /></div>
{/if}

{#if data.sales}
	<section class="mt-8 grid grid-cols-1 gap-4">
		<h2 class="text-lg font-semibold">Sales and VAT</h2>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
			{#each data.sales.stats as stat (stat.key)}<StatCard {stat} amharicMoney={false} />{/each}
		</div>
		<ReportChart chart={data.sales.byDay} amharicMoney={false} />
		<div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
			<PageSection
				title="By what was sold"
				hint="Shop, tickets, memberships, bookings and subscriptions, with the VAT inside each."
			>
				{#if data.sales.byGroup.length}
					<DataTable
						variant="compact"
						columns={groupColumns}
						data={data.sales.byGroup}
						fileName="Sales by kind {p.from} to {p.to}"
					/>
				{:else}<Empty message="No paid orders in this period" />{/if}
			</PageSection>
			<PageSection title="Best sellers" hint="Bags by product, size and roast.">
				{#if data.bestSellers.length}
					<DataTable
						variant="compact"
						columns={sellerColumns}
						data={data.bestSellers}
						fileName="Best sellers {p.from} to {p.to}"
					/>
				{:else}<Empty message="No coffee sold in this period" />{/if}
			</PageSection>
		</div>
		{#if data.discounts.length}
			<PageSection title="Discount codes used">
				<DataTable
					variant="compact"
					columns={discountColumns}
					data={data.discounts}
					fileName="Discount usage {p.from} to {p.to}"
				/>
			</PageSection>
		{/if}
	</section>
{/if}

{#if data.visits}
	<section class="mt-8 grid grid-cols-1 gap-4">
		<h2 class="text-lg font-semibold">Tickets and check-ins</h2>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{#each data.visits.stats as stat (stat.key)}<StatCard {stat} amharicMoney={false} />{/each}
		</div>
		{#if data.visits.byDay.labels.length}<ReportChart
				chart={data.visits.byDay}
				amharicMoney={false}
			/>{/if}
		<PageSection title="Resident and foreign">
			{#if data.visits.byAudience.length}
				<DataTable
					variant="compact"
					columns={audienceColumns}
					data={data.visits.byAudience}
					fileName="Visitors by audience {p.from} to {p.to}"
				/>
			{:else}<Empty message="No visits in this period" />{/if}
		</PageSection>
	</section>
{/if}

{#if data.members}
	<section class="mt-8 grid grid-cols-1 gap-4">
		<h2 class="text-lg font-semibold">Members and subscriptions</h2>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{#each data.members.stats as stat (stat.key)}<StatCard {stat} amharicMoney={false} />{/each}
		</div>
		<PageSection title="Renewals due in the next 30 days">
			{#if data.members.renewals.length}
				<DataTable
					variant="compact"
					columns={renewalColumns}
					data={data.members.renewals}
					fileName="Renewals due"
				/>
			{:else}<Empty message="No membership ends in the next 30 days" />{/if}
		</PageSection>
	</section>
{/if}

{#if data.stock}
	<section class="mt-8 grid grid-cols-1 gap-4">
		<h2 class="text-lg font-semibold">Stock and roasting</h2>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
			{#each data.stock.stats as stat (stat.key)}<StatCard {stat} amharicMoney={false} />{/each}
		</div>
		<PageSection
			title="Roast yield"
			hint={data.roasts.length
				? `Average weight loss ${avgLoss.toFixed(1)}%; outside 12–20% is flagged.`
				: undefined}
		>
			{#if data.roasts.length}
				<DataTable
					variant="compact"
					columns={roastColumns}
					data={data.roasts}
					fileName="Roast yield {p.from} to {p.to}"
				/>
			{:else}<Empty message="No roasts in this period" />{/if}
		</PageSection>
	</section>
{/if}

{#if data.workflow}
	<section class="mt-8 grid grid-cols-1 gap-4">
		<h2 class="text-lg font-semibold">Bookings and the inbox</h2>
		<div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
			<PageSection title="Bookings by status" hint="Made in this period.">
				{#if data.workflow.bookings.length}
					<DataTable variant="compact" columns={countColumns} data={data.workflow.bookings} />
				{:else}<Empty message="No bookings in this period" />{/if}
			</PageSection>
			<PageSection title="Form submissions by status" hint="Received in this period.">
				{#if data.workflow.submissions.length}
					<DataTable variant="compact" columns={countColumns} data={data.workflow.submissions} />
				{:else}<Empty message="No submissions in this period" />{/if}
			</PageSection>
		</div>
	</section>
{/if}
