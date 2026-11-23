<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';

	/** A delivery address's fields, for the add and edit dialogs. */
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
	<InputComp label="Label" name="label" placeholder="Home, office…" {form} {errors} />
	<InputComp label="Area" name="areaId" type="combo" items={areas} {form} {errors} />
	<InputComp label="Recipient" name="recipientName" {form} {errors} />
	<InputComp label="Phone" name="phone" type="tel" {form} {errors} />
	<InputComp label="City" name="city" {form} {errors} required />
	<InputComp label="Woreda" name="woreda" {form} {errors} />
</div>
<InputComp label="House, building, street" name="line1" {form} {errors} required />
<InputComp label="Landmark" name="landmark" placeholder="Blue gate, behind Edna Mall…" {form} {errors} />
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp label="Latitude" name="latitude" type="number" step="0.000001" {form} {errors} />
	<InputComp label="Longitude" name="longitude" type="number" step="0.000001" {form} {errors} />
</div>
<InputComp label="Default" name="isDefault" type="checkboxSingle" placeholder="Offered first at checkout" {form} {errors} />
