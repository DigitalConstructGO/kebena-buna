<script lang="ts">
	import { page } from '$app/state';
	import SiteNav from '#lib/components/museum/SiteNav.svelte';
	import Hero from '#lib/components/museum/hero/Hero.svelte';
	import Doorway from '#lib/components/museum/Doorway.svelte';
	import Bag from '#lib/components/museum/Bag.svelte';
	import Tour, { type TourStop, type TourOutro } from '#lib/components/museum/Tour.svelte';
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

	// The walk behind the doors. These are concept pictures: swap each `src` for the real
	// photograph of that part of the museum when the client sends them.
	const outro: TourOutro = {
		eyebrow: 'The tour ends here',
		title: 'The rest you have to taste.',
		text: 'Pictures can show you the cup. Only Jimma can fill it. Come in, sit down, and let us pour you one.',
		cta: 'Plan your visit',
		href: '#visit'
	};

	const tour: TourStop[] = [
		{
			id: 'building',
			title: 'The building',
			text: 'A coffee cup, built as a museum.',
			src: '/tour/building.webp',
			alt: 'The Kebena museum, a white cup-shaped building with tulip mosaics'
		},
		{
			id: 'hall',
			title: 'The entrance hall',
			text: 'Step through the door into the round room at the foot of the cup.',
			src: '/tour/hall.webp',
			alt: 'A round white entrance hall with a curved wooden desk and leaf-shaped green windows'
		},
		{
			id: 'origin',
			title: 'Where coffee began',
			text: 'The highland forest where the coffee tree first grew wild.',
			src: '/tour/origin.webp',
			alt: 'A round gallery with lit forest photographs and a coffee tree at its centre'
		},
		{
			id: 'farm',
			title: 'The farm room',
			text: 'Living coffee plants, harvest baskets and the tools of the pickers.',
			src: '/tour/farm.webp',
			alt: 'Coffee plants in planters beside woven baskets and hand tools on a white wall'
		},
		{
			id: 'process',
			title: 'From cherry to bean',
			text: 'Drying beds, the hulling machine and sacks of green coffee.',
			src: '/tour/process.webp',
			alt: 'Raised drying beds of coffee beans, a wooden hulling machine and jute sacks'
		},
		{
			id: 'roast',
			title: 'The roasting room',
			text: 'An old drum roaster beside the pans used over the home fire.',
			src: '/tour/roast.webp',
			alt: 'A vintage drum coffee roaster in front of a wall of iron roasting pans'
		},
		{
			id: 'collection',
			title: 'The jebena wall',
			text: 'Clay coffee pots from across the country, shelf after shelf.',
			src: '/tour/collection.webp',
			alt: 'A long curved wall of lit shelves holding black clay jebena coffee pots'
		},
		{
			id: 'tasting',
			title: 'The tasting bar',
			text: 'Sit down and taste what you have just walked through.',
			src: '/tour/tasting.webp',
			alt: 'A round wooden tasting bar set with white cups under brass lamps'
		},
		{
			id: 'atrium',
			title: 'Looking up',
			text: 'The walls open outwards towards the rim, and daylight falls in.',
			src: '/tour/atrium.webp',
			alt: 'Looking up through the atrium to a round skylight and upper gallery'
		}
	];
</script>

<svelte:head>
	<title>Kebena Buna · Coffee museum, Jimma</title>
	<meta
		name="description"
		content="From a single seed to your cup. A living coffee museum in Jimma, the birthplace of coffee."
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
		{#key mode}
			<Doorway><Tour stops={tour} {outro} note="Concept pictures" lead={1.35} /></Doorway>
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
	.shade {
		position: absolute;
		inset: 0;
		z-index: 10;
		background: var(--color-forest-950);
		opacity: 0;
		pointer-events: none;
	}
</style>
