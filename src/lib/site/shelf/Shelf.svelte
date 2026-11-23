<!--
	The museum design's bag shelf (`museum/Bag.svelte`), for any list of things to pick up: the shop's
	products, the events, the experiences. Holds `ShelfCard`s; sets them down one after another as
	it scrolls into view, each turning to face you as it lands.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { whenIdle } from '#lib/reveal.js';

	let { children }: { children: Snippet } = $props();

	let shelf = $state<HTMLUListElement>();

	onMount(() =>
		whenIdle(() => {
			if (!shelf) return;
			const { gsap } = setupGsap();
			const ctx = gsap.context(() => {
				gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
					const scrollTrigger = { trigger: shelf, start: 'top 82%', once: true };
					gsap.from('.card', { autoAlpha: 0, y: 70, duration: 0.9, ease: 'power3.out', stagger: 0.14, scrollTrigger });
					gsap.from('.spin', { rotationY: -70, duration: 1.3, ease: 'power3.out', stagger: 0.14, scrollTrigger });
				});
			}, shelf);
			return () => ctx.revert();
		})
	);
</script>

<ul class="shelf" bind:this={shelf}>
	{@render children()}
</ul>

<style>
	/* The design's shelf, widened from three bags to any number of things. */
	.shelf {
		--unit: clamp(92px, 26vw, 150px);
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-items: stretch;
		gap: clamp(10px, 1.6vw, 22px);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	@media (width >= 760px) {
		.shelf {
			--unit: clamp(110px, 12vw, 160px);
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
