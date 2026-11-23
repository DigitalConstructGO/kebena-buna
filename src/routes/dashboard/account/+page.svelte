<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { formatDate } from '#lib/format.ts';
	import { accountSchema, changePasswordSchema } from '#lib/schemas/admin.ts';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const name = createForm(data.nameForm, accountSchema, { resetForm: false });
	// svelte-ignore state_referenced_locally
	const pass = createForm(data.passwordForm, changePasswordSchema);
	const { form: nameData, errors: nameErrors, enhance: nameEnhance, delayed: nameBusy } = name;
	const { form: passData, errors: passErrors, enhance: passEnhance, delayed: passBusy, allErrors } = pass;
</script>

<PageHeader title="My account" description={data.me.email} />

<div class="mt-6 grid grid-cols-1 max-w-4xl gap-6 lg:grid-cols-2">
	<PageSection title="You">
		<SingleTable
			singleTable={[
				{ name: 'Email (signs in with)', value: data.me.email },
				{ name: 'Role', value: data.me.role ?? 'Customer' },
				{ name: 'Since', value: formatDate(data.me.createdAt) }
			]}
		/>
		<form method="POST" action="?/name" use:nameEnhance class="mt-4 grid grid-cols-1 gap-3">
			<InputComp label="Your name" name="name" form={nameData} errors={nameErrors} required id="account-name" />
			<Button type="submit" class="justify-self-start" disabled={$nameBusy}>
				{#if $nameBusy}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save name{/if}
			</Button>
		</form>
	</PageSection>
	<PageSection title="Password" hint="Changing it signs your other devices out.">
		<form method="POST" action="?/password" use:passEnhance class="grid grid-cols-1 gap-3">
			<Errors allErrors={$allErrors} />
			<InputComp label="Current password" name="currentPassword" type="password" form={passData} errors={passErrors} required />
			<InputComp label="New password" name="newPassword" type="password" form={passData} errors={passErrors} required description="At least 10 characters." />
			<InputComp label="New password again" name="confirm" type="password" form={passData} errors={passErrors} required />
			<Button type="submit" class="justify-self-start" disabled={$passBusy}>
				{#if $passBusy}<LoadingBtn name="Changing" />{:else}<KeyRound class="size-4" /> Change password{/if}
			</Button>
		</form>
	</PageSection>
</div>
