<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { LOCATION_TYPES } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';

	/** A location's fields, shared by the add and edit dialogs. */
	let {
		form,
		errors,
		parents
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
		parents: { value: number; name: string }[];
	} = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp label="Name (English)" name="nameEn" {form} {errors} required />
	<InputComp label="Name (Amharic)" name="nameAm" {form} {errors} />
	<InputComp label="Name (Afaan Oromo)" name="nameOm" {form} {errors} />
	<InputComp label="Name (Arabic)" name="nameAr" {form} {errors} />
	<InputComp label="Name (Italian)" name="nameIt" {form} {errors} />
	<InputComp label="Name (French)" name="nameFr" {form} {errors} />
	<InputComp label="Code" name="code" {form} {errors} required />
	<InputComp label="Type" name="type" type="select" items={choicesOf(LOCATION_TYPES)} {form} {errors} required />
	<InputComp label="Inside" name="parentId" type="combo" items={parents} description="The shop inside Site A, say." {form} {errors} />
	<InputComp label="Phone" name="phone" type="tel" {form} {errors} />
	<InputComp label="Latitude" name="latitude" type="number" step="0.000001" {form} {errors} />
	<InputComp label="Longitude" name="longitude" type="number" step="0.000001" {form} {errors} />
</div>
<InputComp label="Address" name="address" {form} {errors} />
<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
	<InputComp label="Holds stock" name="holdsStock" type="checkboxSingle" placeholder="Has its own stock balances" {form} {errors} />
	<InputComp label="Sells at the desk" name="sellsAtDesk" type="checkboxSingle" placeholder="Walk-in sales" {form} {errors} />
	<InputComp label="Fulfils online orders" name="fulfilsOnline" type="checkboxSingle" placeholder="Ships from here" {form} {errors} />
	<InputComp label="Pickup point" name="isPickupPoint" type="checkboxSingle" placeholder="Customers may collect here" {form} {errors} />
	<InputComp label="Admits visitors" name="admitsVisitors" type="checkboxSingle" placeholder="Tickets are scanned here" {form} {errors} />
	<InputComp label="Controls capacity" name="controlsCapacity" type="checkboxSingle" placeholder="Visitor capacity is counted here" {form} {errors} />
</div>
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp label="Order" name="sortOrder" type="number" {form} {errors} />
	<InputComp label="Active" name="isActive" type="checkboxSingle" placeholder="In use" {form} {errors} />
</div>
