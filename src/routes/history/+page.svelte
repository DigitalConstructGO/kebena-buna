<script lang="ts">
	import SiteNav from '#lib/components/museum/SiteNav.svelte';
	import History from '#lib/components/museum/History.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.section.content.title} · Kebena Buna</title>
	<meta name="description" content={data.section.content.title} />
</svelte:head>

<main>
	<SiteNav />
	<History section={data.section} heading="h1" />
</main>
