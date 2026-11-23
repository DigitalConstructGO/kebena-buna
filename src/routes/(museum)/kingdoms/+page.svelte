<script lang="ts">
	import SiteNav from '#lib/components/museum/SiteNav.svelte';
	import Kingdoms from '#lib/components/museum/Kingdoms.svelte';
	import { m } from '#lib/i18n.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{m.kingdoms_head_title({ title: data.section.content.title })}</title>
	<meta name="description" content={data.section.content.intro} />
</svelte:head>

<main>
	<SiteNav />
	<Kingdoms section={data.section} heading="h1" />
</main>
