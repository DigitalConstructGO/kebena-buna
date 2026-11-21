<script lang="ts">
	import { onMount } from 'svelte';
	import { reveal } from '#lib/reveal.js';
	import type { VisitContent } from '#lib/content/museum.js';

	let { content }: { content: VisitContent } = $props();
	let root: HTMLElement;

	onMount(() =>
		reveal(root, ({ gsap }) => {
			gsap.from('.roads path', {
				drawSVG: '0%',
				duration: 1.4,
				ease: 'power2.inOut',
				stagger: 0.12,
				scrollTrigger: { trigger: '.map', start: 'top 80%', once: true }
			});
		})
	);
</script>

<section class="visit kb-section" id="visit" bind:this={root} aria-labelledby="visit-title">
	<div class="copy">
		<p class="kb-eyebrow" data-reveal>{content.eyebrow}</p>
		<h2 class="kb-title" id="visit-title" data-reveal>{content.title}</h2>
		<dl data-reveal>
			{#each content.rows as r (r.label)}
				<div class="row">
					<dt>{r.label}</dt>
					<dd>
						<!-- link by the value's shape, so a translated label still works -->
						{#if /^\S+@\S+\.\S+$/.test(r.value)}
							<a href={`mailto:${r.value}`}>{r.value}</a>
						{:else if /^\+?[\d\s-]{7,}$/.test(r.value)}
							<a href={`tel:${r.value.replace(/\s/g, '')}`}>{r.value}</a>
						{:else}
							{r.value}
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
		<div class="actions" data-reveal>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external maps link -->
			<a class="kb-btn primary" href={content.directions.href} target="_blank" rel="noopener noreferrer">{content.directions.label}</a>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- tel: link -->
			<a class="kb-btn secondary" href={content.call.href}>{content.call.label}</a>
		</div>
	</div>

	<figure class="map" data-reveal aria-label={`${content.place.name}, ${content.place.area}`}>
		<svg viewBox="0 0 560 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
			<g class="blocks">
				<rect x="40" y="170" width="110" height="80" rx="8" />
				<rect x="230" y="40" width="150" height="90" rx="8" />
				<rect x="460" y="190" width="80" height="110" rx="8" />
				<rect x="60" y="330" width="90" height="60" rx="8" />
				<rect x="320" y="330" width="90" height="70" rx="8" />
			</g>
			<g class="roads">
				<path d="M-20 300 L600 220" />
				<path d="M20 -20 L120 460" />
				<path d="M-20 160 L600 120" />
				<path d="M20 -20 L40 460" />
				<path d="M-20 380 L600 330" />
			</g>
			<circle class="ring" cx="280" cy="260" r="32" />
			<circle class="core" cx="280" cy="260" r="10" />
		</svg>
		<figcaption class="label">
			<span class="name">{content.place.name}</span>
			<span class="area">{content.place.area}</span>
		</figcaption>
	</figure>
</section>

<style>
	.visit {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 560px);
		gap: clamp(40px, 5.6vw, 80px);
		align-items: start;
		background: var(--paper);
		color: var(--ink);
	}
	.copy {
		display: flex;
		flex-direction: column;
		gap: 24px;
		min-width: 0;
	}
	dl {
		display: grid;
		gap: 16px;
		margin: 0;
	}
	.row {
		display: flex;
		gap: 24px;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	dt {
		flex-shrink: 0;
		width: 96px;
		font-size: 14px;
		line-height: 20px;
		color: var(--ink-soft);
	}
	dd {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 16px;
		line-height: 24px;
		overflow-wrap: anywhere;
	}
	dd a {
		color: inherit;
		text-decoration-color: var(--line);
		text-underline-offset: 3px;
	}
	dd a:hover {
		text-decoration-color: currentColor;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		padding-top: 8px;
	}
	.map {
		position: relative;
		margin: 0;
		aspect-ratio: 560 / 420;
		border-radius: 12px;
		overflow: hidden;
		background: var(--paper-tint);
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.blocks rect {
		fill: var(--color-leaf-50);
	}
	:global([data-theme='dark']) .blocks rect {
		fill: var(--color-forest-800);
	}
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .blocks rect {
			fill: var(--color-forest-800);
		}
	}
	.roads path {
		fill: none;
		stroke: var(--paper);
		stroke-width: 14;
		stroke-linecap: round;
	}
	.ring {
		fill: var(--color-leaf-600);
	}
	.core {
		fill: none;
		stroke: #fff;
		stroke-width: 4;
	}
	.label {
		position: absolute;
		left: 54%;
		top: 40%;
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-width: calc(46% - 12px);
		padding: 12px 16px;
		border-radius: 12px;
		background: var(--card);
	}
	.name {
		font-size: 14px;
		line-height: 20px;
	}
	.area {
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 16px;
		letter-spacing: 0.6px;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	@media (max-width: 860px) {
		.visit {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 480px) {
		.label {
			left: 12px;
			top: auto;
			bottom: 12px;
			max-width: calc(100% - 24px);
		}
		.row {
			flex-direction: column;
			gap: 4px;
		}
	}
</style>
