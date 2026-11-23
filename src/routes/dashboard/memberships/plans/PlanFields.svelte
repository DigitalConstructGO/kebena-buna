<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';
	import { PUBLISH_STATUSES } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';

	type Option = { value: number; name: string };
	/** A membership plan's fields, shared by the new-plan dialog and the edit page. */
	let {
		form,
		errors,
		options,
		image = ''
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
		options: { taxRates: Option[]; variants: Option[] };
		image?: string;
	} = $props();
</script>

<LanguageTabs {form} {errors} fields={['name', 'requiresProof', 'description', 'benefits']}>
	{#snippet children({ lang, suffix, language })}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<InputComp
				label="Name ({language})"
				name="name{suffix}"
				{form}
				{errors}
				required={lang === 'en'}
			/>
			<InputComp
				label="Proof needed ({language})"
				name="requiresProof{suffix}"
				placeholder={lang === 'en' ? 'Student ID' : ''}
				{form}
				{errors}
			/>
		</div>
		<InputComp
			label="Description ({language})"
			name="description{suffix}"
			type="textarea"
			rows={2}
			{form}
			{errors}
		/>
		<InputComp
			label="Benefits applied by hand ({language})"
			name="benefits{suffix}"
			type="textarea"
			rows={2}
			{form}
			{errors}
		/>
	{/snippet}
</LanguageTabs>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp label="Code" name="code" {form} {errors} required />
	<InputComp
		label="Publish"
		name="publishStatus"
		type="select"
		items={choicesOf(PUBLISH_STATUSES)}
		{form}
		{errors}
	/>
	<InputComp label="Price (ETB)" name="price" type="number" step="0.01" {form} {errors} required />
	<InputComp label="Tax" name="taxRateId" type="select" items={options.taxRates} {form} {errors} />
	<InputComp label="Months" name="durationMonths" type="number" {form} {errors} />
	<InputComp label="Grace days" name="graceDays" type="number" {form} {errors} />
	<InputComp label="Adults" name="maxAdults" type="number" {form} {errors} />
	<InputComp label="Children" name="maxChildren" type="number" {form} {errors} />
	<InputComp
		label="One shared card admits"
		name="sharedCardAdmits"
		type="number"
		description="Empty: a card per member."
		{form}
		{errors}
	/>
	<InputComp
		label="Shop discount (%)"
		name="shopDiscountPct"
		type="number"
		step="0.01"
		{form}
		{errors}
	/>
	<InputComp
		label="Monthly coffee"
		name="monthlyCoffeeVariantId"
		type="combo"
		items={options.variants}
		description="The Patron's bag, sent each month through a subscription."
		{form}
		{errors}
	/>
	<InputComp label="Order" name="sortOrder" type="number" {form} {errors} />
</div>
<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
	<InputComp
		label="Free entry"
		name="freeEntry"
		type="checkboxSingle"
		placeholder="Members enter free"
		{form}
		{errors}
	/>
	<InputComp
		label="Free delivery"
		name="freeDelivery"
		type="checkboxSingle"
		placeholder="On shop orders"
		{form}
		{errors}
	/>
	<InputComp
		label="Members-only events"
		name="membersOnlyEvents"
		type="checkboxSingle"
		placeholder="May book them"
		{form}
		{errors}
	/>
	<InputComp
		label="Active"
		name="isActive"
		type="checkboxSingle"
		placeholder="Offered for sale"
		{form}
		{errors}
	/>
</div>
<InputComp label="Image" name="image" type="file" accept="image/*" {image} {form} {errors} />
