<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { DISCOUNT_KINDS, ORDER_ITEM_TYPES } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';

	/** A discount code's fields, shared by the add and edit dialogs. */
	let {
		form,
		errors
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
	} = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp label="Code" name="code" placeholder="WELCOME10" {form} {errors} required />
	<InputComp
		label="Kind"
		name="kind"
		type="select"
		items={choicesOf(DISCOUNT_KINDS)}
		{form}
		{errors}
		required
	/>
	<InputComp
		label="Value"
		name="value"
		type="number"
		step="0.01"
		description="Percent, or birr off"
		{form}
		{errors}
		required
	/>
	<InputComp
		label="Minimum order (ETB)"
		name="minOrderAmount"
		type="number"
		step="0.01"
		{form}
		{errors}
	/>
	<InputComp
		label="Most it takes off (ETB)"
		name="maxDiscountAmount"
		type="number"
		step="0.01"
		{form}
		{errors}
	/>
	<InputComp
		label="Uses in all"
		name="usageLimit"
		type="number"
		description="Empty: no limit"
		{form}
		{errors}
	/>
	<InputComp label="Uses per customer" name="perCustomerLimit" type="number" {form} {errors} />
	<InputComp label="Starts" name="startsOn" type="date" futureDays {form} {errors} />
	<InputComp label="Expires" name="expiresOn" type="date" futureDays {form} {errors} />
</div>
<InputComp label="Description" name="description" {form} {errors} />
<InputComp
	label="Applies to"
	name="appliesTo"
	type="checkbox"
	items={choicesOf(ORDER_ITEM_TYPES)}
	description="None ticked: everything."
	{form}
	{errors}
/>
<InputComp
	label="Active"
	name="isActive"
	type="checkboxSingle"
	placeholder="Accepted at checkout"
	{form}
	{errors}
/>
