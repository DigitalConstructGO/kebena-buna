<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { eventSchema } from '#lib/schemas/visits.ts';
	import EventFields from '../EventFields.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, eventSchema, { taintedMessage: confirmLeave });
</script>

<PageHeader title="New event" description="Saved as a draft unless you publish it. Ticket types and staff are added on its page." />

<form method="POST" enctype="multipart/form-data" use:enhance class="mt-4 grid grid-cols-1 gap-6">
	<Errors allErrors={$allErrors} />
	<EventFields {form} {errors} locations={data.locations} />
	<div class="sticky bottom-2 flex justify-end">
		<Button type="submit" size="lg" disabled={$delayed} class="shadow-md">
			{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save event{/if}
		</Button>
	</div>
</form>
