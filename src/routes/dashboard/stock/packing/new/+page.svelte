<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { qty } from '#lib/format.ts';
	import { packingSchema } from '#lib/schemas/stock.ts';
	import PickLines from '../../PickLines.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, packingSchema, {
		taintedMessage: confirmLeave,
		dataType: 'json'
	});

	const available = $derived(data.free[Number($form.sourceLocationId)] ?? {});
	// Bags carry one roast, so only batches of the chosen roast are offered.
	const batchesHere = $derived(
		data.options.batches.filter(
			(b) =>
				available[b.value] > 0 &&
				(!$form.roastLevelId || b.roastLevelId === Number($form.roastLevelId))
		)
	);
	const grams = $derived(
		data.options.variants.find((v) => v.value === Number($form.variantId))?.grams ?? 0
	);
	const needed = $derived((Number($form.units ?? 0) * grams) / 1000);
	const given = $derived($form.sources.reduce((sum, s) => sum + Number(s.roastedKg ?? 0), 0));
	/** The most packing may draw: the server allows 2% over for spill. */
	const most = $derived(needed * 1.02);
</script>

<PageHeader
	title="Record packing"
	description="Roasted coffee comes out of the batches it is drawn from and the bags go on the shelf. The run number is given from the date."
/>

<form method="POST" use:enhance class="mt-4 grid max-w-4xl grid-cols-1 gap-6">
	<Errors allErrors={$allErrors} />
	<PageSection title="Bags">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<InputComp label="Date" name="date" type="date" {form} {errors} required />
			<InputComp label="Time" name="time" type="time" {form} {errors} required />
			<InputComp
				label="Product and size"
				name="variantId"
				type="combo"
				items={data.options.variants}
				{form}
				{errors}
				required
			/>
			<InputComp
				label="Roast"
				name="roastLevelId"
				type="select"
				items={data.options.roastLevels}
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
			<InputComp label="Bags" name="units" type="number" step="1" {form} {errors} required />
			<InputComp label="Best before" name="bestBefore" type="date" futureDays {form} {errors} />
			<InputComp
				label="Bags go to"
				name="locationId"
				type="combo"
				items={data.options.locations}
				{form}
				{errors}
				required
			/>
			<InputComp
				label="Packed for one order"
				name="isToOrder"
				type="checkboxSingle"
				placeholder="Roast to order, not for the shelf"
				{form}
				{errors}
			/>
		</div>
	</PageSection>

	<PageSection
		title="Roasted coffee used"
		hint="One line per roast batch the bags were filled from."
	>
		<div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
			<InputComp
				label="Taken from"
				name="sourceLocationId"
				type="combo"
				items={data.options.locations}
				{form}
				{errors}
				required
			/>
		</div>
		<PickLines
			bind:lines={$form.sources}
			items={batchesHere}
			{available}
			idKey="roastBatchId"
			qtyKey="roastedKg"
			itemLabel="Roast batch"
			qtyLabel="Roasted kg"
			unit="kg"
			addLabel="Add a batch"
			errors={$errors.sources}
		/>
		{#if needed > 0}
			<Notice
				tone={given + 0.0005 < needed || given > most + 0.0005 ? 'warning' : 'success'}
				class="mt-4"
			>
				{$form.units} × {grams} g needs {qty(needed, 'kg')}; the batches give {qty(given, 'kg')}.
				{#if given > most + 0.0005}At most {qty(most, 'kg')} may be drawn.{/if}
			</Notice>
		{/if}
	</PageSection>

	<Button type="submit" size="lg" class="sm:justify-self-start" disabled={$delayed}>
		{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save packing run{/if}
	</Button>
</form>
