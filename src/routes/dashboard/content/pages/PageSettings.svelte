<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { PAGE_TEMPLATES } from '#lib/schemas/content.ts';
	import { choicesOf } from '#lib/format.ts';

	type Store = ComponentProps<typeof InputComp>['form'];
	/** What a page has and a post does not: its place in the site's tree and menu, and its layout. */
	let {
		form,
		errors,
		parents
	}: { form: Store; errors: Store; parents: { value: number; name: string }[] } = $props();
</script>

<InputComp label="Parent page" name="parentId" type="combo" items={parents} {form} {errors} />
<InputComp
	label="Template"
	name="template"
	type="select"
	items={choicesOf(PAGE_TEMPLATES)}
	description="Which layout the website draws it with."
	{form}
	{errors}
	required
/>
<InputComp
	label="Menu"
	name="showInMenu"
	type="checkboxSingle"
	placeholder="Show it in the menu and footer"
	{form}
	{errors}
/>
<InputComp label="Order in the menu" name="sortOrder" type="number" min="0" {form} {errors} />
