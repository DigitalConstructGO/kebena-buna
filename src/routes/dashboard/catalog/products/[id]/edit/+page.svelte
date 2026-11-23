<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { tr } from '#lib/format.ts';
	import { productEditSchema } from '#lib/schemas/catalog.ts';
	import ProductFields from '../../ProductFields.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, productEditSchema, {
		taintedMessage: confirmLeave,
		resetForm: false
	});
</script>

<PageHeader title={tr(data.product.name)} eyebrow="Edit product">
	{#snippet actions()}
		<Button href="/dashboard/catalog/products/{data.product.id}" variant="outline">
			<ArrowLeft class="size-4" /> Back to the product
		</Button>
	{/snippet}
</PageHeader>

<form method="POST" use:enhance class="mt-4 grid max-w-5xl grid-cols-1 gap-6">
	<Errors allErrors={$allErrors} />
	<InputComp type="hidden" name="id" {form} {errors} />
	<PageSection title="Product">
		<div class="grid grid-cols-1 gap-4">
			<ProductFields
				form={form as never}
				errors={errors as never}
				options={data.options}
				lowDefault={data.roastedLowDefault}
			/>
			<InputComp
				label="Active"
				name="isActive"
				type="checkboxSingle"
				placeholder="Offered for sale and in pickers"
				{form}
				{errors}
			/>
		</div>
	</PageSection>
	<div class="sticky bottom-2 flex justify-end">
		<Button type="submit" size="lg" class="shadow-md" disabled={$delayed}>
			{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save product{/if}
		</Button>
	</div>
</form>
