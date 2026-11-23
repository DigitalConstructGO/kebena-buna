<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';

	type Option = { value: number; name: string };
	/** A ticket type's fields: the add dialog, the edit dialog, and an event's own types. */
	let {
		form,
		errors,
		taxRates,
		events = undefined
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
		taxRates: Option[];
		/** Offered only where a type may be moved between entry and an event. */
		events?: Option[];
	} = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<div class="col-span-full">
		<LanguageTabs {form} {errors} fields={['name', 'requiresProof', 'description']}>
			{#snippet children({ lang, suffix, language })}
				<InputComp
					label="Name ({language})"
					name="name{suffix}"
					{form}
					{errors}
					required={lang === 'en'}
				/>
				<InputComp
					label="Proof asked at the door ({language})"
					name="requiresProof{suffix}"
					placeholder={lang === 'en' ? 'Student ID' : ''}
					{form}
					{errors}
				/>
				<InputComp
					label="Description ({language})"
					name="description{suffix}"
					type="textarea"
					rows={2}
					{form}
					{errors}
				/>
			{/snippet}
		</LanguageTabs>
	</div>
	<InputComp label="Code" name="code" placeholder="ADULT" {form} {errors} required />
	<InputComp label="VAT" name="taxRateId" type="select" items={taxRates} {form} {errors} />
	{#if events}
		<InputComp
			label="Event"
			name="eventId"
			type="combo"
			items={events}
			description="Empty for museum entry."
			{form}
			{errors}
		/>
	{/if}
	<InputComp
		label="People admitted per ticket"
		name="admitsPerTicket"
		type="number"
		min={1}
		{form}
		{errors}
	/>
	<InputComp label="Minimum per order" name="minQuantity" type="number" min={1} {form} {errors} />
	<InputComp label="Maximum per order" name="maxQuantity" type="number" {form} {errors} />
	<InputComp label="Order" name="sortOrder" type="number" {form} {errors} />
</div>
<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
	<InputComp
		label="Capacity"
		name="countsTowardCapacity"
		type="checkboxSingle"
		placeholder="Counts toward slot capacity"
		{form}
		{errors}
	/>
	<InputComp
		label="Staff only"
		name="isStaffOnly"
		type="checkboxSingle"
		placeholder="Sold only at the desk"
		{form}
		{errors}
	/>
	<InputComp
		label="Members"
		name="isMemberOnly"
		type="checkboxSingle"
		placeholder="Members only"
		{form}
		{errors}
	/>
	<InputComp
		label="Active"
		name="isActive"
		type="checkboxSingle"
		placeholder="On sale"
		{form}
		{errors}
	/>
</div>
