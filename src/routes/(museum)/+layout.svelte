<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { lettering } from '#lib/lettering.js';
	import '#lib/site/museum.css';

	let { children } = $props();

	let root: HTMLElement;
	let letters: ReturnType<typeof lettering> | undefined;

	// headings are lettered in as they come into view, and again under the pointer (`lettering`)
	onMount(() => {
		letters = lettering(root);
		return () => letters?.destroy();
	});
	afterNavigate(() => letters?.scan());
</script>

<!-- The design's look is scoped to `.museum` (`museum.css`), clear of the dashboard's theme. -->
<div class="museum" bind:this={root}>
	{@render children()}
</div>
