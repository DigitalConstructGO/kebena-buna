<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Globe from '@lucide/svelte/icons/globe';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Archive from '@lucide/svelte/icons/archive';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import LookupFileCell from '@nahu/admin-kit/components/lookup/LookupFileCell.svelte';
	import { childActionPaths } from '@nahu/admin-kit/components/lookup/actions';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { amount, dateTime, link, status } from '#lib/cells.ts';
	import { formatDateTime, money, tr, yesNo } from '#lib/format.ts';
	import { badge, flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { amountRange, describeRule, inWindow, weightOf } from '#lib/bundles.ts';
	import {
		bundleEditSchema,
		bundleImageSchema,
		bundleItemEditSchema,
		bundleItemSchema
	} from '#lib/schemas/catalog.ts';
	import BundleFields from '../BundleFields.svelte';

	let { data } = $props();
	const b = $derived(data.bundle);
	const t = $derived(data.totals);
	const href = useLinks();
	const name = $derived(tr(b.name));
	const rule = $derived({ pricing: b.pricing, value: Number(b.value) });
	const running = $derived(inWindow(b));
	const moneyRange = (min: number, max: number) => (min === max ? money(min) : `${money(min)} – ${money(max)}`);
	const hasChoice = $derived(data.items.rows.some((r) => r.choices !== null));

	type Sale = (typeof data.sales)[number];
	const saleColumns: ColumnDef<Sale>[] = [
		{ id: 'order', header: 'Order', cell: ({ row }) => link('order', row.original.orderId, row.original.number) },
		{ id: 'placed', header: 'Placed', cell: ({ row }) => dateTime(row.original.placedAt) },
		{ id: 'bags', header: 'Bags', meta: { align: 'right' }, cell: ({ row }) => row.original.bags },
		{ id: 'list', header: 'Bags alone (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.list) },
		{ id: 'discount', header: 'Saved (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.discount) },
		{ id: 'total', header: 'Paid (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.total) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
</script>

<PageHeader title={name} eyebrow="Bundle" description={`${describeRule(rule)} · ${t.bags} bag${t.bags === 1 ? '' : 's'} · ${weightOf(t.grams)} of coffee`}>
	{#snippet badges()}
		<Statuses {...badge(b.publishStatus)} />
		{#if !b.isActive}<Statuses {...flag(false)} />{/if}
		{#if !running}<Statuses {...flag(false, '', b.endsAt && new Date(b.endsAt) < new Date() ? 'Ended' : 'Not started')} />{/if}
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog title="Edit {name}" action="?/edit" data={data.editForm} schema={bundleEditSchema} dataType="json">
				{#snippet fields({ form, errors })}
					<InputComp type="hidden" name="id" {form} {errors} />
					<BundleFields form={form as never} errors={errors as never} />
					<InputComp label="Active" name="isActive" type="checkboxSingle" placeholder="Offered for sale" {form} {errors} />
				{/snippet}
			</FormDialog>
			{#if b.publishStatus === 'published'}
				<ConfirmAction action="?/publish" fields={{ to: 'draft' }} label="Unpublish" icon={EyeOff} variant="outline" title="Take {name} off the website?" description="It goes back to draft; orders already placed keep their price." />
			{:else}
				<ConfirmAction action="?/publish" fields={{ to: 'published' }} label="Publish" icon={Globe} title="Publish {name}?" description="It appears in the shop while its offer runs." />
			{/if}
			{#if data.sums.sold}
				{#if b.publishStatus !== 'archived'}
					<ConfirmAction action="?/publish" fields={{ to: 'archived' }} label="Archive" icon={Archive} variant="outline" title="Archive {name}?" description="It leaves the shop for good; its sales stay on record." />
				{/if}
			{:else}
				<ConfirmAction action="?/delete" label="Delete" icon={Trash2} variant="destructive" title="Delete {name}?" description="Only a bundle never sold can be deleted. A sold one is archived instead." />
			{/if}
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard amharicMoney={false} stat={{ key: 'list', label: 'The bags alone', value: t.listMax, format: 'money', group: 'bundle' }} />
	<StatCard amharicMoney={false} stat={{ key: 'price', label: hasChoice && t.priceMin !== t.priceMax ? 'Bundle price (dearest choice)' : 'Bundle price', value: t.priceMax, format: 'money', group: 'bundle', tone: 'positive' }} />
	<StatCard amharicMoney={false} stat={{ key: 'saving', label: 'Customer saves', value: t.savingMax, format: 'money', group: 'bundle', tone: t.savingMax ? 'positive' : 'warning' }} />
	<StatCard stat={{ key: 'sold', label: 'Times sold', value: data.sums.sold, format: 'count', group: 'bundle' }} />
</div>

{#if !t.bags}
	<div class="mt-4"><Notice tone="warning">Nothing in this bundle yet: add the bags it holds below.</Notice></div>
{:else if t.problems.length}
	<div class="mt-4">
		<Notice tone="warning">
			{t.problems.length === 1 ? 'One bag needs attention' : `${t.problems.length} bags need attention`}, and it cannot be published until they are fixed: {t.problems.join('; ')}.
		</Notice>
	</div>
{:else if t.listMax && !t.savingMax}
	<div class="mt-4"><Notice tone="warning">At today's prices this bundle saves the customer nothing.</Notice></div>
{/if}

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Picture">
			{#snippet actions()}
				{#if data.canManage}
					<FormDialog title="Bundle picture" action="?/image" data={data.imageForm} schema={bundleImageSchema} multipart triggerLabel="Change">
						{#snippet fields({ form, errors })}
							<InputComp label="Picture" name="image" type="file" accept="image/*" image={b.image ?? ''} removable={false} {form} {errors} />
						{/snippet}
					</FormDialog>
				{/if}
			{/snippet}
			{#if b.image}
				<LookupFileCell name={b.image} image alt={name} />
			{:else}<Empty message="No picture yet" />{/if}
		</PageSection>

		<PageSection title="The deal">
			<SingleTable
				singleTable={[
					{ name: 'Deal', value: describeRule(rule) },
					{ name: 'Bags alone', value: moneyRange(t.listMin, t.listMax) },
					{ name: 'Bundle price', value: moneyRange(t.priceMin, t.priceMax) },
					{ name: 'Customer saves', value: moneyRange(t.savingMin, t.savingMax) },
					{ name: 'Coffee', value: weightOf(t.grams) },
					{ name: 'Offer starts', value: b.startsAt ? formatDateTime(b.startsAt) : 'Now' },
					{ name: 'Offer ends', value: b.endsAt ? formatDateTime(b.endsAt) : 'No end' },
					{ name: 'Stacks with discounts', value: b.stacksWithDiscounts ? 'Yes: codes and the member discount apply too' : 'No: codes and the member discount skip it' },
					{ name: 'Most per order', value: b.maxPerOrder ?? 'No limit' },
					{ name: 'Members only', value: yesNo(b.isMemberOnly) },
					{ name: 'Discount given so far', value: money(data.sums.given) },
					{ name: 'Sales', value: money(data.sums.sales) }
				]}
			/>
		</PageSection>

		<PageSection title="Details">
			<SingleTable
				singleTable={[
					{ name: 'Address', value: b.slug },
					{ name: 'Summary', value: tr(b.summary) || '—', long: 40 },
					{ name: 'Order in the shop', value: b.sortOrder },
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>
	</div>

	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection
			title="What is in it"
			hint="Each row is an exact size (Washed Limu — 1 kg), or a bag size the customer fills with any published coffee, from one category if you choose one. Prices are today's."
		>
			<LookupSection
				config={{
					entity: 'Bag',
					plural: 'Bags',
					fields: [
						{ name: 'variantId', label: 'Exact size', type: 'reference', display: 'variant', required: false, placeholder: 'A set product and size' },
						{ name: 'bagSizeId', label: 'Or: customer picks a', type: 'reference', display: 'bagSize', picker: 'select', required: false },
						{ name: 'categoryId', label: 'From category', type: 'reference', display: 'category', picker: 'select', required: false },
						{ name: 'quantity', label: 'Bags', type: 'number' },
						{ name: 'sortOrder', label: 'Order', type: 'number', inTable: false },
						{ name: 'status', label: 'Status', type: 'boolean' }
					],
					extraColumns: [
						{
							id: 'each',
							header: 'Each (ETB)',
							cell: ({ row }) => (row.original.min === null ? '—' : amountRange(Number(row.original.min), Number(row.original.max)))
						},
						{
							id: 'choices',
							header: 'Coffees to choose',
							cell: ({ row }) => (row.original.choices === null ? '—' : String(row.original.choices))
						},
						{ id: 'problem', header: '', cell: ({ row }) => (row.original.problem ? String(row.original.problem) : '') }
					]
				}}
				rows={data.items.rows}
				addForm={data.items.addForm}
				editForm={data.items.editForm}
				canDelete={data.canManage}
				readonly={!data.canManage}
				options={{ variantId: data.options.variants, bagSizeId: data.options.bagSizes, categoryId: data.options.categories }}
				actions={childActionPaths('Item')}
				schemas={{ add: bundleItemSchema, edit: bundleItemEditSchema }}
			/>
		</PageSection>

		<PageSection title="Recent sales" hint="One row per bundle sold; two bundles in one order are two rows.">
			{#if data.sales.length}
				<DataTable variant="compact" columns={saleColumns} data={data.sales} />
			{:else}<Empty message="Not sold yet" />{/if}
		</PageSection>
	</div>
</div>
