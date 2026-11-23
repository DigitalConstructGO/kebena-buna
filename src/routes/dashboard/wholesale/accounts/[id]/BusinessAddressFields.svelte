<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';

	/** A business's delivery or billing address, for the add and edit dialogs. */
	let {
		form,
		errors,
		areas
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
		areas: { value: number; name: string }[];
	} = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp label="Label" name="label" placeholder="Bole branch, head office…" {form} {errors} />
	<InputComp label="Area" name="areaId" type="combo" items={areas} {form} {errors} />
	<InputComp label="City" name="city" {form} {errors} required />
	<InputComp label="Landmark" name="landmark" {form} {errors} />
</div>
<InputComp label="House, building, street" name="line1" {form} {errors} required />
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp label="Latitude" name="latitude" type="number" step="0.000001" {form} {errors} />
	<InputComp label="Longitude" name="longitude" type="number" step="0.000001" {form} {errors} />
	<InputComp
		label="Billing address"
		name="isBilling"
		type="checkboxSingle"
		placeholder="Printed on invoices"
		{form}
		{errors}
	/>
	<InputComp
		label="Default delivery"
		name="isDefaultDelivery"
		type="checkboxSingle"
		placeholder="Offered first"
		{form}
		{errors}
	/>
</div>
