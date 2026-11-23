<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { getFlash } from 'sveltekit-flash-message';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '@nahu/admin-kit/components/ui/sonner/index.js';
	import { setKitCalendar } from '@nahu/admin-kit/calendarPreference.svelte';
	import { baseLocale, deLocalizeHref, locales, localizeHref } from '#lib/paraglide/runtime.js';
	// the body font, preloaded so the first paint uses it instead of swapping a moment later
	import interLatin from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url';
	import { SITE_URL } from '#lib/site/seo.ts';
	import { m, setSiteText } from '#lib/i18n.ts';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Staff edits to the site's words (Website › Site text), in place before any page renders and
	// refreshed when a save invalidates the layout.
	setSiteText(untrack(() => data.siteText));
	$effect.pre(() => setSiteText(data.siteText));

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

	/** Staff pages are not for search engines: no language alternates or sharing cards there. */
	const isPublic = $derived(!/^\/(dashboard|login|logout)(\/|$)/.test(page.url.pathname));
	// every language version of this page, so search engines show each reader their own
	const base = $derived(deLocalizeHref(page.url.pathname));
	const alternates = $derived(
		locales.map((locale) => ({ locale, href: SITE_URL + localizeHref(base, { locale }) }))
	);
</script>

<svelte:head>
	<!-- the bean from the nav; the PNGs are for browsers without SVG icons and iOS home screens -->
	<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	{#if isPublic}
		<link rel="preload" href={interLatin} as="font" type="font/woff2" crossorigin="anonymous" />
		<link rel="canonical" href={SITE_URL + page.url.pathname} />
		{#each alternates as a (a.locale)}
			<link rel="alternate" hreflang={a.locale} href={a.href} />
		{/each}
		<link
			rel="alternate"
			hreflang="x-default"
			href={SITE_URL + localizeHref(base, { locale: baseLocale })}
		/>
		<meta property="og:site_name" content={m.site_og_site_name()} />
		<meta property="og:type" content="website" />
		<meta property="og:url" content={SITE_URL + page.url.pathname} />
		<meta property="og:image" content={SITE_URL + '/hero/museum.webp'} />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="theme-color" content="#232d25" />
	{/if}
</svelte:head>

<Toaster
	position="bottom-right"
	richColors
	closeButton
	containerAriaLabel={m.site_notifications()}
/>

{@render children()}

<div style="display:none">
	{#each locales as locale (locale)}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
	{/each}
</div>
