<script lang="ts">
	import SiteNav from '#lib/components/museum/SiteNav.svelte';
	import SiteFooter from '#lib/components/museum/SiteFooter.svelte';
	import { museum } from '#lib/content/museum.ts';
	import '#lib/site/museum.css';
	import '#lib/site/site.css';

	let { children } = $props();
</script>

<!-- The museum's header and footer around the shop, visit and form pages (`site.css`). -->
<div class="museum site">
	<SiteNav wayfinder={false} />
	<main>
		{@render children()}
	</main>
	<SiteFooter content={museum.footer} />
</div>
