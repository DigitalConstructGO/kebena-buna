<script lang="ts">
	import { onMount } from 'svelte';
	import { reveal } from '#lib/reveal.js';
	import type { PeopleContent } from '#lib/content/museum.js';

	let { content }: { content: PeopleContent } = $props();
	let root: HTMLElement;
	const fmt = new Intl.NumberFormat('en');

	onMount(() =>
		reveal(root, ({ gsap }) => {
			// the numbers count up once, when the hall comes into view
			const els = gsap.utils.toArray<HTMLElement>('[data-to]', root);
			gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 70%', once: true } }).add(
				els.map((el) => {
					const n = { v: 0 };
					const to = Number(el.dataset.to);
					return gsap.to(n, {
						v: to,
						duration: 0.8 + Math.min(1.2, Math.log10(to + 1) * 0.3),
						ease: 'power2.out',
						onUpdate: () => {
							el.textContent = fmt.format(Math.round(n.v));
						}
					});
				}),
				0.2
			);
			gsap.fromTo(
				'.photo img',
				{ yPercent: -6 },
				{
					yPercent: 6,
					ease: 'none',
					scrollTrigger: { trigger: '.photo', start: 'top bottom', end: 'bottom top', scrub: true }
				}
			);
		})
	);
</script>

<section
	class="people kb-section kb-art kb-art--dots-side"
	id="people"
	bind:this={root}
	aria-labelledby="people-title"
>
	<div class="copy">
		<p class="kb-eyebrow" data-reveal>{content.eyebrow}</p>
		<h2 class="lead" id="people-title" data-reveal>
			<span class="big">
				<span data-to={content.lead.value}>{fmt.format(content.lead.value)}</span>{content.lead
					.suffix}
			</span>
			<span class="lead-text">{content.lead.text}</span>
		</h2>
		{#if content.stats.length}
			<ul class="stats" data-reveal>
				{#each content.stats as s (s.label)}
					<li>
						<p class="value"><span data-to={s.value}>{fmt.format(s.value)}</span>{s.suffix}</p>
						<p class="label">{s.label}</p>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="body" data-reveal>{content.body}</p>
	</div>
	<figure class="photo" data-reveal>
		<img
			src={content.photo.src}
			alt={content.photo.alt}
			width="520"
			height="560"
			loading="lazy"
			decoding="async"
		/>
	</figure>
</section>

<style>
	.people {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 520px);
		align-items: center;
		gap: clamp(40px, 5.6vw, 80px);
		background: var(--paper-tint);
		color: var(--ink);
	}
	.people :global(.kb-eyebrow) {
		color: var(--accent-mark);
	}
	.copy {
		display: flex;
		flex-direction: column;
		gap: 24px;
		min-width: 0;
	}
	.lead {
		display: flex;
		flex-direction: column;
		gap: 24px;
		margin: 0;
		font-weight: 400;
	}
	.big {
		font-size: clamp(44px, 4.6vw, 56px);
		line-height: 64px;
		letter-spacing: -1px;
		font-variant-numeric: tabular-nums;
	}
	.lead-text {
		font-size: 20px;
		line-height: 28px;
		text-wrap: pretty;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 32px;
		margin: 0;
		padding: 16px 0 0;
		list-style: none;
	}
	.value {
		margin: 0 0 4px;
		font-size: 28px;
		line-height: 36px;
		font-variant-numeric: tabular-nums;
	}
	.label {
		margin: 0;
		font-size: 14px;
		line-height: 20px;
		color: var(--ink-soft);
	}
	.body {
		margin: 0;
		font-size: 16px;
		line-height: 24px;
		color: var(--ink);
		text-wrap: pretty;
	}
	.photo {
		margin: 0;
		aspect-ratio: 520 / 560;
		border-radius: 12px;
		overflow: hidden;
		background: var(--well);
	}
	.photo img {
		display: block;
		width: 100%;
		height: 112%;
		margin-top: -6%;
		object-fit: cover;
	}
	@media (max-width: 860px) {
		.people {
			grid-template-columns: minmax(0, 1fr);
		}
		.photo {
			aspect-ratio: 4 / 3;
		}
	}
</style>
