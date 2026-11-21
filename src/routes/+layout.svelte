<script lang="ts">
	import type { Path } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { baseLocale, deLocalizeHref, locales, localizeHref } from '#lib/paraglide/runtime.js';
	// the body font, preloaded so the first paint uses it instead of swapping a moment later
	import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const SITE = 'https://kebena-buna.vercel.app';
	// every language version of this page, so search engines show each reader their own
	const base = $derived(deLocalizeHref(page.url.pathname));
	const alternates = $derived(
		locales.map((locale) => ({ locale, href: SITE + localizeHref(base, { locale }) }))
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preload" href={interLatin} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="canonical" href={SITE + page.url.pathname} />
	{#each alternates as a (a.locale)}
		<link rel="alternate" hreflang={a.locale} href={a.href} />
	{/each}
	<link
		rel="alternate"
		hreflang="x-default"
		href={SITE + localizeHref(base, { locale: baseLocale })}
	/>
	<meta property="og:site_name" content="Kebena Buna" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={SITE + page.url.pathname} />
	<meta property="og:image" content={SITE + '/hero/museum.webp'} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="theme-color" content="#0e2418" />
</svelte:head>

{@render children()}

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Path)}>{locale}</a>
	{/each}
</div>
