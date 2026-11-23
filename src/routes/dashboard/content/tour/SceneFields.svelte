<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';

	type Store = ComponentProps<typeof InputComp>['form'];
	/** A 360° scene's fields, shared by the add dialog and the edit dialog. */
	let {
		form,
		errors,
		locations,
		panorama = '',
		preview = ''
	}: {
		form: Store;
		errors: Store;
		locations: { value: number; name: string }[];
		/** The stored panorama and preview, shown while editing. */
		panorama?: string;
		preview?: string;
	} = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<div class="col-span-full">
		<LanguageTabs {form} {errors} fields={['title', 'description']}>
			{#snippet children({ lang, suffix, language })}
				<InputComp label="Title ({language})" name="title{suffix}" {form} {errors} required={lang === 'en'} />
				<InputComp label="Description ({language})" name="description{suffix}" type="textarea" rows={2} {form} {errors} />
			{/snippet}
		</LanguageTabs>
	</div>
	<InputComp label="Address" name="slug" description="Lowercase words joined by hyphens, at most 64 characters" {form} {errors} required />
	<InputComp label="Site" name="locationId" type="select" items={locations} {form} {errors} required />
	<InputComp label="Start facing (yaw°)" name="initialYaw" type="number" step="0.001" {form} {errors} />
	<InputComp label="Start tilt (pitch°)" name="initialPitch" type="number" step="0.001" {form} {errors} />
	<InputComp label="Order" name="sortOrder" type="number" min="0" {form} {errors} />
	<InputComp label="Start scene" name="isStart" type="checkboxSingle" placeholder="The tour opens here" {form} {errors} />
</div>
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp
		label="360° panorama"
		name="panorama"
		type="file"
		accept="image/*"
		compress={false}
		removable={false}
		image={panorama}
		description="Equirectangular, full resolution."
		{form}
		{errors}
		required={!panorama}
	/>
	<InputComp label="Preview (small)" name="preview" type="file" accept="image/*" image={preview} {form} {errors} />
</div>
<InputComp label="Active" name="isActive" type="checkboxSingle" placeholder="Shown in the tour" {form} {errors} />
