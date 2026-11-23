<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';
	import { HOTSPOT_KINDS } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';

	type Store = ComponentProps<typeof InputComp>['form'];
	type Option = { value: number; name: string };
	/**
	 * A hotspot's fields. What it opens follows its kind: a product, a lot, a station (the origins
	 * map), something bookable, another scene, a link — or, for an info point, optionally an event.
	 */
	let {
		form,
		errors,
		kind,
		options
	}: {
		form: Store;
		errors: Store;
		kind: string;
		options: {
			products: Option[];
			lots: Option[];
			stations: Option[];
			bookables: Option[];
			events: Option[];
			scenes: Option[];
		};
	} = $props();
</script>

<input type="hidden" name="sceneId" value={$form.sceneId} />
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp
		label="Kind"
		name="kind"
		type="select"
		items={choicesOf(HOTSPOT_KINDS)}
		{form}
		{errors}
		required
	/>
	{#if kind === 'product'}
		<InputComp
			label="Product"
			name="productId"
			type="combo"
			items={options.products}
			{form}
			{errors}
			required
		/>
	{:else if kind === 'lot'}
		<InputComp
			label="Lot"
			name="lotId"
			type="combo"
			items={options.lots}
			{form}
			{errors}
			required
		/>
	{:else if kind === 'origin_map'}
		<InputComp
			label="Station on the map"
			name="stationId"
			type="combo"
			items={options.stations}
			{form}
			{errors}
			required
		/>
	{:else if kind === 'booking'}
		<InputComp
			label="What it books"
			name="bookableId"
			type="combo"
			items={options.bookables}
			{form}
			{errors}
			required
		/>
	{:else if kind === 'scene'}
		<InputComp
			label="Goes to scene"
			name="targetSceneId"
			type="combo"
			items={options.scenes}
			{form}
			{errors}
			required
		/>
	{:else if kind === 'link'}
		<InputComp
			label="Link"
			name="url"
			description="A full https:// address, or a page of this site like /visit"
			{form}
			{errors}
			required
		/>
	{:else}
		<InputComp
			label="Event (optional)"
			name="eventId"
			type="combo"
			items={options.events}
			{form}
			{errors}
		/>
	{/if}
	<div class="col-span-full">
		<LanguageTabs {form} {errors} fields={['title', 'body']}>
			{#snippet children({ lang, suffix, language })}
				<InputComp
					label="Title ({language})"
					name="title{suffix}"
					{form}
					{errors}
					required={lang === 'en'}
				/>
				<InputComp
					label="Text ({language})"
					name="body{suffix}"
					type="textarea"
					rows={3}
					{form}
					{errors}
				/>
			{/snippet}
		</LanguageTabs>
	</div>
	<InputComp
		label="Yaw° (left–right)"
		name="yaw"
		type="number"
		step="0.001"
		{form}
		{errors}
		required
	/>
	<InputComp
		label="Pitch° (up–down)"
		name="pitch"
		type="number"
		step="0.001"
		{form}
		{errors}
		required
	/>
	<InputComp label="Video link" name="videoUrl" type="url" {form} {errors} />
	<InputComp label="Order" name="sortOrder" type="number" min="0" {form} {errors} />
</div>
