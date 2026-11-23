<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { pageSchema } from '#lib/schemas/content.ts';
	import DocFields from '#lib/components/content/DocFields.svelte';
	import PageSettings from '../PageSettings.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, pageSchema, { taintedMessage: confirmLeave });
</script>

<PageHeader title="New page" description="Write it in English first; the Amharic can follow." />

<form method="POST" enctype="multipart/form-data" use:enhance class="mt-4 grid grid-cols-1 gap-6">
	<Errors allErrors={$allErrors} />
	<DocFields {form} {errors} base="/" picture="heroImage" pictureLabel="Hero picture" isNew>
		{#snippet settings()}
			<PageSettings {form} {errors} parents={data.parents} />
		{/snippet}
	</DocFields>
	<div class="sticky bottom-2 flex justify-end">
		<Button type="submit" disabled={$delayed} class="shadow-md">
			{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save page{/if}
		</Button>
	</div>
</form>
