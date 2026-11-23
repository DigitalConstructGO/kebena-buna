<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';
	import { BOOKABLE_KINDS, BOOKING_PRICING, PUBLISH_STATUSES } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';

	type Option = { value: number; name: string };
	/** What can be booked: shared by the new and edit dialogs (posted as JSON, for the language list). */
	let {
		form,
		errors,
		options
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
		options: { locations: Option[]; taxRates: Option[] };
	} = $props();

	const LANGUAGES = [
		{ value: 'am', name: 'Amharic' },
		{ value: 'en', name: 'English' },
		{ value: 'om', name: 'Afaan Oromo' }
	];
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<div class="col-span-full">
		<LanguageTabs {form} {errors} fields={['name', 'description']}>
			{#snippet children({ lang, suffix, language })}
				<InputComp
					label="Name ({language})"
					name="name{suffix}"
					{form}
					{errors}
					required={lang === 'en'}
				/>
				<InputComp
					label="Description ({language})"
					name="description{suffix}"
					type="textarea"
					rows={3}
					{form}
					{errors}
				/>
			{/snippet}
		</LanguageTabs>
	</div>
	<InputComp label="Slug" name="slug" placeholder="coffee-ceremony" {form} {errors} required />
	<InputComp
		label="Kind"
		name="kind"
		type="select"
		items={choicesOf(BOOKABLE_KINDS)}
		{form}
		{errors}
		required
	/>
	<InputComp
		label="Where"
		name="locationId"
		type="select"
		items={options.locations}
		{form}
		{errors}
	/>
	<InputComp label="Minutes" name="durationMin" type="number" {form} {errors} required />
	<InputComp label="Smallest party" name="minParty" type="number" {form} {errors} />
	<InputComp label="Largest party" name="maxParty" type="number" {form} {errors} />
	<InputComp
		label="Priced"
		name="pricing"
		type="select"
		items={choicesOf(BOOKING_PRICING)}
		{form}
		{errors}
		required
	/>
	<InputComp label="Tax" name="taxRateId" type="select" items={options.taxRates} {form} {errors} />
	<InputComp
		label="Hold unpaid places for (days)"
		name="holdDays"
		type="number"
		description="Leave empty to use the shop default from Admin › Settings."
		{form}
		{errors}
	/>
	<InputComp
		label="Website"
		name="publishStatus"
		type="select"
		items={choicesOf(PUBLISH_STATUSES)}
		{form}
		{errors}
	/>
	<InputComp label="Order" name="sortOrder" type="number" {form} {errors} />
</div>
<InputComp
	label="Run in"
	name="languages"
	type="checkbox"
	items={LANGUAGES}
	selectAll={false}
	{form}
	{errors}
/>
<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
	<InputComp
		label="Paid at booking"
		name="requiresPrepayment"
		type="checkboxSingle"
		placeholder="Otherwise invoiced or quoted"
		{form}
		{errors}
	/>
	<InputComp
		label="Uses visit capacity"
		name="usesVisitCapacity"
		type="checkboxSingle"
		placeholder="Takes places in the timed-entry slot"
		{form}
		{errors}
	/>
	<InputComp
		label="Needs staff"
		name="requiresStaff"
		type="checkboxSingle"
		placeholder="A guide or host runs it"
		{form}
		{errors}
	/>
	<InputComp
		label="By enquiry only"
		name="isEnquiryOnly"
		type="checkboxSingle"
		placeholder="No sessions: staff confirm a date"
		{form}
		{errors}
	/>
	<InputComp
		label="Active"
		name="isActive"
		type="checkboxSingle"
		placeholder="Offered for booking"
		{form}
		{errors}
	/>
</div>
