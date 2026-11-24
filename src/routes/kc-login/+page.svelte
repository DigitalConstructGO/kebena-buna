<script lang="ts">
	import LogIn from '@lucide/svelte/icons/log-in';
	import Coffee from '@lucide/svelte/icons/coffee';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm';
	import { loginSchema } from '#lib/schemas/auth.ts';
	import '../kit-fonts.css';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, allErrors, delayed } = createForm(data.form, loginSchema);
</script>

<svelte:head><title>Sign in · Kebena Coffee</title></svelte:head>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
	<div class="flex items-center gap-3">
		<span class="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
			<Coffee class="size-6" />
		</span>
		<span class="leading-tight">
			<span class="block text-lg font-semibold">Kebena Coffee</span>
			<span class="block text-sm text-muted-foreground">Museum, roastery & shop</span>
		</span>
	</div>
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title class="text-xl">Sign in</Card.Title>
			<Card.Description>Staff accounts are made by the Owner in Admin › Users.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" use:enhance class="grid gap-4">
				<Errors allErrors={$allErrors} />
				<InputComp label="Email" name="email" type="email" {form} {errors} required />
				<InputComp label="Password" name="password" type="password" {form} {errors} required />
				<Button type="submit" class="w-full" disabled={$delayed}>
					{#if $delayed}<LoadingBtn name="Signing in" />{:else}<LogIn class="size-4" /> Sign in{/if}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
