<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';
	import { PUBLISH_STATUSES } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';

	/** A bundle's own fields and its deal, shared by the add and edit dialogs. */
	let {
		form,
		errors
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
	} = $props();

	const PRICINGS = [
		{ value: 'percent_off', name: 'Percent off the bags' },
		{ value: 'amount_off', name: 'Birr off the bags' },
		{ value: 'fixed_price', name: 'One price for the lot' }
	];
	const VALUE_LABEL: Record<string, string> = {
		percent_off: 'Percent off',
		amount_off: 'Birr off (ETB)',
		fixed_price: 'Bundle price (ETB)'
	};
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<div class="col-span-full">
		<LanguageTabs {form} {errors} fields={['name', 'summary']}>
			{#snippet children({ lang, suffix, language })}
				<InputComp
					label="Name ({language})"
					name="name{suffix}"
					placeholder={lang === 'en' ? '2 kg bundle' : ''}
					{form}
					{errors}
					required={lang === 'en'}
				/>
				<InputComp
					label="Summary ({language})"
					name="summary{suffix}"
					type="textarea"
					rows={2}
					placeholder={lang === 'en' ? 'Any two 1 kg bags, 5% off' : ''}
					{form}
					{errors}
				/>
			{/snippet}
		</LanguageTabs>
	</div>
	<InputComp
		label="Address (slug)"
		name="slug"
		placeholder="two-kilo-bundle"
		description="Its web address: lowercase words and hyphens."
		{form}
		{errors}
		required
	/>
	<InputComp
		label="Website"
		name="publishStatus"
		type="select"
		items={choicesOf(PUBLISH_STATUSES)}
		{form}
		{errors}
		required
	/>
	<InputComp label="Deal" name="pricing" type="select" items={PRICINGS} {form} {errors} required />
	<InputComp
		label={VALUE_LABEL[String($form.pricing)] ?? 'Value'}
		name="value"
		type="number"
		step="0.01"
		description="Worked out against today's prices of the bags in it, and never more than they cost alone."
		{form}
		{errors}
		required
	/>
	<InputComp
		label="Offer starts"
		name="startsOn"
		type="date"
		futureDays
		description="Empty: from now."
		{form}
		{errors}
	/>
	<InputComp
		label="Offer ends"
		name="endsOn"
		type="date"
		futureDays
		description="Empty: no end."
		{form}
		{errors}
	/>
	<InputComp
		label="Most per order"
		name="maxPerOrder"
		type="number"
		description="Empty: no limit."
		{form}
		{errors}
	/>
	<InputComp label="Order in the shop" name="sortOrder" type="number" {form} {errors} />
</div>
<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
	<InputComp
		label="Stacks with discounts"
		name="stacksWithDiscounts"
		type="checkboxSingle"
		placeholder="Codes and the member discount also apply to it"
		{form}
		{errors}
	/>
	<InputComp
		label="Members only"
		name="isMemberOnly"
		type="checkboxSingle"
		placeholder="Offered only to signed-in members"
		{form}
		{errors}
	/>
</div>
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2"></div>
