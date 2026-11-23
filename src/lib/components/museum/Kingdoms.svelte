<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, getTextDirection } from '#lib/paraglide/runtime.js';
	import type { Kingdom, KingdomsContent, Localized, Ruler } from '#lib/content/story.js';
	import EthiopiaMap from './EthiopiaMap.svelte';

	let {
		section,
		heading = 'h2'
	}: {
		section: Localized<KingdomsContent>;
		/** h1 when the section is the whole page. */
		heading?: 'h1' | 'h2';
	} = $props();

	const content = $derived(section.content);
	// one level under the section title, so the outline never skips (h1 → h2 → h3)
	const sub = $derived(heading === 'h1' ? 'h2' : 'h3');
	const subsub = $derived(heading === 'h1' ? 'h3' : 'h4');
	const kingdoms = $derived(content.kingdoms);
	const total = $derived(kingdoms.length);
	const locale = getLocale();
	const pad = (n: number) => String(n).padStart(2, '0');
	/** "c." in the language of the text around it, so mixed scripts never flip the years. */
	const approx = () => m.story_approx({}, { locale: section.lang });

	/** Kingdoms the map can place; the rest only appear in the chapters. */
	const MAPPED = ['limmu', 'gumma', 'gomma', 'jimma', 'gera'];
	const onMap = $derived(kingdoms.filter((k) => MAPPED.includes(k.id)));
	/** The map opens on the whole country and closes in on the Gibe once the chapters begin. */
	let zoomed = $state(false);

	let active = $state(0);
	const current = $derived(kingdoms[active] ?? kingdoms[0]);

	/** The kingdom's name in the visitor's language, when the sources give one. */
	const native = (k: Kingdom) => (locale !== 'en' ? k.names[locale] : undefined);
	const label = (k: Kingdom) => native(k) ?? k.name;

	const years = (r: Pick<Ruler, 'from' | 'to' | 'approx'>) => {
		const c = r.approx ? `${approx()} ` : '';
		if (r.from && r.to) return `${c}${r.from}–${r.to}`;
		if (r.from) return `${c}${r.from}–`;
		if (r.to) return `–${c}${r.to}`;
		return '';
	};

	/* shared timeline: the span of dates each kingdom's text names */
	const T0 = 1740;
	const T1 = 1940;
	const TICKS = [1750, 1800, 1850, 1900];
	const span = (k: Kingdom) => {
		const ds = k.rulers.flatMap((r) => [r.from, r.to]).filter((d): d is number => !!d);
		const from = k.founded ?? (ds.length ? Math.min(...ds) : undefined);
		const to = k.ended ?? (ds.length ? Math.max(...ds) : undefined);
		if (!from || !to) return null;
		return { from, to, openStart: !k.founded, openEnd: !k.ended };
	};
	const pct = (y: number) => ((y - T0) / (T1 - T0)) * 100;

	let root = $state<HTMLElement>();
	let still = false;

	/** Scroll to a kingdom's chapter, from the map, the rail or the timeline. */
	const go = (id: string) => {
		const el = root?.querySelector<HTMLElement>(`#kingdom-${id}`);
		if (!el) return;
		el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
		el.querySelector<HTMLElement>('.k-name')?.focus({ preventScroll: true });
	};

	onMount(() => {
		if (!root || !total) return;
		const { gsap, ScrollTrigger } = setupGsap();
		const scope = root;
		still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const ctx = gsap.context(() => {
			const q = gsap.utils.selector(scope);

			(q('.chapter') as HTMLElement[]).forEach((el, i) => {
				ScrollTrigger.create({
					trigger: el,
					start: 'top 55%',
					end: 'bottom 55%',
					onToggle: (self) => {
						if (self.isActive) active = i;
					}
				});
				if (!still) {
					gsap.from(el.querySelectorAll('.reveal'), {
						autoAlpha: 0,
						y: 28,
						duration: 0.9,
						ease: 'power3.out',
						stagger: 0.07,
						scrollTrigger: { trigger: el, start: 'top 78%', once: true }
					});
				}
			});

			ScrollTrigger.create({
				trigger: q('.chapter')[0],
				start: 'top 70%',
				onEnter: () => (zoomed = true),
				onLeaveBack: () => (zoomed = false)
			});

			if (still) return;
			gsap.from(q('.head > *'), {
				autoAlpha: 0,
				y: 24,
				duration: 0.8,
				ease: 'power3.out',
				stagger: 0.08
			});
			gsap.from(q('.bar'), {
				scaleX: 0,
				transformOrigin: getTextDirection(section.lang) === 'rtl' ? '100% 50%' : '0% 50%',
				duration: 1.1,
				ease: 'power3.out',
				stagger: 0.08,
				scrollTrigger: { trigger: q('.timeline')[0], start: 'top 85%', once: true }
			});
		}, scope);
		return () => ctx.revert();
	});
</script>

{#if total && current}
	<section
		class="kingdoms"
		id="kingdoms"
		bind:this={root}
		aria-labelledby="kingdoms-title"
		lang={section.lang}
		dir={getTextDirection(section.lang)}
	>
		<header class="head">
			<p class="eyebrow">{content.eyebrow}</p>
			<svelte:element this={heading} id="kingdoms-title" class="title">
				{content.title}
			</svelte:element>
			{#if content.intro}<p class="intro">{content.intro}</p>{/if}
			<p class="hint" aria-hidden="true">
				<svg viewBox="0 0 20 20" width="16" height="16"><path d="M10 4v12m-5-5 5 5 5-5" /></svg>
				{m.story_scroll()}
			</p>
		</header>

		<div class="story">
			<!-- the map stays while the kingdoms scroll past it, lighting up the one you are reading -->
			<div class="visual">
				{#if onMap.length}
					<figure class="map">
						<EthiopiaMap
							kingdoms={onMap}
							currentId={current.id}
							bind:zoomed
							nameOf={label}
							onpick={go}
						/>
						<figcaption>{m.story_map_note()}</figcaption>
					</figure>
				{/if}

				{#if total > 1}
					<nav class="rail" aria-label={m.story_choose_kingdom()}>
						<p class="now" aria-live="polite">
							<span class="num">{pad(active + 1)} / {pad(total)}</span>
							<span class="now-title">{native(current) ?? current.name}</span>
						</p>
						<ol>
							{#each kingdoms as k, i (k.id)}
								<li>
									<button
										type="button"
										class={['tick', { on: i === active, past: i < active }]}
										aria-label={k.name}
										aria-current={i === active ? 'step' : undefined}
										onclick={() => go(k.id)}
									></button>
								</li>
							{/each}
						</ol>
					</nav>
				{/if}
			</div>

			<div class="chapters">
				{#if onMap.length}<p class="lead-in">{m.story_map_lead()}</p>{/if}
				{#each kingdoms as k, i (k.id)}
					<article
						class={['chapter', { on: i === active }]}
						id={`kingdom-${k.id}`}
						aria-labelledby={`kingdom-${k.id}-name`}
					>
						<p class="meta reveal">
							<span class="index">{pad(i + 1)}</span>
							{#if span(k)}
								{@const s = span(k)!}
								<span class="dates">{s.openStart ? approx() + ' ' : ''}{s.from}–{s.to}</span>
							{/if}
						</p>
						<svelte:element
							this={sub}
							class="k-name reveal"
							id={`kingdom-${k.id}-name`}
							tabindex="-1"
						>
							{k.name}
							{#if native(k)}<span class="native" lang={locale}>{native(k)}</span>{/if}
						</svelte:element>

						<p class="summary reveal">{k.summary}</p>

						{#if k.capital || k.borders.length}
							<dl class="facts reveal">
								{#if k.capital}
									<div>
										<dt>{m.story_capital()}</dt>
										<dd>{k.capital}</dd>
									</div>
								{/if}
								{#if k.borders.length}
									<div>
										<dt>{m.story_borders()}</dt>
										<dd>
											<ul class="borders">
												{#each k.borders as b (b.dir + b.to)}
													<li><span class="dir">{b.dir.toUpperCase()}</span>{b.to}</li>
												{/each}
											</ul>
										</dd>
									</div>
								{/if}
							</dl>
						{/if}

						{#if k.rulers.length}
							<svelte:element this={subsub} class="rulers-title reveal">
								{m.story_kings()}
							</svelte:element>
							<ol class="rulers reveal">
								{#each k.rulers as r (r.name + (r.from ?? ''))}
									<li>
										<span class="yr">{years(r)}</span>
										<span class="who">
											<span class="name">
												{r.name}{#if r.alias}<span class="alias">&nbsp;· {r.alias}</span>{/if}
											</span>
											{#if r.note}<span class="note">{r.note}</span>{/if}
										</span>
									</li>
								{/each}
							</ol>
						{/if}

						{#if k.body.length}
							<details class="more reveal">
								<summary>
									<span class="open-label">{m.story_read_more()}</span>
									<span class="close-label">{m.story_read_less()}</span>
								</summary>
								{#each k.body as p, n (n)}<p>{p}</p>{/each}
							</details>
						{/if}
					</article>
				{/each}
			</div>
		</div>

		{#if kingdoms.some((k) => span(k))}
			<div class="timeline">
				<p class="tl-title">{m.story_timeline()}</p>
				<div class="tl-grid">
					<div class="axis" aria-hidden="true">
						{#each TICKS as y (y)}
							<span style:inset-inline-start={`${pct(y)}%`}>{y}</span>
						{/each}
					</div>
					{#each kingdoms as k (k.id)}
						{@const s = span(k)}
						<button
							type="button"
							class={['row', { on: k.id === current.id }]}
							onclick={() => go(k.id)}
							aria-label={`${k.name}${s ? `, ${s.openStart ? approx() + ' ' : ''}${s.from}–${s.to}` : ''}`}
						>
							<span class="row-name">{native(k) ?? k.name}</span>
							<span class="track">
								{#each TICKS as y (y)}<span
										class="grid-line"
										style:inset-inline-start={`${pct(y)}%`}
									></span>{/each}
								{#if s}
									<span
										class={['bar', { 'open-start': s.openStart, 'open-end': s.openEnd }]}
										style:inset-inline-start={`${pct(s.from)}%`}
										style:width={`${Math.max(pct(s.to) - pct(s.from), 0.8)}%`}
									></span>
									<!-- the label sits after the bar; a long bar carries it inside -->
									{@const inside = pct(s.to) - pct(s.from) > 40}
									<span
										class={['bar-years', { inside }]}
										style:inset-inline-start={inside
											? `calc(${pct(s.from)}% + 10px)`
											: `calc(${pct(s.to)}% + 8px)`}
									>
										{s.openStart ? approx() + ' ' : ''}{s.from}–{s.to}
									</span>
								{/if}
							</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</section>
{/if}

<style>
	.kingdoms {
		position: relative;
		background: var(--paper);
		color: var(--ink-strong);
		padding: 112px max(24px, calc((100% - 1200px) / 2)) 96px;
	}
	.head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 420px);
		column-gap: 56px;
		align-items: end;
		margin-bottom: 24px;
	}
	.eyebrow {
		grid-column: 1;
		margin: 0 0 12px;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent-mark);
	}
	.title {
		grid-column: 1;
		margin: 0;
		font-size: clamp(2rem, 3.4vw, 3.25rem);
		line-height: 1.12;
		font-weight: 400;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.intro {
		grid-column: 2;
		grid-row: 1 / span 2;
		margin: 0;
		font-size: 16px;
		line-height: 1.55;
		color: var(--ink);
		text-wrap: pretty;
	}
	.hint {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 24px 0 0;
		font-size: 14px;
		color: var(--ink-soft);
	}
	.hint path {
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

	/* the map stays while the chapters scroll */
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
	.map {
		margin: 0;
		padding: 20px;
		border-radius: 20px;
		background: var(--paper-tint);
		min-height: 0;
	}
	.map :global(.emap) {
		width: min(100%, calc((100svh - 260px) * 991 / 772));
		margin-inline: auto;
	}
	figcaption {
		margin-top: 8px;
		font-size: 12px;
		color: var(--ink-soft);
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
	.num,
	.index,
	.dates {
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
	.tick:focus-visible,
	.row:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--accent-mark);
		outline-offset: 2px;
		border-radius: 4px;
	}

	.chapters {
		padding-block: 0 24svh;
	}
	/* while this is on screen the map shows the whole country; the first kingdom zooms it in */
	.lead-in {
		min-height: 80svh;
		display: flex;
		align-items: center;
		margin: 0;
		max-width: 34ch;
		font-size: 20px;
		line-height: 1.5;
		color: var(--ink);
		text-wrap: pretty;
	}
	.chapter {
		min-height: 88svh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding-block: 48px;
		scroll-margin-top: 24px;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 14px;
		margin: 0 0 14px;
	}
	.dates {
		color: var(--ink-soft);
	}
	.k-name {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 14px;
		margin: 0 0 16px;
		font-size: clamp(1.75rem, 2.6vw, 2.4rem);
		line-height: 1.15;
		font-weight: 400;
		letter-spacing: -0.015em;
		outline: none;
	}
	.native {
		font-size: 0.6em;
		color: var(--accent-mark);
		letter-spacing: 0;
	}
	.summary {
		margin: 0 0 20px;
		font-size: 17px;
		line-height: 1.6;
		color: var(--ink);
		text-wrap: pretty;
	}
	.facts {
		display: grid;
		gap: 10px;
		margin: 0 0 20px;
		padding: 16px;
		border-radius: 14px;
		background: var(--paper-soft);
	}
	.facts > div {
		display: grid;
		grid-template-columns: 96px minmax(0, 1fr);
		gap: 12px;
	}
	dt {
		font-size: 13px;
		color: var(--ink-soft);
	}
	dd {
		margin: 0;
		font-size: 14px;
		min-width: 0;
	}
	.borders {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 4px;
	}
	.borders li {
		display: flex;
		gap: 10px;
	}
	.dir {
		flex-shrink: 0;
		width: 24px;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.65;
		color: var(--accent-mark);
	}
	.rulers-title {
		margin: 0 0 10px;
		font-size: 13px;
		font-weight: 400;
		color: var(--ink-soft);
	}
	.rulers {
		list-style: none;
		margin: 0 0 20px;
		padding: 0;
		border-inline-start: 1px solid var(--accent-line);
	}
	.rulers li {
		position: relative;
		display: grid;
		grid-template-columns: 104px minmax(0, 1fr);
		gap: 12px;
		padding-block: 8px;
		padding-inline: 18px 0;
	}
	.rulers li::before {
		content: '';
		position: absolute;
		inset-inline-start: -4px;
		top: 15px;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent-mark);
	}
	.yr {
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.9;
		font-variant-numeric: tabular-nums;
		color: var(--ink-soft);
	}
	.who {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.name {
		font-size: 15px;
	}
	.alias {
		color: var(--ink-soft);
	}
	.note {
		font-size: 14px;
		line-height: 1.45;
		color: var(--ink-soft);
	}
	.more summary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		font-size: 14px;
		cursor: pointer;
		list-style: none;
	}
	.more summary::-webkit-details-marker {
		display: none;
	}
	.more summary:hover {
		background: color-mix(in srgb, var(--ink) 14%, transparent);
	}
	.close-label,
	.more[open] .open-label {
		display: none;
	}
	.more[open] .close-label {
		display: inline;
	}
	.more p {
		margin: 16px 0 0;
		font-size: 16px;
		line-height: 1.65;
		color: var(--ink);
		max-width: 62ch;
		text-wrap: pretty;
	}

	/* shared timeline */
	.timeline {
		margin-top: 48px;
		padding: 24px;
		border-radius: 20px;
		background: var(--paper-tint);
	}
	.tl-title {
		margin: 0 0 16px;
		font-size: 13px;
		color: var(--ink-soft);
	}
	.tl-grid {
		--name: 150px;
		display: grid;
		gap: 4px;
	}
	.axis {
		position: relative;
		height: 20px;
		margin-inline-start: var(--name);
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-soft);
	}
	.axis span {
		position: absolute;
		translate: -50% 0;
	}
	.row {
		display: grid;
		grid-template-columns: var(--name) minmax(0, 1fr);
		align-items: center;
		padding: 0;
		border: 0;
		border-radius: 10px;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
		height: 36px;
	}
	.row:hover {
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.row-name {
		padding-inline-start: 10px;
		font-size: 14px;
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row.on .row-name {
		color: var(--ink-strong);
	}
	.track {
		position: relative;
		height: 100%;
	}
	.grid-line {
		position: absolute;
		top: 4px;
		bottom: 4px;
		width: 1px;
		background: var(--line);
	}
	.bar {
		position: absolute;
		top: 12px;
		height: 12px;
		border-radius: 3px;
		background: var(--accent-bar);
	}
	.bar.open-start {
		border-start-start-radius: 0;
		border-end-start-radius: 0;
		border-inline-start: 2px dashed var(--accent-ink);
	}
	.bar.open-end {
		border-start-end-radius: 0;
		border-end-end-radius: 0;
		border-inline-end: 2px dashed var(--accent-ink);
	}
	.row.on .bar {
		background: var(--accent-mark);
	}
	.bar-years {
		position: absolute;
		top: 9px;
		font-family: var(--font-mono);
		font-size: 12px;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		color: var(--ink-soft);
	}
	.bar-years.inside {
		top: 12px;
		font-size: 11px;
		line-height: 12px;
		color: var(--ink);
		pointer-events: none;
	}
	.row.on .bar-years.inside {
		color: var(--paper);
	}

	@media (max-width: 900px) {
		.kingdoms {
			padding-top: 88px;
		}
		.head {
			grid-template-columns: 1fr;
		}
		.intro {
			grid-column: 1;
			grid-row: auto;
			margin-top: 16px;
		}
		.story {
			grid-template-columns: 1fr;
			gap: 0;
		}
		/* on phones the map rides along at the top while the kingdoms scroll under it */
		.visual {
			z-index: 2;
			height: auto;
			max-height: none;
			padding-block: 8px 12px;
			margin-inline: -24px;
			padding-inline: 24px;
			background: var(--paper);
			gap: 8px;
		}
		.map {
			padding: 8px;
		}
		/* keep the riding map short so the text has room */
		.map :global(.emap) {
			width: min(100%, calc(30svh * 991 / 772));
			margin-inline: auto;
		}
		figcaption {
			display: none;
		}
		.chapters {
			padding-block: 8px 0;
		}
		.lead-in {
			min-height: 36svh;
			font-size: 17px;
		}
		.chapter {
			min-height: 0;
			opacity: 1;
			padding-block: 32px;
			border-top: 1px solid var(--line);
			scroll-margin-top: 44svh;
		}
		.timeline {
			padding: 16px;
		}
		.tl-grid {
			--name: 96px;
		}
		.bar-years:not(.inside) {
			display: none;
		}
	}
	/* a phone turned sideways: there is width but little height, so the map goes back beside the text */
	@media (max-width: 900px) and (min-width: 600px) and (orientation: landscape) and (max-height: 560px) {
		.story {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			gap: 32px;
		}
		.visual {
			height: 100svh;
			margin-inline: 0;
			padding: 12px 0;
			justify-content: center;
		}
		.map :global(.emap) {
			width: min(100%, calc((100svh - 120px) * 991 / 772));
		}
		.chapter {
			border-top: 0;
			scroll-margin-top: 16px;
		}
		.lead-in {
			min-height: 80svh;
		}
	}
	@media (max-width: 480px) {
		.rulers li {
			grid-template-columns: 1fr;
			gap: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.chapter {
			transition: none;
		}
	}
</style>
