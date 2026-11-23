<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';
	import { STATION_TYPES } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';

	type Option = { value: number; name: string };
	/** A station's fields, shared by the add and edit dialogs. Posts as JSON (the checklist). */
	let {
		form,
		errors,
		options
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
		options: { regions: Option[]; certifications: Option[] };
	} = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<div class="col-span-full">
		<LanguageTabs {form} {errors} fields={['name', 'story']}>
			{#snippet children({ lang, suffix, language })}
				<InputComp label="Name ({language})" name="name{suffix}" {form} {errors} required={lang === 'en'} />
				<InputComp label="Story ({language})" name="story{suffix}" type="textarea" rows={3} {form} {errors} />
			{/snippet}
		</LanguageTabs>
	</div>
	<InputComp label="Code" name="code" description="The station part of lot codes: LIM, MAN, GER." {form} {errors} required />
	<InputComp label="Type" name="type" type="select" items={choicesOf(STATION_TYPES)} {form} {errors} required />
	<InputComp label="Region" name="regionId" type="combo" items={options.regions} {form} {errors} required />
	<InputComp label="Farmers" name="farmerCount" type="number" {form} {errors} />
	<InputComp label="Lowest altitude (m)" name="altitudeMinM" type="number" {form} {errors} />
	<InputComp label="Highest altitude (m)" name="altitudeMaxM" type="number" {form} {errors} />
	<InputComp label="Latitude" name="latitude" type="number" step="0.000001" {form} {errors} />
	<InputComp label="Longitude" name="longitude" type="number" step="0.000001" {form} {errors} />
</div>
<InputComp label="Certifications" name="certificationIds" type="checkbox" items={options.certifications} selectAll={false} {form} {errors} />
