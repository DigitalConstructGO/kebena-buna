<script lang="ts">
	import SiteNav from '#lib/components/museum/SiteNav.svelte';
	import History from '#lib/components/museum/History.svelte';
	import { m } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{m.history_head_title({ title: data.section.content.title })}</title>
	<meta name="description" content={data.section.content.title} />
</svelte:head>

<main>
	<SiteNav />
	<History section={data.section} heading="h1" />
</main>
