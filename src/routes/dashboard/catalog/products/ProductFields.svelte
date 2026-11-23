<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';
	import { FULFILMENT_MODES, PRODUCT_KINDS, PUBLISH_STATUSES } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';

	type Option = { value: number; name: string };
	/** A product's own fields, shared by the new-product page and the edit page. */
	let {
		form,
		errors,
		options,
		lowDefault = undefined
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
		options: { categories: Option[]; taxRates: Option[] };
		/** The shop-wide level used when this is left empty (Admin › Settings). */
		lowDefault?: number;
	} = $props();

	const defaultHint = (level: number | undefined) =>
		level === undefined
			? 'Leave empty to use the shop default from Admin › Settings.'
			: `Leave empty to use the shop default: ${level} kg (Admin › Settings).`;
</script>

<LanguageTabs
	{form}
	{errors}
	fields={['name', 'summary', 'tastingNotes', 'originStory', 'seoTitle', 'seoDescription']}
>
	{#snippet children({ lang, suffix, language })}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<InputComp
				label="Name ({language})"
				name="name{suffix}"
				{form}
				{errors}
				required={lang === 'en'}
			/>
			<InputComp label="Tasting notes ({language})" name="tastingNotes{suffix}" {form} {errors} />
		</div>
		<InputComp
			label="Summary ({language})"
			name="summary{suffix}"
			type="textarea"
			rows={2}
			{form}
			{errors}
		/>
		<InputComp
			label="Origin story ({language})"
			name="originStory{suffix}"
			type="textarea"
			rows={3}
			{form}
			{errors}
		/>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<InputComp label="SEO title ({language})" name="seoTitle{suffix}" {form} {errors} />
			<InputComp
				label="SEO description ({language})"
				name="seoDescription{suffix}"
				type="textarea"
				rows={2}
				{form}
				{errors}
			/>
		</div>
	{/snippet}
</LanguageTabs>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp
		label="Address (slug)"
		name="slug"
		description="The product's web address: lowercase words and hyphens."
		{form}
		{errors}
		required
	/>
	<InputComp
		label="Kind"
		name="kind"
		type="select"
		items={choicesOf(PRODUCT_KINDS)}
		{form}
		{errors}
		required
	/>
	<InputComp
		label="Category"
		name="categoryId"
		type="combo"
		items={options.categories}
		{form}
		{errors}
	/>
	<InputComp
		label="Tax rate"
		name="taxRateId"
		type="select"
		items={options.taxRates}
		{form}
		{errors}
	/>
	<InputComp
		label="Fulfilment"
		name="fulfilment"
		type="select"
		items={choicesOf(FULFILMENT_MODES)}
		description="From stock, or roasted on the next roast day."
		{form}
		{errors}
		required
	/>
	<InputComp
		label="Dispatch days"
		name="dispatchDays"
		type="number"
		description="Working days from order to dispatch."
		{form}
		{errors}
		required
	/>
	<InputComp
		label="Roasted low-stock level (kg)"
		name="lowStockRoastedKg"
		type="number"
		step="0.001"
		description={defaultHint(lowDefault)}
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
		required
	/>
	<InputComp label="Order in the shop" name="sortOrder" type="number" {form} {errors} />
</div>
<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
	<InputComp
		label="Members only"
		name="isMemberOnly"
		type="checkboxSingle"
		placeholder="Shown only to signed-in members"
		{form}
		{errors}
	/>
	<InputComp
		label="Subscribable"
		name="isSubscribable"
		type="checkboxSingle"
		placeholder="Offered as a subscription"
		{form}
		{errors}
	/>
	<InputComp
		label="Wholesale"
		name="isWholesale"
		type="checkboxSingle"
		placeholder="Offered in the wholesale portal"
		{form}
		{errors}
	/>
</div>
