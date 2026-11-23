<script lang="ts">
	import type { Writable } from 'svelte/store';
	import PasswordGenerator from '@nahu/admin-kit/components/PasswordGenerator.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';

	/**
	 * A new password: typed, or made by the kit's generator, which writes into the same field.
	 * The person is given it in person — nothing is emailed — and changes it after signing in.
	 */
	let {
		form,
		errors,
		name = 'password',
		label = 'Password'
	}: {
		form: Writable<Record<string, unknown>>;
		errors: Writable<Record<string, unknown>>;
		name?: string;
		label?: string;
	} = $props();
</script>

<div class="grid grid-cols-1 gap-1">
	<InputComp
		{label}
		{name}
		type="password"
		{form}
		{errors}
		required
		description="At least 10 characters. Use the generator for a strong one, copy it, and hand it over in person."
	/>
	<div class="px-1">
		<PasswordGenerator
			bind:password={
				() => String(($form[name] as string | null | undefined) ?? ''),
				(value: string) => ($form[name] = value)
			}
		/>
	</div>
</div>
