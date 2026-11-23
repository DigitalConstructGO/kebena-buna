<script lang="ts">
	import { getLocale, getTextDirection } from '#lib/paraglide/runtime.js';
	import SiteHeader from '#lib/site/SiteHeader.svelte';
	import SiteFooter from '#lib/site/SiteFooter.svelte';
	import '#lib/site/site.css';

	let { children } = $props();

	const locale = $derived(getLocale());
</script>

<svelte:head>
	<!-- The design's saved theme (`kb-theme`), set before paint so the page does not flash. -->
	<script>
		try {
			var t = localStorage.getItem('kb-theme');
			if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
		} catch (e) {}
	</script>
</svelte:head>

<div class="site" lang={locale} dir={getTextDirection(locale)}>
	<SiteHeader />
	<main>
		{@render children()}
	</main>
	<SiteFooter />
</div>
