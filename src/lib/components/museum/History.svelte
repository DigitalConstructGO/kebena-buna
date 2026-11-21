<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getTextDirection } from '#lib/paraglide/runtime.js';
	import type { HistoryContent, Localized } from '#lib/content/story.js';

	let {
		section,
		heading = 'h2'
	}: {
		section: Localized<HistoryContent>;
		/** h1 when the section is the whole page. */
		heading?: 'h1' | 'h2';
	} = $props();

	const content = $derived(section.content);
	const chapters = $derived(content.chapters);
	const total = $derived(chapters.length);
	const pad = (n: number) => String(n).padStart(2, '0');

	let root = $state<HTMLElement>();
	let active = $state(0);
	let broken = $state<Record<string, boolean>>({});
	let still = false;

	/** Jump to a chapter from the rail. */
	const go = (i: number) => {
		const el = root?.querySelector<HTMLElement>(`#chapter-${chapters[i]?.id}`);
		if (!el) return;
		el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
		el.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
	};

	onMount(() => {
		if (!root || !total) return;
		const { gsap, ScrollTrigger } = setupGsap();
		const scope = root;
		still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const ctx = gsap.context(() => {
			const q = gsap.utils.selector(scope);
			const frames = q('.frame') as HTMLElement[];

			const show = (i: number) => {
				if (i === active && frames[i]?.dataset.on) return;
				active = i;
				frames.forEach((f, k) => {
					const on = k === i;
					f.dataset.on = on ? '1' : '';
					gsap.to(f, {
						autoAlpha: on ? 1 : 0,
						duration: still ? 0 : 0.9,
						ease: 'power2.out',
						overwrite: 'auto'
					});
					// a slow push-in on the picture that just arrived
					if (on && !still)
						gsap.fromTo(
							f.querySelector('img'),
							{ scale: 1.1 },
							{ scale: 1, duration: 7, ease: 'power1.out' }
						);
				});
			};
			gsap.set(frames, { autoAlpha: 0 });
			show(0);

			(q('.chapter') as HTMLElement[]).forEach((el, i) => {
				ScrollTrigger.create({
					trigger: el,
					start: 'top 55%',
					end: 'bottom 55%',
					onToggle: (self) => self.isActive && show(i)
				});
				if (!still) {
					gsap.from(el.querySelectorAll('.reveal'), {
						autoAlpha: 0,
						y: 28,
						duration: 0.9,
						ease: 'power3.out',
						stagger: 0.08,
						scrollTrigger: { trigger: el, start: 'top 78%', once: true }
					});
				}
			});

			if (!still) {
				gsap.from(q('.head > *'), {
					autoAlpha: 0,
					y: 24,
					duration: 0.8,
					ease: 'power3.out',
					stagger: 0.08,
					scrollTrigger: { trigger: scope, start: 'top 75%', once: true }
				});
			}
		}, scope);

		return () => ctx.revert();
	});
</script>

{#if total}
	<section
		class="history"
		id="history"
		bind:this={root}
		aria-labelledby="history-title"
		lang={section.lang}
		dir={getTextDirection(section.lang)}
	>
		<header class="head">
			<p class="eyebrow">{content.eyebrow}</p>
			<svelte:element this={heading} id="history-title" class="title">
				{content.title}
			</svelte:element>
			<p class="hint" aria-hidden="true">
				<svg viewBox="0 0 20 20" width="16" height="16"><path d="M10 4v12m-5-5 5 5 5-5" /></svg>
				{m.story_scroll()}
			</p>
		</header>

		<div class="story">
			<div class="visual">
				<div class="frames" aria-hidden="true">
					{#each chapters as c, i (c.id)}
						<figure class="frame" style:opacity={i === 0 ? 1 : 0}>
							{#if broken[c.id]}
								<div class="missing"></div>
							{:else}
								<img
									src={c.image.src}
									alt=""
									loading={i < 2 ? 'eager' : 'lazy'}
									decoding="async"
									onerror={() => (broken[c.id] = true)}
								/>
							{/if}
							{#if c.image.illustration}<span class="chip">{m.story_illustration()}</span>{/if}
						</figure>
					{/each}
				</div>

				{#if total > 1}
					<nav class="rail" aria-label={m.story_chapters()}>
						<p class="now" aria-live="polite">
							<span class="num">{pad(active + 1)} / {pad(total)}</span>
							<span class="now-title">{chapters[active].title}</span>
						</p>
						<ol>
							{#each chapters as c, i (c.id)}
								<li>
									<button
										type="button"
										class={['tick', { on: i === active, past: i < active }]}
										aria-label={`${m.story_chapter()} ${i + 1}: ${c.title}`}
										aria-current={i === active ? 'step' : undefined}
										onclick={() => go(i)}
									></button>
								</li>
							{/each}
						</ol>
					</nav>
				{/if}
			</div>

			<div class="chapters">
				{#each chapters as c, i (c.id)}
					<article
						class={['chapter', { on: i === active }]}
						id={`chapter-${c.id}`}
						aria-labelledby={`chapter-${c.id}-title`}
					>
						<p class="meta reveal">
							<span class="index">{pad(i + 1)}</span>
							{#if c.tradition}
								<span class="tradition">
									<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
										<path d="M3 4.5h10M3 8h7M3 11.5h5" />
									</svg>
									{m.story_oral_tradition()}
								</span>
							{/if}
						</p>
						<h3 class="reveal" id={`chapter-${c.id}-title`} tabindex="-1">{c.title}</h3>
						{#each c.body as p, k (k)}
							<p class="text reveal">{p}</p>
						{/each}
						<!-- on phones the picture sits with its chapter -->
						{#if !broken[c.id]}
							<img
								class="inline-img"
								src={c.image.src}
								alt={c.image.alt}
								loading="lazy"
								decoding="async"
							/>
						{/if}
					</article>
				{/each}
			</div>
		</div>
	</section>
{/if}

<style>
	.history {
		position: relative;
		background: var(--paper);
		color: var(--ink-strong);
		padding: 112px max(24px, calc((100% - 1200px) / 2)) 64px;
	}

	.head {
		max-width: 880px;
		margin-bottom: 48px;
	}
	.eyebrow {
		margin: 0 0 12px;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent-mark);
	}
	:global([lang='am']) .eyebrow,
	:global([lang='ar']) .eyebrow {
		font-family: var(--font-sans);
		font-size: 14px;
	}
	.title {
		margin: 0;
		font-size: clamp(2rem, 3.4vw, 3.25rem);
		line-height: 1.12;
		font-weight: 400;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.hint {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 20px 0 0;
		font-size: 14px;
		color: var(--ink-soft);
	}
	.hint path,
	.tradition path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.story {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
		gap: 64px;
		align-items: start;
	}

	/* the picture stays while the chapters scroll past it */
	.visual {
		position: sticky;
		top: 0;
		height: 100svh;
		max-height: 900px;
		padding-block: 88px 32px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 16px;
	}
	.frames {
		position: relative;
		width: 100%;
		aspect-ratio: 5 / 4;
		max-height: calc(100% - 64px);
		border-radius: 20px;
		overflow: hidden;
		background: var(--paper-tint);
	}
	.frame {
		position: absolute;
		inset: 0;
		margin: 0;
	}
	.frame img,
	.missing {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.missing {
		background: var(--well);
	}
	.chip {
		position: absolute;
		inset-block-start: 14px;
		inset-inline-start: 14px;
		padding: 5px 10px;
		border-radius: 8px;
		font-size: 12px;
		background: rgb(8 23 14 / 0.62);
		color: rgb(246 249 246 / 0.86);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.rail {
		display: grid;
		gap: 10px;
	}
	.now {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin: 0;
		min-width: 0;
		font-size: 14px;
	}
	.num {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--accent-mark);
	}
	.now-title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--ink);
	}
	.rail ol {
		display: flex;
		gap: 6px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rail li {
		flex: 1;
	}
	.tick {
		display: block;
		width: 100%;
		height: 24px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		position: relative;
	}
	.tick::after {
		content: '';
		position: absolute;
		inset: 10px 0;
		border-radius: 2px;
		background: var(--track);
		transition: background-color 0.3s;
	}
	.tick.past::after {
		background: color-mix(in srgb, var(--accent-mark) 45%, transparent);
	}
	.tick.on::after {
		background: var(--accent-mark);
	}
	.tick:hover::after {
		background: color-mix(in srgb, var(--ink) 40%, transparent);
	}
	.tick:focus-visible {
		outline: 2px solid var(--accent-mark);
		outline-offset: 2px;
		border-radius: 4px;
	}

	.chapters {
		padding-block: 18svh 30svh;
	}
	.chapter {
		min-height: 78svh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding-block: 40px;
		opacity: 0.38;
		transition: opacity 0.6s;
	}
	.chapter.on {
		opacity: 1;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0 0 14px;
	}
	.index {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent-mark);
	}
	.tradition {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 8px;
		font-size: 12px;
		background: var(--accent-wash);
		color: var(--accent-mark);
	}
	h3 {
		margin: 0 0 18px;
		font-size: clamp(1.6rem, 2.3vw, 2.15rem);
		line-height: 1.18;
		font-weight: 400;
		letter-spacing: -0.015em;
		text-wrap: balance;
		outline: none;
	}
	.text {
		margin: 0 0 14px;
		max-width: 60ch;
		font-size: 17px;
		line-height: 1.65;
		color: var(--ink);
		text-wrap: pretty;
	}
	.inline-img {
		display: none;
	}

	@media (max-width: 900px) {
		.history {
			padding-top: 88px;
		}
		.story {
			grid-template-columns: 1fr;
			gap: 0;
		}
		/* the shared picture would cover half the phone; each chapter shows its own */
		.visual {
			display: none;
		}
		.chapters {
			padding-block: 0;
		}
		.chapter {
			min-height: 0;
			opacity: 1;
			padding-block: 28px;
			border-top: 1px solid var(--line);
		}
		.inline-img {
			display: block;
			order: -1;
			width: 100%;
			aspect-ratio: 3 / 2;
			object-fit: cover;
			border-radius: 16px;
			margin-bottom: 20px;
			background: var(--paper-tint);
		}
		.text {
			font-size: 16px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chapter {
			transition: none;
		}
	}
</style>
