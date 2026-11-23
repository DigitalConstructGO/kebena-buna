<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { lotSchema } from '#lib/schemas/origins.ts';
	import LotFields from '../LotFields.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, lotSchema, {
		taintedMessage: confirmLeave,
		dataType: 'json'
	});
</script>

<PageHeader
	title="New lot"
	description="Station, region, process and crop year are enough to start; the code is given from the station and year."
/>

<form method="POST" use:enhance class="mt-4 grid max-w-3xl grid-cols-1 gap-6">
	<Errors allErrors={$allErrors} />
	<PageSection title="Lot">
		<div class="grid grid-cols-1 gap-4">
			<LotFields
				form={form as never}
				errors={errors as never}
				options={data.options}
				lowDefault={data.greenLowDefault}
			/>
		</div>
	</PageSection>
	<Button type="submit" size="lg" class="sm:justify-self-start" disabled={$delayed}>
		{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save lot{/if}
	</Button>
</form>
