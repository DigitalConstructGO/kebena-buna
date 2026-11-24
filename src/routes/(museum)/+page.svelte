<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/i18n.ts';
	import SiteNav from '#lib/components/museum/SiteNav.svelte';
	import Hero from '#lib/components/museum/hero/Hero.svelte';
	import Doorway from '#lib/components/museum/Doorway.svelte';
	import Bag from '#lib/components/museum/Bag.svelte';
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
		const q = page.url.searchParams.get('data') as DataMode | null;
		return q && DATA_MODES.includes(q) ? q : 'demo';
	});
	const content = $derived(museumFor(mode));
</script>

<svelte:head>
	<title>{m.museum_page_title()}</title>
	<meta name="description" content={m.museum_page_description()} />
	<!-- the hero's first picture: asked for at once, ahead of the stylesheet that names it -->
	<link
		rel="preload"
		as="image"
		href="/hero/nursery-start.webp"
		media="(min-aspect-ratio: 20 / 21)"
		fetchpriority="high"
	/>
	<link
		rel="preload"
		as="image"
		href="/hero/nursery-start-sq.webp"
		media="(max-aspect-ratio: 20 / 21)"
		fetchpriority="high"
	/>
</svelte:head>

<main id="top">
	<SiteNav />
	<!-- the hero stays pinned while the entrance sheet slides up over it -->
	<div class="stack">
		<div class="pin" bind:this={pin}>
			<Hero />
			<div class="shade" aria-hidden="true"></div>
		</div>
		<!-- the scroll the opening story is told over: the hero stays pinned behind it and follows along -->
		<div class="runway" data-hero-runway aria-hidden="true"></div>
		{#key mode}
			<!-- the museum's doors shut over the end of the hero; the four halls follow -->
			<Doorway closing />
			<Halls content={content.halls} />
		{/key}
	</div>
	{#key mode}
		<!-- after the halls: the work from cherry to cup, as one stream poured down the page -->
		<Journey content={content.journey} />
		<!-- a hall with nothing in it is left out, not shown as a bare heading -->
		{#if content.farms.farms.length}<Farms content={content.farms} />{/if}
		<Tibeb />
		<Collection content={content.collection} />
		<Bag />
		{#if content.atlas.origins.length}<Atlas content={content.atlas} />{/if}
		<People content={content.people} />
		{#if content.archive.notes.length}<Archive content={content.archive} />{/if}
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
	.runway {
		height: 520svh;
		pointer-events: none;
	}
	/* no scroll story for people who asked for less motion: the hero shows its ending */
	@media (prefers-reduced-motion: reduce) {
		.runway {
			display: none;
		}
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
