<script lang="ts">
	import { onMount } from 'svelte';
	import { reveal } from '#lib/reveal.js';
	import type { CollectionContent } from '#lib/content/museum.js';

	let { content }: { content: CollectionContent } = $props();
	let root: HTMLElement;
	let broken = $state<Record<string, boolean>>({});

	onMount(() => reveal(root));
</script>

<section class="collection kb-section" id="collection" bind:this={root} aria-labelledby="collection-title">
	<header class="head">
		<div class="lead">
			<p class="kb-eyebrow" data-reveal>{content.eyebrow}</p>
			<h2 class="kb-title" id="collection-title" data-reveal>{content.title}</h2>
			{#if content.tags.length}
				<ul class="tags" data-reveal>
					{#each content.tags as t (t.label)}
						<li class={['tag', t.tone]}>{t.label}</li>
					{/each}
				</ul>
			{/if}
		</div>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- in-page anchor from content -->
		<a class="kb-btn primary" href={content.cta.href} data-reveal>{content.cta.label}</a>
	</header>

	{#if content.lots.length}
		<ul class="lots">
			{#each content.lots as lot, i (lot.id)}
				<li class="lot" data-reveal>
					<figure class="photo">
						{#if !broken[lot.id]}
							<img
								src={lot.photo.src}
								alt={lot.photo.alt}
								width="282"
								height="240"
								loading="lazy"
								decoding="async"
								onerror={() => (broken[lot.id] = true)}
							/>
						{/if}
					</figure>
					<div class="placard">
						<p class="exhibit">Exhibit 04.{i + 1}</p>
						<h3>{lot.title}</h3>
						<dl>
							{#each lot.specs as s (s.label)}
								<div>
									<dt>{s.label}</dt>
									<dd>{s.value}</dd>
								</div>
							{/each}
						</dl>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.collection {
		display: flex;
		flex-direction: column;
		gap: 48px;
		background: var(--paper);
		color: var(--ink);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px 80px;
	}
	.lead {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tag {
		padding: 4px 8px;
		border-radius: 8px;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 16px;
		letter-spacing: 0.6px;
		text-transform: uppercase;
		color: var(--color-forest-900);
	}
	.tag.leaf {
		background: var(--color-leaf-600);
		color: #fff;
	}
	.tag.sage {
		background: var(--color-leaf-400);
	}
	.tag.lime {
		background: var(--color-lime-400);
	}
	.lots {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
		gap: 24px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.lot {
		display: flex;
		flex-direction: column;
		min-width: 0;
		border: 1px solid var(--line);
		border-radius: 12px;
		overflow: hidden;
		background: var(--card);
		transition: border-color 0.25s;
	}
	.lot:hover {
		border-color: var(--color-leaf-400);
	}
	.photo {
		margin: 0;
		height: 240px;
		overflow: hidden;
		background: var(--well);
	}
	.photo img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: scale 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.lot:hover .photo img {
		scale: 1.04;
	}
	.placard {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 20px;
	}
	.exhibit {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 16px;
		letter-spacing: 0.6px;
		text-transform: uppercase;
		color: var(--accent-ink);
	}
	h3 {
		margin: 0;
		font-size: 20px;
		line-height: 28px;
		font-weight: 400;
	}
	dl {
		display: grid;
		gap: 12px;
		margin: 0;
	}
	dl div {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		font-size: 14px;
		line-height: 20px;
	}
	dt {
		color: var(--ink-soft);
		flex-shrink: 0;
	}
	dd {
		margin: 0;
		font-family: var(--font-mono);
		text-align: end;
		min-width: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.photo img {
			transition: none;
		}
	}
</style>
