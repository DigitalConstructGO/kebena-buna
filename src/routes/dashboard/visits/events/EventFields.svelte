<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import RichEditor from '@nahu/admin-kit/formComponents/RichEditor.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';
	import { EVENT_VISIBILITIES, PUBLISH_STATUSES } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';

	type Store = ComponentProps<typeof InputComp>['form'];
	/**
	 * An event's fields, for the new-event page and its edit page: the words in both languages
	 * (the description in the kit's rich editor, sanitised on the server), where and when, places,
	 * who may come, and its picture.
	 */
	let {
		form,
		errors,
		locations,
		image = ''
	}: {
		form: Store;
		errors: Store;
		locations: { value: number; name: string }[];
		/** The stored picture, shown while editing. */
		image?: string;
	} = $props();

	const errorOf = (name: string) => {
		const e = ($errors as Record<string, unknown>)[name];
		return Array.isArray(e) ? String(e[0] ?? '') : '';
	};
</script>

<div class="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
	<div class="grid grid-cols-1 min-w-0 gap-6">
		<PageSection title="Words">
			<LanguageTabs form={form as never} errors={errors as never} fields={['title', 'summary', 'description']}>
				{#snippet children({ lang, suffix, language })}
					<InputComp label="Title ({language})" name="title{suffix}" {form} {errors} required={lang === 'en'} />
					<InputComp
						label="Summary ({language})"
						name="summary{suffix}"
						type="textarea"
						rows={2}
						description={lang === 'en' ? 'One or two sentences for lists and search engines.' : undefined}
						{form}
						{errors}
					/>
					<RichEditor
						name="description{suffix}"
						label="Description ({language})"
						bind:value={$form[`description${suffix}`]}
						error={errorOf(`description${suffix}`)}
					/>
				{/snippet}
			</LanguageTabs>
		</PageSection>
	</div>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Publishing">
			<div class="grid grid-cols-1 gap-2">
				<InputComp label="Status" name="publishStatus" type="select" items={choicesOf(PUBLISH_STATUSES)} {form} {errors} required />
				<InputComp label="Who may come" name="visibility" type="select" items={choicesOf(EVENT_VISIBILITIES)} {form} {errors} required />
				<InputComp label="Address" name="slug" description="/events/your-event — lowercase words and hyphens." {form} {errors} required />
			</div>
		</PageSection>
		<PageSection title="Where and when">
			<div class="grid grid-cols-1 gap-2">
				<InputComp label="Location" name="locationId" type="select" items={locations} {form} {errors} required />
				<div class="grid grid-cols-[1fr_7rem] gap-2">
					<InputComp label="Starts" name="startDate" type="date" futureDays {form} {errors} required />
					<InputComp label="at" name="startTime" type="time" {form} {errors} required />
					<InputComp label="Ends" name="endDate" type="date" futureDays {form} {errors} required />
					<InputComp label="at" name="endTime" type="time" {form} {errors} required />
					<InputComp label="Registration closes" name="closesDate" type="date" futureDays allowEmpty {form} {errors} />
					<InputComp label="at" name="closesTime" type="time" {form} {errors} />
				</div>
			</div>
		</PageSection>
		<PageSection title="Places">
			<div class="grid grid-cols-1 gap-2">
				<InputComp label="Capacity" name="capacity" type="number" min={1} {form} {errors} required />
				<InputComp label="Free" name="isFree" type="checkboxSingle" placeholder="Free: registration issues free tickets" {form} {errors} />
				<InputComp label="Entry" name="includesEntry" type="checkboxSingle" placeholder="Its ticket also admits to the museum that day" {form} {errors} />
				{#if 'isActive' in $form}
					<InputComp label="Active" name="isActive" type="checkboxSingle" placeholder="Active" {form} {errors} />
				{/if}
			</div>
		</PageSection>
		<PageSection title="Picture">
			<InputComp label="Picture" name="image" type="file" accept="image/*" {image} hideLabel {form} {errors} />
		</PageSection>
	</div>
</div>
