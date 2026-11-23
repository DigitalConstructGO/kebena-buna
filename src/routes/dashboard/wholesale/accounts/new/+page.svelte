<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { accountSchema } from '#lib/schemas/wholesale.ts';
	import AccountFields from '../AccountFields.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, accountSchema, { taintedMessage: confirmLeave });
</script>

<PageHeader
	title="New business account"
	description="An application taken by phone or in person. It stays pending until a Manager or Owner other than you approves it."
/>

<form method="POST" enctype="multipart/form-data" use:enhance class="mt-4 grid grid-cols-1 max-w-3xl gap-6">
	<Errors allErrors={$allErrors} />
	<PageSection title="Application">
		<div class="grid grid-cols-1 gap-4">
			<AccountFields form={form as never} errors={errors as never} />
		</div>
	</PageSection>
	<Button type="submit" size="lg" class="sm:justify-self-start" disabled={$delayed}>
		{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save application{/if}
	</Button>
</form>
