<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { fileUrl } from '@nahu/admin-kit/files';
	import { tr } from '#lib/format.ts';
	import { membershipPlanEditSchema } from '#lib/schemas/memberships.ts';
	import PlanFields from '../../PlanFields.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, membershipPlanEditSchema, {
		taintedMessage: confirmLeave,
		resetForm: false
	});
</script>

<PageHeader title={tr(data.plan.name)} eyebrow="Edit membership plan">
	{#snippet actions()}
		<Button href="/dashboard/memberships/plans/{data.plan.id}" variant="outline">
			<ArrowLeft class="size-4" /> Back to the plan
		</Button>
	{/snippet}
</PageHeader>

<form method="POST" enctype="multipart/form-data" use:enhance class="mt-4 grid max-w-5xl grid-cols-1 gap-6">
	<Errors allErrors={$allErrors} />
	<PageSection title="Plan">
		<div class="grid grid-cols-1 gap-4">
			<PlanFields
				form={form as never}
				errors={errors as never}
				options={data.options}
				image={data.plan.image ? fileUrl(data.plan.image) : ''}
			/>
		</div>
	</PageSection>
	<div class="sticky bottom-2 flex justify-end">
		<Button type="submit" size="lg" class="shadow-md" disabled={$delayed}>
			{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save plan{/if}
		</Button>
	</div>
</form>
