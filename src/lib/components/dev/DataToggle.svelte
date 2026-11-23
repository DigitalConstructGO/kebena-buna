<script lang="ts">
	import type { DataMode } from '#lib/content/museum.js';

	/** Dev-only: swaps the page's content fixture through the ?data= URL param. */
	let { mode, modes }: { mode: DataMode; modes: DataMode[] } = $props();

	const labels: Record<DataMode, string> = { demo: 'Demo data', worst: 'Worst case', empty: 'Empty', one: 'One' };
</script>

<nav class="toggle" aria-label="Dev data fixture">
	{#each modes as m (m)}
		<a
			href={m === 'demo' ? '?' : `?data=${m}`}
			class={{ on: m === mode }}
			aria-current={m === mode ? 'true' : undefined}
			data-sveltekit-reset="false"
			data-sveltekit-replacestate>{labels[m]}</a
		>
	{/each}
</nav>

<style>
	.toggle {
		position: fixed;
		z-index: 1000;
		left: 50%;
		bottom: 8px;
		translate: -50% 0;
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: 10px;
		background: #e4e4e7;
		font: 12px/1 system-ui, sans-serif;
	}
	a {
		padding: 6px 10px;
		border-radius: 7px;
		color: #3f3f46;
		text-decoration: none;
		white-space: nowrap;
	}
	a.on {
		background: #fff;
		color: #18181b;
	}
</style>
