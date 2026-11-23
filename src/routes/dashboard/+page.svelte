<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import ReportChart from '@nahu/admin-kit/components/reports/ReportChart.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import Flame from '@lucide/svelte/icons/flame';
	import Package from '@lucide/svelte/icons/package';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { useKit } from '@nahu/admin-kit/context';
	import { useLinks } from '#lib/links.ts';
	import { amount, date, link, status } from '#lib/cells.ts';
	import { humanize, languageName } from '#lib/format.ts';
	import { localClock } from '@nahu/admin-kit/time';

	let { data } = $props();
	const href = useLinks();
	const kit = useKit();

	/** The day's common jobs, one tap from home — each only for a role that may do it. */
	const QUICK = [
		{ label: 'Check-in desk', url: '/dashboard/visits/desk', icon: ScanLine },
		{ label: 'Record roast', url: '/dashboard/stock/roasts/new', icon: Flame },
		{ label: 'Record packing', url: '/dashboard/stock/packing/new', icon: Package },
		{ label: 'New customer', url: '/dashboard/customers/new', icon: UserPlus }
	];
	const quick = $derived(QUICK.filter((q) => kit.canOpen(q.url)));

	/** A queue row starts the roast it is waiting for, when the viewer may record one. */
	const roastUrl = (row: { productId: number; roastLevelId: number | null }) =>
		kit.canOpen('/dashboard/stock/roasts/new')
			? `/dashboard/stock/roasts/new?product=${row.productId}${row.roastLevelId ? `&roast=${row.roastLevelId}` : ''}&toOrder=1`
			: undefined;

	/** Days since an order was paid, by the clock — a paid order should leave within a working day. */
	const DAY = 24 * 60 * 60 * 1000;
	const daysWaiting = (paidAt: Date | string | null) =>
		paidAt ? Math.max(0, Math.floor((Date.now() - new Date(paidAt).getTime()) / DAY)) : 0;
	/** Past this, an order is late rather than in progress (questionnaire: dispatch in 1 working day). */
	const LATE_AFTER_DAYS = 2;
	const waitingFor = (days: number) =>
		days === 0
			? 'Today'
			: days < 60
				? `${days} ${days === 1 ? 'day' : 'days'}`
				: `${Math.floor(days / 30)} months`;

	type Waiting = (typeof data.waiting)[number];
	const waitingColumns: ColumnDef<Waiting>[] = [
		{ id: 'number', header: 'Order', cell: ({ row }) => link('order', row.original.id, row.original.number) },
		{ id: 'customer', header: 'Customer', cell: ({ row }) => link('customer', row.original.customerId, row.original.customer) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		// Packers group the day's work by how it leaves: rider, courier or pickup.
		{ id: 'delivery', header: 'Delivery', cell: ({ row }) => humanize(row.original.deliveryMethod) },
		{
			id: 'waiting',
			header: 'Waiting',
			cell: ({ row }) => {
				const days = daysWaiting(row.original.paidAt);
				return days > LATE_AFTER_DAYS ? status('overdue', waitingFor(days)) : waitingFor(days);
			}
		},
		{ id: 'total', header: 'Total (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.total) }
	];

	type Queue = (typeof data.roastQueue)[number];
	const overdueRoast = (row: Queue) => Boolean(row.roastOn && row.roastOn < data.today);
	const queueColumns: ColumnDef<Queue>[] = [
		{
			id: 'roastOn',
			header: 'Roast day',
			cell: ({ row }) =>
				overdueRoast(row.original) ? status('overdue', date(row.original.roastOn)) : date(row.original.roastOn)
		},
		{
			id: 'what',
			header: 'Coffee',
			// Size and roast in the one cell: this table sits in the narrow column.
			cell: ({ row }) =>
				link(
					'variant',
					row.original.variantId,
					[row.original.product, row.original.size, row.original.roast].filter(Boolean).join(' · ')
				)
		},
		{ id: 'bags', header: 'Bags', meta: { align: 'right' }, cell: ({ row }) => row.original.bags }
	];

	type Session = (typeof data.sessions)[number];
	const sessionColumns: ColumnDef<Session>[] = [
		{ id: 'at', header: 'Time', cell: ({ row }) => link('session', row.original.id, localClock(row.original.startsAt)) },
		{ id: 'what', header: 'What', cell: ({ row }) => link('bookable', row.original.bookableId, row.original.bookable) },
		{ id: 'lang', header: 'Language', cell: ({ row }) => languageName(row.original.language) },
		{ id: 'booked', header: 'Booked', meta: { align: 'right' }, cell: ({ row }) => `${row.original.booked} / ${row.original.capacity}` }
	];

	const shows = (key: string) => data.stats.some((s) => s.key === key);
	const late = $derived(data.waiting.filter((w) => daysWaiting(w.paidAt) > LATE_AFTER_DAYS).length);
	const lateRoasts = $derived(data.roastQueue.filter(overdueRoast).length);
</script>

<PageHeader title="Dashboard" description="Today at the museum, the shop and the roastery.">
	{#snippet actions()}
		{#each quick as q (q.url)}
			{@const Icon = q.icon}
			<Button href={q.url} variant="outline" size="sm" class="gap-1.5"><Icon class="size-4" /> {q.label}</Button>
		{/each}
	{/snippet}
</PageHeader>

{#if data.stats.length}
	<div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
		{#each data.stats as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</div>
{:else}
	<div class="mt-6">
		<Empty message="Nothing to show yet: your role opens no section with figures. Use the menu for your pages." />
	</div>
{/if}

{#if data.decisions.length}
	<!-- Waiting on someone's say-so rather than on someone's hands. -->
	<PageSection title="Needs your decision" class="mt-6">
		<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{#each data.decisions as d (d.key)}
				<li>
					<a
						href={d.href}
						class="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<span class="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-lg font-semibold text-amber-700 tabular-nums dark:text-amber-400"
							>{d.count}</span
						>
						<span class="min-w-0 flex-1">
							<span class="block font-medium">{d.label}</span>
							<span class="block truncate text-sm text-muted-foreground">{d.hint}</span>
						</span>
						<ChevronRight class="size-4 shrink-0 text-muted-foreground" />
					</a>
				</li>
			{/each}
		</ul>
	</PageSection>
{/if}

<!-- The day's work before the month's trend: what needs hands on it now. -->
<!-- Side by side only on a wide screen; on a laptop the orders take the full width and the two
     smaller tables share the row under them, each wide enough for its columns. -->
<div class="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
	{#if shows('fulfil')}
		<PageSection
			title="Orders waiting"
			hint={late
				? `Paid and not yet with the customer, oldest first. ${late} waiting more than ${LATE_AFTER_DAYS} days.`
				: "Paid and not yet with the customer, oldest first."}
		>
			{#snippet actions()}
				<Button href="/dashboard/orders?open=1" variant="ghost" size="sm" class="gap-1">See all <ChevronRight class="size-4" /></Button>
			{/snippet}
			{#if data.waiting.length}
				<DataTable
					variant="compact"
					columns={waitingColumns}
					data={data.waiting}
					rowHref={(row) => href('order', row.id)}
				/>
			{:else}<Empty message="Every paid order has been fulfilled" />{/if}
		</PageSection>
	{/if}
	{#if shows('bookings') || shows('low')}
		<div class="grid min-w-0 grid-cols-1 content-start gap-6 lg:grid-cols-2 2xl:grid-cols-1">
			{#if shows('bookings')}
				<PageSection title="Today's sessions">
					{#if data.sessions.length}
						<DataTable
							variant="compact"
							columns={sessionColumns}
							data={data.sessions}
							rowHref={(row) => href('session', row.id)}
						/>
					{:else}<Empty message="No tours, ceremonies or cuppings today" />{/if}
				</PageSection>
			{/if}
			{#if shows('low')}
				<PageSection
					title="Roast-to-order queue"
					hint={[
						'Bags ordered for a roast day and not yet roasted.',
						lateRoasts ? `${lateRoasts} past their roast day.` : '',
						kit.canOpen('/dashboard/stock/roasts/new') ? 'Open a row to record its roast.' : ''
					]
						.filter(Boolean)
						.join(' ')}
				>
					{#if data.roastQueue.length}
						<DataTable
							variant="compact"
							columns={queueColumns}
							data={data.roastQueue}
							rowHref={(row) => roastUrl(row) ?? href('variant', row.variantId)}
						/>
					{:else}<Empty message="Nothing waiting to be roasted" />{/if}
				</PageSection>
			{/if}
		</div>
	{/if}
</div>

{#if data.charts.length}
	<div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
		{#each data.charts as chart (chart.key)}
			<ReportChart {chart} amharicMoney={false} />
		{/each}
	</div>
{/if}
