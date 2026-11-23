<script lang="ts">
	import SiteNav from '#lib/components/museum/SiteNav.svelte';
	import SiteFooter from '#lib/components/museum/SiteFooter.svelte';
	import { museum } from '#lib/content/museum.ts';
	import { setKitLabels } from '@nahu/admin-kit/labels';
	import { m } from '#lib/paraglide/messages.js';
	import '#lib/site/museum.css';
	import '#lib/site/site.css';

	let { children } = $props();

	// The kit's form controls speak the page's language; read afresh, so a language switch reaches them.
	setKitLabels(() => ({
		uploadPrompt: m.site_upload_prompt(),
		uploadDropHere: m.site_upload_drop(),
		uploadOptimizing: m.site_upload_optimizing(),
		uploadOptimized: m.site_upload_optimized(),
		clear: m.site_remove(),
		preview: m.site_preview(),
		calendarEthiopian: m.site_cal_ethiopian(),
		calendarGregorian: m.site_cal_gregorian(),
		calendarEthiopianShort: m.site_cal_ethiopian_short(),
		calendarGregorianShort: m.site_cal_gregorian_short(),
		calendarSwitch: m.site_cal_switch()
	}));
</script>

<!-- The museum's header and footer around the shop, visit and form pages (`site.css`). -->
<div class="museum site">
	<SiteNav wayfinder={false} />
	<main>
		{@render children()}
	</main>
	<SiteFooter content={museum.footer} />
</div>
