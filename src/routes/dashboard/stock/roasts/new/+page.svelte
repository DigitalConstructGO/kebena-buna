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
	import { pct, qty } from '#lib/format.ts';
	import { roastSchema } from '#lib/schemas/stock.ts';
	import PickLines from '../../PickLines.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, roastSchema, {
		taintedMessage: confirmLeave,
		dataType: 'json'
	});

	const available = $derived(data.green[Number($form.locationId)] ?? {});
	const lotsHere = $derived(data.options.lots.filter((l) => available[l.value] > 0));
	const greenIn = $derived($form.inputs.reduce((sum, i) => sum + Number(i.greenKg ?? 0), 0));
	const loss = $derived(
		greenIn > 0 ? ((greenIn - Number($form.roastedKgOut ?? 0)) / greenIn) * 100 : null
	);
</script>

<PageHeader
	title="Record a roast"
	description="The green lots go out of stock at the roasting location and the roasted coffee comes in. The batch number is given from the date."
/>

<form method="POST" use:enhance class="mt-4 grid max-w-4xl grid-cols-1 gap-6">
	<Errors allErrors={$allErrors} />
	<PageSection title="Roast">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<InputComp label="Date" name="date" type="date" {form} {errors} required />
			<InputComp label="Time" name="time" type="time" {form} {errors} required />
			<InputComp
				label="Location"
				name="locationId"
				type="combo"
				items={data.options.locations}
				{form}
				{errors}
				required
			/>
			<InputComp
				label="Machine"
				name="machineId"
				type="combo"
				items={data.options.machines}
				{form}
				{errors}
			/>
			<InputComp
				label="Roaster"
				name="roasterId"
				type="combo"
				items={data.options.staff}
				{form}
				{errors}
			/>
			<InputComp
				label="Roasted for"
				name="productId"
				type="combo"
				items={data.options.products}
				{form}
				{errors}
			/>
			<InputComp
				label="Roast level"
				name="roastLevelId"
				type="select"
				items={data.options.roastLevels}
				{form}
				{errors}
				required
			/>
			<InputComp
				label="Duration (min)"
				name="durationMin"
				type="number"
				step="0.01"
				{form}
				{errors}
			/>
			<InputComp
				label="Drop temperature (°C)"
				name="dropTempC"
				type="number"
				step="0.1"
				{form}
				{errors}
			/>
			<InputComp
				label="Cupping score"
				name="cuppingScore"
				type="number"
				step="0.25"
				{form}
				{errors}
			/>
			<InputComp
				label="Roast-day batch"
				name="isToOrder"
				type="checkboxSingle"
				placeholder="For roast-to-order and subscription lines"
				{form}
				{errors}
			/>
		</div>
		<InputComp label="Notes" name="notes" type="textarea" rows={2} {form} {errors} />
	</PageSection>

	<PageSection title="Green lots used" hint="Blends and splits: one line per lot.">
		<PickLines
			bind:lines={$form.inputs}
			items={lotsHere}
			{available}
			idKey="lotId"
			qtyKey="greenKg"
			itemLabel="Lot"
			qtyLabel="Green kg"
			unit="kg"
			addLabel="Add a lot"
			errors={$errors.inputs}
		/>
	</PageSection>

	<PageSection title="What came out">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<InputComp
				label="Roasted kg out"
				name="roastedKgOut"
				type="number"
				step="0.001"
				{form}
				{errors}
				required
			/>
		</div>
		{#if loss !== null && Number($form.roastedKgOut) > 0}
			<Notice
				tone={loss < data.lossRange.min || loss > data.lossRange.max ? 'warning' : 'info'}
				class="mt-4"
			>
				{qty(greenIn, 'kg')} green in → weight loss {pct(Math.round(loss * 100) / 100)}.
			</Notice>
		{/if}
	</PageSection>

	<Button type="submit" size="lg" class="sm:justify-self-start" disabled={$delayed}>
		{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save roast{/if}
	</Button>
</form>
