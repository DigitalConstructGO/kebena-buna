<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';
	import { PROCESSING_METHODS } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';

	type Option = { value: number; name: string };
	/**
	 * A lot's fields, shared by the new-lot page and the edit dialog. `locked` (the edit dialog)
	 * leaves out the station and crop year: they are part of the lot code, so they stay as entered.
	 */
	let {
		form,
		errors,
		options,
		lowDefault = undefined,
		locked = false
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
		options: {
			stations: Option[];
			regions: Option[];
			varieties: Option[];
			certifications: Option[];
		};
		/** The shop-wide level used when this is left empty (Admin › Settings). */
		lowDefault?: number;
		locked?: boolean;
	} = $props();

	const defaultHint = (level: number | undefined) =>
		level === undefined
			? 'Leave empty to use the shop default from Admin › Settings.'
			: `Leave empty to use the shop default: ${level} kg (Admin › Settings).`;
</script>

{#if locked}
	<p class="text-sm text-muted-foreground">
		The station and crop year are part of the lot code (KGT-LIM-2026-014), so they stay as the lot
		was entered.
	</p>
{/if}
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	{#if !locked}
		<InputComp label="Station" name="stationId" type="combo" items={options.stations} {form} {errors} required />
	{/if}
	<InputComp label="Region" name="regionId" type="combo" items={options.regions} {form} {errors} required />
	<InputComp label="Process" name="process" type="select" items={choicesOf(PROCESSING_METHODS)} {form} {errors} required />
	{#if !locked}
		<InputComp label="Crop year" name="cropYear" type="number" {form} {errors} required />
	{/if}
	<InputComp label="Grade" name="grade" type="number" {form} {errors} />
	<InputComp label="Cupping score" name="cuppingScore" type="number" step="0.25" {form} {errors} />
	<InputComp label="Altitude (m)" name="altitudeM" type="number" {form} {errors} />
	<InputComp label="Farmers" name="farmerCount" type="number" {form} {errors} />
	<InputComp label="ECX / ECTA / contract no." name="externalRef" {form} {errors} />
	<InputComp
		label="Low-stock level (kg)"
		name="lowStockKg"
		type="number"
		step="0.001"
		description={defaultHint(lowDefault)}
		{form}
		{errors}
	/>
	<div class="col-span-full">
		<LanguageTabs {form} {errors} fields={['tastingNotes', 'story']}>
			{#snippet children({ lang, suffix, language })}
				<InputComp label="Tasting notes ({language})" name="tastingNotes{suffix}" {form} {errors} />
				<InputComp label="Story ({language})" name="story{suffix}" type="textarea" rows={3} {form} {errors} />
			{/snippet}
		</LanguageTabs>
	</div>
</div>
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp label="Varieties" name="varietyIds" type="checkbox" items={options.varieties} selectAll={false} {form} {errors} />
	<InputComp
		label="Certifications"
		name="certificationIds"
		type="checkbox"
		items={options.certifications}
		selectAll={false}
		{form}
		{errors}
	/>
</div>
