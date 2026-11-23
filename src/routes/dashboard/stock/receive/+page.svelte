<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PackagePlus from '@lucide/svelte/icons/package-plus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { amount, date, kg, link, longText, user } from '#lib/cells.ts';
	import { receiveSchema } from '#lib/schemas/stock.ts';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, receiveSchema, {
		taintedMessage: confirmLeave,
		resetForm: true
	});

	type Row = (typeof data.recent)[number];
	const columns: ColumnDef<Row>[] = [
		{ id: 'date', header: 'Received', cell: ({ row }) => date(row.original.occurredAt) },
		{
			id: 'lot',
			header: 'Lot',
			cell: ({ row }) => link('lot', row.original.lotId, row.original.lot)
		},
		{
			id: 'location',
			header: 'At',
			cell: ({ row }) => link('location', row.original.locationId, row.original.location)
		},
		{ id: 'kg', header: 'kg', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.kg) },
		{
			id: 'cost',
			header: 'Cost / kg (ETB)',
			meta: { align: 'right' },
			cell: ({ row }) => amount(row.original.costPerKg)
		},
		{ id: 'note', header: 'Note', cell: ({ row }) => longText(row.original.note) },
		{ id: 'by', header: 'By', cell: ({ row }) => user(row.original.byId, row.original.by) }
	];
</script>

<PageHeader
	title="Receive green coffee"
	description="A delivery of green coffee into a lot. A new lot is entered first under Origins › Lots; its cost moves the lot's average cost per kg."
/>

<div class="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
	<PageSection title="Receipt">
		<form method="POST" use:enhance class="grid grid-cols-1 gap-4">
			<Errors allErrors={$allErrors} />
			<InputComp label="Lot" name="lotId" type="combo" items={data.lots} {form} {errors} required />
			<InputComp
				label="Received at"
				name="locationId"
				type="combo"
				items={data.locations}
				{form}
				{errors}
				required
			/>
			<InputComp label="Kilograms" name="kg" type="number" step="0.001" {form} {errors} required />
			<InputComp
				label="Cost per kg (ETB)"
				name="costPerKg"
				type="number"
				step="0.01"
				{form}
				{errors}
				required
			/>
			<InputComp label="Date" name="date" type="date" {form} {errors} required />
			<InputComp
				label="Note"
				name="note"
				placeholder="Truck, delivery note number…"
				{form}
				{errors}
			/>
			<Button type="submit" class="justify-self-start" disabled={$delayed}>
				{#if $delayed}<LoadingBtn name="Saving" />{:else}<PackagePlus class="size-4" /> Receive{/if}
			</Button>
		</form>
	</PageSection>
	<PageSection title="Recent receipts">
		{#if data.recent.length}
			<DataTable variant="compact" {columns} data={data.recent} />
		{:else}<Empty message="Nothing received yet" />{/if}
	</PageSection>
</div>
