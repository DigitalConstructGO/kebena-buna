<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { customerSchema } from '#lib/schemas/customers.ts';
	import CustomerFields from '../CustomerFields.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, customerSchema, { taintedMessage: confirmLeave });
</script>

<PageHeader
	title="New customer"
	description="A walk-in, a phone order or a group organiser. A phone already on another customer is refused, naming them."
/>

<form method="POST" use:enhance class="mt-4 grid grid-cols-1 max-w-3xl gap-6">
	<Errors allErrors={$allErrors} />
	<PageSection title="Contact">
		<div class="grid grid-cols-1 gap-4">
			<CustomerFields form={form as never} errors={errors as never} />
		</div>
	</PageSection>
	<Button type="submit" size="lg" class="sm:justify-self-start" disabled={$delayed}>
		{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save customer{/if}
	</Button>
</form>
