<script lang="ts">
	import { onMount } from 'svelte';
	import { reveal } from '#lib/reveal.js';
	import type { ArchiveContent } from '#lib/content/museum.js';

	let { content }: { content: ArchiveContent } = $props();
	let root: HTMLElement;
	const dateFmt = new Intl.DateTimeFormat('en', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC'
	});

	onMount(() => reveal(root));
</script>

<section
	class="archive kb-section kb-art kb-art--rings-foot"
	id="archive"
	bind:this={root}
	aria-labelledby="archive-title"
>
	<header class="head">
		<p class="kb-eyebrow" data-reveal>{content.eyebrow}</p>
		<h2 class="kb-title" id="archive-title" data-reveal>{content.title}</h2>
	</header>
	{#if content.notes.length}
		<ul class="notes">
			{#each content.notes as n (n.id)}
				<li data-reveal>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- note links come from content -->
					<a class="note" href={n.href}>
						<time datetime={n.date}>{dateFmt.format(new Date(n.date))}</time>
						<h3>{n.title}</h3>
						<span class="more">{content.more} <span class="arrow" aria-hidden="true">→</span></span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.archive {
		display: flex;
		flex-direction: column;
		gap: 48px;
		background: var(--paper-tint);
		color: var(--ink);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.notes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
		gap: 24px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.notes li {
		display: flex;
	}
	.note {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 100%;
		padding: 24px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--card);
		backdrop-filter: var(--glass-fx);
		-webkit-backdrop-filter: var(--glass-fx);
		color: inherit;
		text-decoration: none;
		transition: border-color 0.25s;
	}
	.note:hover {
		border-color: var(--color-leaf-400);
	}
	.note:focus-visible {
		outline: 2px solid var(--accent-ink);
		outline-offset: 2px;
	}
	time {
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 16px;
		color: var(--ink-soft);
	}
	h3 {
		margin: 0 0 16px;
		font-size: 20px;
		line-height: 28px;
		font-weight: 400;
		overflow-wrap: anywhere;
	}
	.more {
		margin-top: auto;
		font-size: 14px;
		line-height: 20px;
		color: var(--accent-ink);
	}
	.arrow {
		display: inline-block;
		transition: translate 0.25s;
	}
	.note:hover .arrow {
		translate: 4px 0;
	}
	/* phones: one swipeable row instead of a long stack; the next card peeks in at the edge */
	@media (max-width: 599px) {
		.notes {
			grid-template-columns: none;
			grid-auto-flow: column;
			grid-auto-columns: calc(100% - 40px);
			gap: 12px;
			margin-inline: -24px;
			padding-inline: 24px;
			scroll-padding-inline: 24px;
			overflow-x: auto;
			scroll-snap-type: x mandatory;
			overscroll-behavior-x: contain;
			scrollbar-width: none;
		}
		.notes > li {
			scroll-snap-align: start;
		}
	}
</style>
