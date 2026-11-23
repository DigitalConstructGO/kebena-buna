<script lang="ts">
	import { page } from '$app/state';
	import { getFlash } from 'sveltekit-flash-message';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '@nahu/admin-kit/components/ui/sonner/index.js';
	import { setKitCalendar } from '@nahu/admin-kit/calendarPreference.svelte';
	import { locales, localizeHref } from '#lib/paraglide/runtime.js';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Orders, receipts and Chapa are dated in the Gregorian calendar; every kit date input can still
	// be switched to the Ethiopian one by the person using it.
	setKitCalendar('gregorian');

	const flash = getFlash(page, { clearAfterMs: 5000 });

	// Messages from plain form actions (`ConfirmAction`, `lookupDeleteAction`) — superforms actions
	// toast through `createForm` instead.
	$effect(() => {
		const message = (page.form as { message?: { type: string; text: string } } | null)?.message;
		if (message?.text) {
			if (message.type === 'error') toast.error(message.text);
			else toast.success(message.text);
		}
	});

	$effect(() => {
		if (!$flash) return;
		if ($flash.type === 'error') toast.error($flash.message);
		else toast.success($flash.message);
		$flash = undefined;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Toaster position="bottom-right" richColors closeButton />

{@render children()}

<div style="display:none">
	{#each locales as locale (locale)}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
	{/each}
</div>
