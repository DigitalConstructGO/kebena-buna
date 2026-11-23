<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import RichEditor from '@nahu/admin-kit/formComponents/RichEditor.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { productNewSchema } from '../schema.ts';
	import ProductFields from '../ProductFields.svelte';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';
	import OptionFields from '../OptionFields.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, productNewSchema, {
		taintedMessage: confirmLeave,
		dataType: 'json'
	});
</script>

<PageHeader
	title="New product"
	description="The product itself; its sizes and prices, origins and photos are added on its page next."
/>

<form method="POST" use:enhance class="mt-4 grid max-w-5xl grid-cols-1 gap-6">
	<Errors allErrors={$allErrors} />
	<PageSection title="Product">
		<div class="grid grid-cols-1 gap-4">
			<ProductFields
				form={form as never}
				errors={errors as never}
				options={data.options}
				lowDefault={data.roastedLowDefault}
			/>
		</div>
	</PageSection>
	<PageSection
		title="Description"
		hint="Shown on the product page. Pasted formatting is cleaned on save."
	>
		<LanguageTabs form={form as never} errors={errors as never} fields={['description']}>
			{#snippet children({ suffix, language })}
				<RichEditor
					name="description{suffix}"
					label="Description ({language})"
					bind:value={$form[`description${suffix}`]}
				/>
			{/snippet}
		</LanguageTabs>
	</PageSection>
	<PageSection title="Allowed options">
		<OptionFields form={form as never} errors={errors as never} options={data.options} />
	</PageSection>
	<div class="sticky bottom-2 flex justify-end">
		<Button type="submit" size="lg" class="shadow-md" disabled={$delayed}>
			{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save product{/if}
		</Button>
	</div>
</form>
