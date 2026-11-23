<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';

	type Store = ComponentProps<typeof InputComp>['form'];
	type Option = { value: number | string; name: string };
	/** What a post has and a page does not: its category and its author. */
	let {
		form,
		errors,
		categories,
		authors
	}: { form: Store; errors: Store; categories: Option[]; authors: Option[] } = $props();
</script>

<InputComp label="Category" name="categoryId" type="combo" items={categories} {form} {errors} />
<InputComp
	label="Author"
	name="authorId"
	type="combo"
	items={authors}
	description="Left empty, the person saving it."
	{form}
	{errors}
/>
