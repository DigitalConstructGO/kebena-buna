<script lang="ts">
	import SiteNav from '#lib/components/museum/SiteNav.svelte';
	import SiteFooter from '#lib/components/museum/SiteFooter.svelte';
	import PageArt from '#lib/site/PageArt.svelte';
	import { footerContent } from '#lib/content/museum.ts';
	import { setKitLabels } from '@nahu/admin-kit/labels';
	import { publicKitLabels } from '#lib/site/kitLabels.ts';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { tr } from '#lib/format.ts';
	import '#lib/site/museum.css';
	import '#lib/site/site.css';

	let { data, children } = $props();

	const locale = $derived(getLocale());
	const pages = $derived(data.menuPages.map((p) => ({ label: tr(p.title, locale), href: p.href })));

	// The kit's controls speak the page's language (`kitLabels.ts`).
	setKitLabels(publicKitLabels);
</script>

<!-- The museum's header and footer around the shop, visit and form pages (`site.css`). -->
<div class="museum site">
	<PageArt />
	<SiteNav wayfinder={false} />
	<main>
		{@render children()}
	</main>
	<SiteFooter content={footerContent(pages)} />
</div>
