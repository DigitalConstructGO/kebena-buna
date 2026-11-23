<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { fileUrl } from '@nahu/admin-kit/files';
	import { BUSINESS_TYPES } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';

	/** A business account's application fields, for the new page and the edit dialog. */
	let {
		form,
		errors,
		storedLicence = null
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
		/** The trade licence already on file, shown while editing. */
		storedLicence?: string | null;
	} = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp label="Business name" name="name" {form} {errors} required />
	<InputComp
		label="Type"
		name="type"
		type="select"
		items={choicesOf(BUSINESS_TYPES)}
		{form}
		{errors}
		required
	/>
	<InputComp label="Trade licence number" name="tradeLicenceNumber" {form} {errors} required />
	<InputComp label="TIN" name="tin" {form} {errors} required />
	<InputComp label="VAT number" name="vatNumber" {form} {errors} />
	<InputComp
		label="Expected kg / month"
		name="expectedMonthlyKg"
		type="number"
		step="0.001"
		{form}
		{errors}
	/>
	<InputComp label="Contact person" name="contactName" {form} {errors} required />
	<InputComp label="Contact phone" name="contactPhone" type="tel" {form} {errors} required />
	<InputComp label="Contact email" name="contactEmail" type="email" {form} {errors} />
</div>
<InputComp
	label="Trade licence (scan or PDF)"
	name="tradeLicenceFile"
	type="file"
	accept="image/*,application/pdf"
	image={storedLicence ? fileUrl(storedLicence) : ''}
	{form}
	{errors}
/>
<InputComp label="Notes" name="notes" type="textarea" rows={3} {form} {errors} />
