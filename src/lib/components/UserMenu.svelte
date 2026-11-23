<script lang="ts">
	import UserRound from '@lucide/svelte/icons/user-round';
	import LogOut from '@lucide/svelte/icons/log-out';
	import * as DropdownMenu from '@nahu/admin-kit/components/ui/dropdown-menu/index.js';
	import * as Avatar from '@nahu/admin-kit/components/ui/avatar/index.js';
	import { buttonVariants } from '@nahu/admin-kit/components/ui/button/index.js';

	/** The signed-in person: who they are, their own account, and the way out. */
	let { account }: { account: { name: string; email: string; role: string } } = $props();

	const initials = $derived(
		account.name
			.split(/\s+/)
			.map((part) => part[0])
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);
	let logoutForm = $state<HTMLFormElement>();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class={buttonVariants({ variant: 'ghost', size: 'icon' })} aria-label="Account">
		<Avatar.Root class="size-8">
			<Avatar.Fallback class="bg-primary text-xs text-primary-foreground">{initials}</Avatar.Fallback>
		</Avatar.Root>
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-56">
		<DropdownMenu.Label>
			<div class="font-medium">{account.name}</div>
			<div class="text-xs font-normal text-muted-foreground">{account.role || account.email}</div>
		</DropdownMenu.Label>
		<DropdownMenu.Separator />
		<DropdownMenu.Item>
			{#snippet child({ props })}
				<a href="/dashboard/account" {...props}><UserRound class="size-4" /> My account</a>
			{/snippet}
		</DropdownMenu.Item>
		<DropdownMenu.Item onSelect={() => logoutForm?.requestSubmit()}>
			<LogOut class="size-4" /> Sign out
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<form method="POST" action="/logout" bind:this={logoutForm} class="hidden"></form>
