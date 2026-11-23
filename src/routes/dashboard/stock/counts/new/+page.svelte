<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Save from '@lucide/svelte/icons/save';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import LineCell from '@nahu/admin-kit/components/lines/LineCell.svelte';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { humanize, qty } from '#lib/format.ts';
	import { STOCK_STAGES } from '#lib/constants.ts';
	import { countSchema } from '#lib/schemas/stock.ts';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, countSchema, {
		taintedMessage: confirmLeave,
		dataType: 'json'
	});

	const unit = $derived(data.stage === 'packed' ? 'bags' : 'kg');
	type Row = (typeof $form.lines)[number] & { index: number };
	const rows = $derived($form.lines.map((line, index) => ({ ...line, index })));
	const counted = $derived(
		$form.lines.filter(
			(l) => l.counted !== null && l.counted !== undefined && String(l.counted) !== ''
		)
	);
	const differ = $derived(
		counted.filter((l) => Number(l.counted) !== Number(l.expected ?? 0)).length
	);
	const setCount = (index: number, value: unknown) =>
		($form.lines = $form.lines.map((l, i) =>
			i === index ? { ...l, counted: value as number | null } : l
		));

	const columns: ColumnDef<Row>[] = $derived([
		{
			id: 'item',
			header: humanize(
				data.stage === 'green'
					? 'lot'
					: data.stage === 'roasted'
						? 'roast batch'
						: 'bag · packing run'
			),
			cell: ({ row }) => row.original.label
		},
		{
			id: 'expected',
			header: 'On the books',
			meta: { align: 'right' },
			cell: ({ row }) => qty(Number(row.original.expected ?? 0), unit)
		},
		{
			id: 'counted',
			header: `Counted (${unit})`,
			meta: { align: 'right' },
			cell: ({ row }) =>
				renderComponent(LineCell, {
					kind: 'text',
					name: `counted-${row.original.index}`,
					label: `Counted ${row.original.label}`,
					placeholder: 'Not counted',
					value: row.original.counted === null ? '' : String(row.original.counted),
					onchange: (v: unknown) => setCount(row.original.index, v === null ? null : Number(v))
				})
		},
		{
			id: 'diff',
			header: 'Difference',
			meta: { align: 'right' },
			cell: ({ row }) =>
				row.original.counted === null
					? '—'
					: qty(Number(row.original.counted) - Number(row.original.expected ?? 0), unit)
		}
	]);
</script>

<PageHeader
	title="Count stock"
	description="Count what is on the shelf. Lines left empty are not counted; a counted line that differs from the books posts a correction."
/>

<div class="mt-4 grid grid-cols-1 gap-3">
	<div class="flex flex-wrap items-center gap-2">
		<span class="w-20 text-sm text-muted-foreground">Location</span>
		{#each data.locations as l (l.value)}
			<Button
				size="sm"
				variant={l.value === data.locationId ? 'default' : 'outline'}
				href="?location={l.value}&stage={data.stage}"
			>
				{l.name}
			</Button>
		{/each}
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<span class="w-20 text-sm text-muted-foreground">Stage</span>
		{#each STOCK_STAGES as s (s)}
			<Button
				size="sm"
				variant={s === data.stage ? 'default' : 'outline'}
				href="?location={data.locationId}&stage={s}"
			>
				{humanize(s)}
			</Button>
		{/each}
	</div>
</div>

<form method="POST" use:enhance class="mt-6 grid max-w-4xl grid-cols-1 gap-6">
	<Errors allErrors={$allErrors} />
	<PageSection title="Count">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<InputComp label="Date" name="date" type="date" {form} {errors} required />
			<InputComp label="Time" name="time" type="time" {form} {errors} required />
			<InputComp
				label="Opening count"
				name="isOpening"
				type="checkboxSingle"
				placeholder="The first count of this place"
				{form}
				{errors}
			/>
		</div>
		<InputComp label="Note" name="note" {form} {errors} />
	</PageSection>
	<PageSection title="Count sheet" hint="{counted.length} counted · {differ} differ from the books">
		{#if rows.length}
			<DataTable variant="sheet" {columns} data={rows} />
		{:else}<Empty message="Nothing of this stage to count" />{/if}
	</PageSection>
	<Button
		type="submit"
		size="lg"
		class="sm:justify-self-start"
		disabled={$delayed || !counted.length}
	>
		{#if $delayed}<LoadingBtn name="Posting" />{:else}<Save class="size-4" /> Post count{/if}
	</Button>
</form>
