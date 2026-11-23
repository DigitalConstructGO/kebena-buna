<script lang="ts">
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import Copy from '@nahu/admin-kit/Copy.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	/**
	 * The sign-in details just set — a new account's, or a reset password — shown once, right
	 * after the save, so the Owner can copy them and hand them over in person. They come
	 * from that action's answer only: a reload or another page and they are gone, and nothing
	 * stores the password in readable form.
	 */
	let {
		credentials
	}: { credentials: { name: string; email: string; password: string } | null | undefined } =
		$props();

	/** The details the reader closed; a later save brings new ones, which show again. */
	// Raw: compared by identity with the prop, which a deep proxy would never equal.
	let closed = $state.raw<object | null>(null);
	const shown = $derived(credentials && credentials !== closed ? credentials : null);
</script>

{#if shown}
	<Notice
		tone="success"
		icon={KeyRound}
		title="Give {shown.name} these details in person."
		class="mt-4"
	>
		<dl class="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
			<dt class="text-muted-foreground">Sign in with</dt>
			<dd class="font-medium break-all"><Copy data={shown.email} /></dd>
			<dt class="text-muted-foreground">Password</dt>
			<dd class="font-mono font-medium break-all"><Copy data={shown.password} /></dd>
		</dl>
		<p class="mt-2 text-sm text-muted-foreground">
			This is the only time the password is shown. They can change it under My account once signed
			in.
		</p>
		{#snippet actions()}
			<Button type="button" size="sm" variant="outline" onclick={() => (closed = shown)}>
				Done
			</Button>
		{/snippet}
	</Notice>
{/if}
