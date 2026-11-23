<script lang="ts">
	import Ban from '@lucide/svelte/icons/ban';
	import type { ColumnDef } from '@tanstack/table-core';
	import Play from '@lucide/svelte/icons/play';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { amount, date, dateTime, link, percent, status, user } from '#lib/cells.ts';
	import { choicesOf, formatDate, humanize } from '#lib/format.ts';
	import { badge } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { SUBSCRIPTION_FREQUENCIES } from '#lib/constants.ts';
	import {
		pauseSchema,
		subscriptionCancelSchema,
		subscriptionEditSchema
	} from '#lib/schemas/memberships.ts';

	let { data } = $props();
	const sub = $derived(data.sub);
	const info = $derived(data.info);
	const href = useLinks();
	const open = $derived(sub.status === 'active' || sub.status === 'paused');

	type Bundle = (typeof data.bundles)[number];
	const bundleColumns: ColumnDef<Bundle>[] = [
		{
			id: 'plan',
			header: 'Bundle',
			cell: ({ row }) => row.original.plan ?? `${row.original.deliveries} deliveries`
		},
		{
			id: 'deliveries',
			header: 'Deliveries',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.deliveries
		},
		{
			id: 'discount',
			header: 'Discount',
			meta: { align: 'right' },
			cell: ({ row }) => percent(row.original.discountPct)
		},
		{
			id: 'price',
			header: 'Per delivery (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.pricePerDelivery)
		},
		{
			id: 'order',
			header: 'Order',
			cell: ({ row }) => link('order', row.original.orderId, row.original.orderNumber)
		},
		{ id: 'at', header: 'Bought', cell: ({ row }) => dateTime(row.original.purchasedAt) }
	];

	type Delivery = (typeof data.deliveries)[number];
	// Only an active or paused subscription's roast days still ahead can be skipped or brought back.
	const changeable = (d: Delivery) =>
		open && d.roastDate > data.today && (d.status === 'scheduled' || d.status === 'skipped');
	const deliveryColumns: ColumnDef<Delivery>[] = [
		{ id: 'sequence', header: '#', cell: ({ row }) => row.original.sequence },
		{ id: 'roastDate', header: 'Roast day', cell: ({ row }) => date(row.original.roastDate) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{
			id: 'order',
			header: 'Order',
			cell: ({ row }) => link('order', row.original.orderId, row.original.orderNumber)
		},
		{
			id: 'skipped',
			header: 'Skipped by',
			cell: ({ row }) =>
				row.original.skippedAt
					? user(row.original.skippedById, row.original.skippedBy ?? 'Customer')
					: '—'
		},
		{
			id: 'action',
			header: '',
			cell: ({ row }) =>
				data.canManage && changeable(row.original)
					? renderComponent(ConfirmAction, {
							action: row.original.status === 'scheduled' ? '?/skip' : '?/unskip',
							label: row.original.status === 'scheduled' ? 'Skip' : 'Bring back',
							icon: row.original.status === 'scheduled' ? SkipForward : Undo2,
							variant: 'ghost',
							title:
								row.original.status === 'scheduled'
									? `Skip the ${formatDate(row.original.roastDate)} delivery?`
									: `Send the ${formatDate(row.original.roastDate)} delivery after all?`,
							description: 'A skipped delivery stays prepaid and is not lost.',
							fields: { deliveryId: row.original.id }
						})
					: ''
		}
	];
</script>

<PageHeader
	title={sub.number}
	eyebrow="Subscription"
	description={`${data.info.customer ?? 'Customer'} · ${sub.quantity} × ${info.product} ${info.size ?? ''}`}
>
	{#snippet badges()}
		<Statuses {...badge(sub.status)} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage && sub.status !== 'cancelled' && sub.status !== 'completed'}
			<FormDialog
				title="Change {sub.number}"
				triggerLabel="Change"
				action="?/edit"
				data={data.editForm}
				schema={subscriptionEditSchema}
			>
				{#snippet fields({ form, errors })}
					<InputComp
						label="Coffee"
						name="variantId"
						type="combo"
						items={data.options.variants}
						{form}
						{errors}
						required
					/>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<InputComp
							label="Roast"
							name="roastLevelId"
							type="select"
							items={data.options.roasts}
							{form}
							{errors}
							required
						/>
						<InputComp
							label="Grind"
							name="grindId"
							type="select"
							items={data.options.grinds}
							{form}
							{errors}
						/>
						<InputComp
							label="Bags each time"
							name="quantity"
							type="number"
							{form}
							{errors}
							required
						/>
						<InputComp
							label="Every"
							name="frequency"
							type="select"
							items={choicesOf(SUBSCRIPTION_FREQUENCIES)}
							{form}
							{errors}
							required
						/>
						<InputComp
							label="Address"
							name="addressId"
							type="select"
							items={data.options.addresses}
							{form}
							{errors}
						/>
						<InputComp
							label="Delivery zone"
							name="deliveryZoneId"
							type="select"
							items={data.options.zones}
							{form}
							{errors}
						/>
					</div>
					<InputComp
						label="Next roast day"
						name="nextRoastDate"
						type="date"
						futureDays
						{form}
						{errors}
					/>
				{/snippet}
			</FormDialog>
			{#if sub.status === 'paused'}
				<ConfirmAction
					action="?/resume"
					label="Resume"
					icon={Play}
					title="Resume {sub.number}?"
					description="Deliveries already skipped for the pause stay skipped."
				/>
			{:else if sub.status === 'active'}
				<FormDialog
					title="Pause {sub.number}"
					triggerLabel="Pause"
					action="?/pause"
					data={data.pauseForm}
					schema={pauseSchema}
					submitLabel="Pause"
				>
					{#snippet fields({ form, errors })}
						<InputComp
							label="Paused until"
							name="pausedUntil"
							type="date"
							futureDays
							oldDays={false}
							description="Up to three months. Roast days up to this date are skipped and stay prepaid."
							{form}
							{errors}
							required
						/>
					{/snippet}
				</FormDialog>
			{/if}
			<FormDialog
				title="Cancel {sub.number}"
				triggerLabel="Cancel"
				triggerIcon={Ban}
				submitIcon={Ban}
				submitVariant="destructive"
				action="?/cancel"
				data={data.cancelForm}
				schema={subscriptionCancelSchema}
				submitLabel="Cancel subscription"
			>
				{#snippet fields({ form, errors })}
					<InputComp
						label="Unused deliveries become"
						name="unusedSettlement"
						type="select"
						items={[
							{ value: 'refund', name: 'A refund' },
							{ value: 'store_credit', name: 'Store credit' }
						]}
						{form}
						{errors}
						required
					/>
					<InputComp label="Note" name="note" type="textarea" rows={2} {form} {errors} />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
	<StatCard
		stat={{
			key: 'bought',
			label: 'Deliveries bought',
			value: sub.deliveriesPurchased,
			format: 'count',
			group: 'sub'
		}}
	/>
	<StatCard
		stat={{ key: 'used', label: 'Used', value: sub.deliveriesUsed, format: 'count', group: 'sub' }}
	/>
	<StatCard
		stat={{
			key: 'left',
			label: 'Left',
			value: sub.deliveriesPurchased - sub.deliveriesUsed,
			format: 'count',
			group: 'sub',
			tone: open && sub.deliveriesPurchased - sub.deliveriesUsed <= 1 ? 'warning' : 'positive'
		}}
	/>
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Subscription">
		<SingleTable
			singleTable={[
				{ name: 'Customer', value: info.customer ?? '—', href: href('customer', sub.customerId) },
				{ name: 'Phone', value: info.customerPhone, kind: 'phone' },
				{
					name: 'Membership',
					value: info.membership ?? '—',
					href: href('membership', sub.membershipId)
				},
				{
					name: 'Coffee',
					value: `${info.product} · ${info.size ?? ''} (${info.sku})`,
					href: href('variant', sub.variantId)
				},
				{ name: 'Roast', value: info.roast },
				{ name: 'Grind', value: info.grind ?? '—' },
				{ name: 'Bags each time', value: sub.quantity },
				{ name: 'Every', value: sub.frequency === 'biweekly' ? 'Two weeks' : 'Month' },
				{ name: 'Next roast day', value: formatDate(sub.nextRoastDate) },
				{ name: 'Paused until', value: formatDate(sub.pausedUntil) },
				{ name: 'Address', value: info.address ?? '—', long: 40 },
				{ name: 'Delivery zone', value: info.zone ?? '—' },
				...(sub.cancelledAt
					? [
							{ name: 'Cancelled', value: formatDate(sub.cancelledAt) },
							{ name: 'Unused become', value: humanize(sub.unusedSettlement) }
						]
					: []),
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection
			title="Deliveries"
			hint="One per roast day. Each becomes a zero-priced order when its roast day comes."
		>
			{#if data.deliveries.length}
				<DataTable
					variant="compact"
					columns={deliveryColumns}
					data={data.deliveries}
					defaultPageSize={12}
				/>
			{:else}<Empty message="No deliveries scheduled" />{/if}
		</PageSection>
		<PageSection title="Bundles bought">
			{#if data.bundles.length}
				<DataTable variant="compact" columns={bundleColumns} data={data.bundles} />
			{:else}<Empty message="Paid by the membership plan" />{/if}
		</PageSection>
	</div>
</div>
