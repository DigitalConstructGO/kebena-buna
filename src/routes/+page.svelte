<script lang="ts">
	import { page } from '$app/state';
	import SiteNav from '#lib/components/museum/SiteNav.svelte';
	import Hero from '#lib/components/museum/hero/Hero.svelte';
	import Entrance from '#lib/components/museum/Entrance.svelte';
	import Halls from '#lib/components/museum/Halls.svelte';
	import Journey from '#lib/components/museum/Journey.svelte';
	import Farms from '#lib/components/museum/Farms.svelte';
	import Tibeb from '#lib/components/museum/Tibeb.svelte';
	import Collection from '#lib/components/museum/Collection.svelte';
	import Atlas from '#lib/components/museum/Atlas.svelte';
	import People from '#lib/components/museum/People.svelte';
	import Archive from '#lib/components/museum/Archive.svelte';
	import Visit from '#lib/components/museum/Visit.svelte';
	import SiteFooter from '#lib/components/museum/SiteFooter.svelte';
	import { DATA_MODES, museumFor, type DataMode } from '#lib/content/museum.js';

	const dev = import.meta.env.DEV;
	let pin = $state<HTMLElement>();

	// dev-only stress fixtures: ?data=worst | empty | one
	const mode = $derived.by<DataMode>(() => {
		if (!dev) return 'demo';
		const m = page.url.searchParams.get('data') as DataMode | null;
		return m && DATA_MODES.includes(m) ? m : 'demo';
	});
	const content = $derived(museumFor(mode));
</script>

<svelte:head>
	<title>Kebena Buna · Coffee museum, Jimma</title>
	<meta
		name="description"
		content="From a single seed to your cup. A living coffee museum in Jimma, the birthplace of coffee."
	/>
</svelte:head>

<main>
	<SiteNav />
	<!-- the hero stays pinned while the entrance sheet slides up over it -->
	<div class="stack">
		<div class="pin" bind:this={pin}>
			<Hero />
			<div class="shade" aria-hidden="true"></div>
		</div>
		{#key mode}
			<Entrance content={content.entrance} under={pin} />
		{/key}
	</div>
	{#key mode}
		<Halls content={content.halls} />
		<!-- after the halls: the work from cherry to cup, as one stream poured down the page -->
		<Journey content={content.journey} />
		<Farms content={content.farms} />
		<Tibeb />
		<Collection content={content.collection} />
		<Atlas content={content.atlas} />
		<People content={content.people} />
		<Archive content={content.archive} />
		<Visit content={content.visit} />
	{/key}
</main>
<SiteFooter content={content.footer} />

<!-- The dev "Demo data / Worst case / Empty / One" switch is hidden for now.
     To bring it back: import DataToggle from '#lib/components/dev/DataToggle.svelte'
     and render <DataToggle {mode} modes={DATA_MODES} /> inside {#if dev}. -->

<style>
	main {
		position: relative;
	}
	.pin {
		position: sticky;
		top: 0;
		z-index: 0;
		overflow: hidden;
		transform-origin: 50% 0%;
	}
	.shade {
		position: absolute;
		inset: 0;
		z-index: 10;
		background: var(--color-forest-950);
		opacity: 0;
		pointer-events: none;
	}
</style>
