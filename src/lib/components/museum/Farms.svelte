<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { whenIdle } from '#lib/reveal.js';
	import ImageViewer from '@nahu/admin-kit/components/ImageViewer.svelte';
	import type { FarmsContent, Photo } from '#lib/content/museum.js';
	import { m } from '#lib/i18n.ts';

	let { content }: { content: FarmsContent } = $props();
	let root: HTMLElement;

	/** Photos per full turn, and the thin vertical slices each photo is cut into, so the band curves smoothly. */
	const PER_TURN = 10;
	const SLICES = 3;
	const TURN = 360 / PER_TURN;
	/** Extra photos wound on before and after, so the band runs off the top and bottom of the hall. */
	const LEAD = 5;
	const TAIL = 12;
	const pad = (n: number) => String(n).padStart(2, '0');
	/** Keeps a short unit on the same line as its number: "2,100 m" never leaves the "m" alone. */
	const tie = (v: string) => v.replace(/ (\S{1,3})$/, '\u00a0$1');

	/** Every photo of every part, in order. */
	const panels = $derived(
		content.farms.flatMap((farm, part) =>
			[farm.photo, ...(farm.gallery ?? [])].map((photo: Photo, k) => ({
				key: `${farm.id}-${k}`,
				photo,
				part
			}))
		)
	);
	/** The band: echo photos, the real ones (at 0..n-1), echoes; each cut into slices. `j` is the slice's place. */
	const slices = $derived.by(() => {
		const n = panels.length;
		if (!n) return [];
		const at = (k: number) => panels[((k % n) + n) % n];
		const out: { key: string; src: string; at: number; k: number; j: number }[] = [];
		for (let i = -LEAD; i < n + TAIL; i++) {
			const p = at(i);
			for (let k = 0; k < SLICES; k++)
				out.push({
					key: `${i}-${k}`,
					src: p.photo.src,
					at: ((i % n) + n) % n,
					k,
					j: i * SLICES + k + 0.5 - SLICES / 2
				});
		}
		return out;
	});
	/** Photos load only once the ribbon is set up; the fallback list never fetches them twice. */
	let near = $state(false);
	/** Below 900px the ring sits above a details panel and turns the lighter 440px photos. */
	let small = $state(false);
	/**
	 * A photo's smaller copy. Only the photos the design shipped with have them: one swapped in from
	 * the dashboard is used as it is.
	 */
	const sized = (src: string, w: 280 | 440) =>
		src.startsWith('/farms/') ? src.replace(/\.webp$/, `-${w}.webp`) : src;
	const ringSrc = (src: string) => (small ? sized(src, 440) : src);
	let tabs = $state<HTMLElement>();
	const starts = $derived(content.farms.map((_, part) => panels.findIndex((p) => p.part === part)));

	let active = $state(0);
	const current = $derived(content.farms[active]);
	let pinned: ScrollTrigger | undefined;

	/** Scroll so the part's first photo turns to the front. */
	const go = (part: number) => {
		const i = starts[part];
		if (!pinned || i < 0) {
			document
				.getElementById(`farm-${content.farms[part].id}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			return;
		}
		const y = pinned.start + (i / Math.max(1, panels.length - 1)) * (pinned.end - pinned.start);
		window.scrollTo({ top: y, behavior: 'smooth' });
	};

	onMount(() =>
		whenIdle(() => {
			const { gsap, ScrollTrigger } = setupGsap();
			const n = panels.length;
			if (n < 2) return;
			const mm = gsap.matchMedia();

			// the hall holds still while the ribbon turns and sinks past the viewer: on desktop between
			// the facts and the list, on tablets and phones above a panel describing the part in front
			mm.add(
				{
					ring: '(prefers-reduced-motion: no-preference)',
					narrow: '(max-width: 899px), (max-width: 999px) and (max-height: 560px)'
				},
				(ctx) => {
					const { ring, narrow } = ctx.conditions as { ring: boolean; narrow: boolean };
					if (!ring) {
						// short screens and reduced motion: the plain list, each part fading up as it arrives
						gsap.utils.toArray<HTMLElement>('.part', root).forEach((el) => {
							gsap.from(el, {
								autoAlpha: 0,
								y: 28,
								duration: 0.8,
								ease: 'power3.out',
								scrollTrigger: { trigger: el, start: 'top 88%', once: true }
							});
						});
						return;
					}
					const run = root.querySelector<HTMLElement>('.run')!;
					const stage = root.querySelector<HTMLElement>('.stage')!;
					const helix = root.querySelector<HTMLElement>('.helix')!;
					const cards = [...root.querySelectorAll<HTMLElement>('.slice')];
					const proxy = { a: 0 };
					small = narrow;
					near = true;
					/*
					 * The hall holds still on a runway of its own (sticky), not pinned by the script: a pin
					 * lifts the hall out of the page and drops it back as it ends, and that swap showed as a
					 * blank flash on the way down to the collection.
					 */
					// a thumb travels less than a wheel: phones turn a photo every quarter screen
					run.style.setProperty('--turns', String((narrow ? 0.24 : 0.32) * n));
					root.dataset.ring = '';

					const apply = () => {
						const a = proxy.a;
						helix.style.transform = `translateY(calc(${(-a * SLICES).toFixed(4)} * var(--drop))) rotateY(${(-a * TURN).toFixed(3)}deg)`;
						// the face of the band toward the viewer is bright; the inside, seen across the turn, is pale,
						// and photos fade as they come up from below and climb away past the top
						cards.forEach((el, i) => {
							const d = slices[i].j / SLICES - a;
							const face = Math.cos((d * TURN * Math.PI) / 180);
							const far = Math.min(1, Math.max(0, (Math.abs(d) - 2.5) / 8));
							const lit = 0.3 + 0.7 * Math.max(0, face) ** 1.2;
							el.style.opacity = (lit * (1 - 0.6 * far)).toFixed(3);
						});
						const part = panels[Math.min(n - 1, Math.round(a))].part;
						if (part !== active) active = part;
					};

					const tween = gsap.to(proxy, {
						a: n - 1,
						ease: 'none',
						onUpdate: apply,
						scrollTrigger: {
							trigger: run,
							start: 'top top',
							// as long as the hall holds still: on a short window the hall is taller than the
							// screen, and `bottom bottom` would keep turning after it had let go
							end: () => `+=${run.offsetHeight - stage.offsetHeight}`,
							scrub: 0.8
						}
					});
					pinned = tween.scrollTrigger;
					apply();
					// the hall just grew by its runway: everything measured below it has moved
					ScrollTrigger.refresh();

					return () => {
						pinned = undefined;
						delete root.dataset.ring;
						run.style.removeProperty('--turns');
						helix.style.transform = '';
						cards.forEach((el) => {
							el.style.opacity = '';
						});
					};
				}
			);
			return () => mm.revert();
		})
	);

	// keep the tab of the part in front in view as the ring turns
	$effect(() => {
		const on = tabs?.children[active] as HTMLElement | undefined;
		if (!tabs || !on) return;
		const t = tabs.getBoundingClientRect();
		const r = on.getBoundingClientRect();
		tabs.scrollTo({
			left: tabs.scrollLeft + r.left - t.left - (t.width - r.width) / 2,
			behavior: 'smooth'
		});
	});

	/** The phone strip shows each photo at most 260px wide; the full 520px file is for the desktop ring. */
	const stripSet = (src: string) =>
		src.startsWith('/farms/') ? `${sized(src, 280)} 280w, ${sized(src, 440)} 440w` : undefined;

	/** A photo pressed, on the band or a strip, opens its set large, starting on that one. */
	let shown = $state<{ title: string; photos: Photo[] }>({ title: '', photos: [] });
	let shownOpen = $state(false);
	let shownAt = $state(0);
	function show(title: string, photos: Photo[], at: number) {
		shown = { title, photos };
		shownAt = at;
		shownOpen = true;
	}
</script>

<section class="farms" id="farms" bind:this={root} aria-labelledby="farms-title">
	<header class="head">
		<p class="kb-eyebrow">{content.eyebrow}</p>
		<h2 class="kb-title" id="farms-title">{content.title}</h2>
		<p class="intro">{content.intro}</p>
	</header>
	<div class="run">
		<div class="stage">
			{#if panels.length}
				<!-- the turning ribbon: every photo of every part, wound round one cylinder -->
				<div class="ring-view" aria-hidden="true">
					<div class="tilt">
						<div class="helix">
							{#each slices as sl (sl.key)}
								<!-- pointer-only: the band is decorative, and the list below carries every photo -->
								<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
								<div
									class={['slice', { edge: sl.k === 0 }]}
									style:--j={sl.j}
									style:--k={sl.k}
									style:background-image={near
										? `url(${JSON.stringify(ringSrc(sl.src))})`
										: undefined}
									onclick={() =>
										show(
											content.title,
											panels.map((p) => ({
												src: p.photo.src,
												alt: `${content.farms[p.part].title}: ${p.photo.alt}`
											})),
											sl.at
										)}
								></div>
							{/each}
						</div>
					</div>
				</div>

				<!-- left: the details of the part in front, its number large beneath -->
				{#if current}
					<div class="facts">
						{#key active}
							<dl class="meta">
								{#each current.meta as item (item.label)}
									<div>
										<dt>{item.label}</dt>
										<dd>{item.value}</dd>
									</div>
								{/each}
							</dl>
						{/key}
					</div>
					<p class="count" aria-hidden="true">
						<span class="small">{current.kind ?? m.home_farms_kind_estate()}</span>
						<span class="big">{pad(active + 1)}</span><span class="of">
							/{pad(content.farms.length)}
						</span>
					</p>
				{/if}

				<!-- right: every part, the one in front named large -->
				<ol class="list">
					{#each content.farms as farm, i (farm.id)}
						<li class={{ on: i === active }}>
							<button
								type="button"
								aria-current={i === active ? 'true' : undefined}
								onclick={() => go(i)}
							>
								<span class="kind">{farm.kind ?? m.home_farms_kind_estate()}</span>
								<span class="name">{farm.title}</span>
								<span class="rule" aria-hidden="true"></span>
								<span class="text">{farm.text}</span>
							</button>
						</li>
					{/each}
				</ol>

				<!-- tablets and phones: the part in front, under the ring -->
				{#if current}
					<div class="now">
						<div class="tabs" bind:this={tabs}>
							{#each content.farms as farm, i (farm.id)}
								<button
									type="button"
									class={{ on: i === active }}
									aria-current={i === active ? 'true' : undefined}
									onclick={() => go(i)}
								>
									{farm.title}
								</button>
							{/each}
						</div>
						<!-- every part is laid in the same cell, so the panel keeps the height of the longest and the ring never resizes -->
						<div class="bodies">
							{#each content.farms as farm, i (farm.id)}
								<div class={['now-body', { on: i === active }]} aria-hidden={i !== active}>
									<p class="now-kind">
										{pad(i + 1)} / {pad(content.farms.length)} · {farm.kind ??
											m.home_farms_kind_estate()}
									</p>
									<p class="now-name">{farm.title}</p>
									<p class="now-text">{farm.text}</p>
									{#if farm.meta.length}
										<dl class="now-meta">
											{#each farm.meta as item (item.label)}
												<div>
													<dt>{item.label}</dt>
													<dd>{tie(item.value)}</dd>
												</div>
											{/each}
										</dl>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- phones, short screens and reduced motion: each part with a strip of its photos -->
	{#if content.farms.length}
		<ol class="parts">
			{#each content.farms as farm, i (farm.id)}
				{@const photos = [farm.photo, ...(farm.gallery ?? [])]}
				<li class="part" id={`farm-${farm.id}`}>
					<div class="strip">
						{#each photos as photo, k (k)}
							<button
								type="button"
								class="zoom"
								aria-label={m.home_farms_view_photos({ title: farm.title })}
								onclick={() => show(farm.title, photos, k)}
							>
								<img
									src={sized(photo.src, 440)}
									srcset={stripSet(photo.src)}
									sizes="min(62vw, 260px)"
									alt={photo.alt}
									width="520"
									height="680"
									loading="lazy"
									decoding="async"
								/>
							</button>
						{/each}
					</div>
					<p class="kind">{pad(i + 1)} · {farm.kind ?? m.home_farms_kind_estate()}</p>
					<h3>{farm.title}</h3>
					<p class="text">{farm.text}</p>
					{#if farm.meta.length}
						<dl class="meta">
							{#each farm.meta as item (item.label)}
								<div>
									<dt>{item.label}</dt>
									<dd>{item.value}</dd>
								</div>
							{/each}
						</dl>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>

<ImageViewer
	bind:open={shownOpen}
	bind:index={shownAt}
	images={shown.photos.map((p) => p.src)}
	captions={shown.photos.map((p) => p.alt)}
	title={shown.title}
/>

<style>
	.farms {
		background: var(--paper-soft);
		color: var(--ink);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: clamp(72px, 9vw, 112px) max(24px, calc((100% - 1200px) / 2)) 0;
	}
	.head > :global(*) {
		max-width: 640px;
	}
	.intro {
		margin: 0;
		font-size: 17px;
		line-height: 1.6;
		color: var(--ink-soft);
	}
	/* behind the helix: a halo of fine rings (bookofshapes.com) that thins out toward the edges */
	.stage::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background: var(--accent-ink);
		opacity: 0.14;
		-webkit-mask:
			url('/art/truchet.svg') 50% 50% / 1100px auto repeat,
			radial-gradient(ellipse 42% 62% at 50% 52%, transparent 20%, #000 60%, transparent 100%);
		mask:
			url('/art/truchet.svg') 50% 50% / 1100px auto repeat,
			radial-gradient(ellipse 42% 62% at 50% 52%, transparent 20%, #000 60%, transparent 100%);
		-webkit-mask-composite: source-in;
		mask-composite: intersect;
	}
	/* while the ring turns: a runway as long as the turning takes, and the hall holds still on it */
	.farms:global([data-ring]) .run {
		/* the hall's own height (never under 680px) and a screen for every turn */
		height: calc(max(100svh, 680px) + 100svh * var(--turns, 0));
	}
	.farms:global([data-ring]) .stage {
		position: sticky;
		top: 0;
	}
	.stage {
		isolation: isolate;
		/* band geometry: cylinder diameter, slice width (30 slices round it), band height, drop per slice */
		--d: clamp(400px, 40vw, 800px);
		--sw: calc(var(--d) * 0.10472);
		--r: calc(var(--d) / 2);
		--bh: calc(var(--sw) * 4.9);
		--drop: calc(var(--bh) * 1.22 / 30);
		--side: max(40px, calc((100vw - 1560px) / 2));
		position: relative;
		display: grid;
		grid-template-columns: minmax(160px, 230px) minmax(0, 1fr) minmax(260px, 360px);
		column-gap: clamp(24px, 3vw, 56px);
		height: 100svh;
		min-height: 680px;
		padding: 72px var(--side) 40px;
		box-sizing: border-box;
		overflow: hidden;
	}
	/* the ribbon owns the left two thirds of the hall, full height; the list keeps the right */
	/* the band fills the hall's height in the middle column; the text keeps to either side */
	.ring-view {
		grid-column: 2;
		grid-row: 1;
		position: relative;
		/* a little wider than its column, softened at the sides, so the band's curve is never cut */
		margin: -72px -48px -40px;
		perspective: 1900px;
		perspective-origin: 50% 40%;
		/* photos fade in coming up from the bottom and out past the top */
		--fade-y: linear-gradient(transparent, #000 14%, #000 86%, transparent);
		--fade-x: linear-gradient(90deg, transparent, #000 48px, #000 calc(100% - 48px), transparent);
		mask-image: var(--fade-y), var(--fade-x);
		mask-composite: intersect;
		-webkit-mask-image: var(--fade-y), var(--fade-x);
		-webkit-mask-composite: source-in;
		pointer-events: none;
	}
	/* seen a touch from above and leaning, so the turns above and below show their curve */
	.tilt {
		position: absolute;
		inset: 0;
		transform-style: preserve-3d;
		transform: rotateX(-7deg) rotateZ(-4deg);
	}
	.helix {
		position: absolute;
		left: 50%;
		top: 50%;
		width: var(--sw);
		height: var(--bh);
		margin: calc(var(--bh) / -2) 0 0 calc(var(--sw) / -2);
		transform-style: preserve-3d;
		will-change: transform;
	}
	.slice {
		position: absolute;
		inset: 0 auto 0 0;
		/* a hair wider than the slice so neighbours overlap and no seam shows */
		width: calc(var(--sw) + 1px);
		background-color: var(--well);
		background-size: 300% auto;
		background-position: calc(var(--k) * 50%) 50%;
		transform: translateY(calc(var(--j) * var(--drop))) rotateY(calc(var(--j) * 12deg))
			translateZ(var(--r)) skewY(11.3deg);
		/* the skew is atan(drop / slice width), so each slice's top meets its neighbour's in one smooth edge */
	}
	/* the band itself lets presses through to the text beside it; only the photos take them */
	.slice {
		pointer-events: auto;
		cursor: zoom-in;
	}

	/* a thin paper gap where one photo ends and the next begins */
	.slice.edge {
		box-shadow: inset 3px 0 0 var(--paper-soft);
	}
	.facts {
		grid-column: 1;
		grid-row: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
	}
	.meta {
		display: grid;
		gap: 22px;
		margin: 0;
		animation: swap 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	@keyframes swap {
		from {
			opacity: 0;
			translate: 0 10px;
		}
	}
	.meta div {
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		gap: 14px;
		font-size: 15px;
		line-height: 1.4;
	}
	.meta dt {
		color: var(--ink-soft);
	}
	.meta dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.count {
		grid-column: 1;
		grid-row: 1;
		align-self: end;
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin: 0;
	}
	.count .small {
		margin-right: 8px;
		font-size: 12px;
		color: var(--ink-soft);
	}
	.count .big {
		font-size: clamp(56px, 6vw, 96px);
		font-weight: 600;
		line-height: 0.85;
		letter-spacing: -0.04em;
		font-variant-numeric: tabular-nums;
		color: color-mix(in srgb, var(--accent-ink) 40%, transparent);
	}
	.count .of {
		font-size: 14px;
		color: var(--ink-soft);
	}
	.list {
		grid-column: 3;
		grid-row: 1;
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 20px;
		margin: 0;
		padding: 0 8px;
		list-style: none;
		text-align: center;
	}
	.list button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		opacity: 0.32;
		transition: opacity 0.4s;
	}
	.list li.on button,
	.list button:hover {
		opacity: 1;
	}
	.list button:focus-visible {
		outline: 2px solid var(--accent-ink);
		outline-offset: 6px;
		border-radius: 8px;
	}
	.kind {
		font-size: 12px;
		color: var(--ink-soft);
	}
	.name {
		font-size: clamp(22px, 2vw, 28px);
		font-weight: 400;
		line-height: 1.1;
		letter-spacing: -0.02em;
		text-wrap: balance;
		overflow-wrap: anywhere;
	}
	.list li.on .name {
		font-size: clamp(30px, 3vw, 44px);
		font-weight: 600;
		color: var(--ink);
	}
	.rule {
		width: 20px;
		height: 1px;
		margin: 4px 0;
		background: currentColor;
		opacity: 0.4;
	}
	.list .text {
		display: none;
		max-width: 30ch;
		font-size: 14px;
		line-height: 1.5;
		color: var(--ink-soft);
	}
	.list li.on .text {
		display: block;
	}
	.parts,
	.now {
		display: none;
	}

	/* tablets and phones (and phones on their side): the ring fills the hall, the part in front is described beneath it */
	@media (max-width: 899px), (max-width: 999px) and (max-height: 560px) {
		.stage {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
			row-gap: 12px;
			min-height: 0;
			/* room at the foot for the floor-plan sign */
			padding: 16px 20px 92px;
		}
		/* the ring owns the space the panel leaves, and sizes itself to fit it whatever the screen */
		.ring-view {
			grid-column: 1;
			grid-row: 1;
			margin: -16px -20px 0;
			container-type: size;
			perspective: 1300px;
			perspective-origin: 50% 35%;
			--fade-y: linear-gradient(transparent, #000 12%, #000 86%, transparent);
		}
		.tilt {
			/* the band is about half the diameter tall and climbs 1.2 bands a turn: keep one turn and a bit in view */
			--d: max(180px, min(98cqw, 135cqh, 560px));
			--sw: calc(var(--d) * 0.10472);
			--r: calc(var(--d) / 2);
			--bh: calc(var(--sw) * 4.9);
			--drop: calc(var(--bh) * 1.22 / 30);
		}
		.facts,
		.count,
		.list {
			display: none;
		}
		/* the halo keeps to the ring: nothing is drawn behind the words below it */
		.stage::before {
			-webkit-mask:
				url('/art/truchet.svg') 50% 0 / 820px auto repeat,
				radial-gradient(ellipse 70% 32% at 50% 30%, transparent 20%, #000 60%, transparent 100%);
			mask:
				url('/art/truchet.svg') 50% 0 / 820px auto repeat,
				radial-gradient(ellipse 70% 32% at 50% 30%, transparent 20%, #000 60%, transparent 100%);
			-webkit-mask-composite: source-in;
			mask-composite: intersect;
		}
		.now {
			grid-column: 1;
			grid-row: 2;
			position: relative;
			z-index: 1;
			display: grid;
			gap: 14px;
			min-width: 0;
		}
		.tabs {
			display: flex;
			gap: 8px;
			margin: 0 -20px;
			padding: 0 20px;
			overflow-x: auto;
			scrollbar-width: none;
		}
		.tabs button {
			position: relative;
			flex: none;
			min-height: 44px;
			padding: 0 14px;
			border: 0;
			border-radius: 12px;
			background: var(--paper-tint);
			color: var(--ink-soft);
			font: inherit;
			font-size: 14px;
			white-space: nowrap;
			cursor: pointer;
			transition:
				background-color 0.3s,
				color 0.3s;
		}
		.tabs button.on {
			background: var(--accent-ink);
			color: var(--paper);
		}
		.tabs button:focus-visible {
			outline: 2px solid var(--accent-ink);
			outline-offset: 2px;
		}
		.bodies {
			display: grid;
		}
		.now-body {
			grid-area: 1 / 1;
			display: grid;
			align-content: start;
			gap: 6px;
			visibility: hidden;
			opacity: 0;
			translate: 0 10px;
			transition:
				opacity 0.4s,
				translate 0.5s cubic-bezier(0.2, 0.8, 0.2, 1),
				visibility 0s 0.4s;
		}
		.now-body.on {
			visibility: visible;
			opacity: 1;
			translate: 0 0;
			transition:
				opacity 0.4s 0.1s,
				translate 0.5s 0.1s cubic-bezier(0.2, 0.8, 0.2, 1);
		}
		.now-kind {
			margin: 0;
			font-family: var(--font-mono);
			font-size: 12px;
			color: var(--accent-ink);
		}
		.now-name {
			margin: 0;
			font-size: clamp(24px, 6vw, 32px);
			font-weight: 400;
			line-height: 1.15;
			letter-spacing: -0.02em;
			overflow-wrap: anywhere;
		}
		.now-text {
			margin: 0;
			max-width: 60ch;
			font-size: 15px;
			line-height: 1.5;
			color: var(--ink-soft);
		}
		.now-meta {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 12px;
			margin: 6px 0 0;
			padding-top: 12px;
			border-top: 1px solid var(--line);
		}
		.now-meta div {
			display: grid;
			gap: 2px;
			min-width: 0;
		}
		.now-meta dt {
			font-size: 12px;
			color: var(--ink-soft);
		}
		.now-meta dd {
			margin: 0;
			font-size: 14px;
			line-height: 1.35;
			overflow-wrap: anywhere;
		}
	}
	/* short phones: tighter type, and on the shortest the three facts give their room to the ring */
	@media (max-width: 899px) and (max-height: 700px) {
		.now {
			gap: 10px;
		}
		.tabs button {
			min-height: 38px;
			font-size: 13px;
		}
		.tabs button::after {
			content: '';
			position: absolute;
			inset: -3px 0;
		}
		.now-name {
			font-size: 22px;
		}
		.now-text {
			font-size: 14px;
			line-height: 1.45;
		}
	}
	@media (max-width: 899px) and (max-height: 620px) {
		.now-meta {
			display: none;
		}
	}
	@media (min-width: 600px) and (max-width: 899px) {
		.stage {
			padding-inline: 40px;
		}
		.ring-view {
			margin-inline: -40px;
		}
		.tabs {
			margin-inline: -40px;
			padding-inline: 40px;
		}
		.tilt {
			--d: max(180px, min(76cqw, 135cqh, 640px));
		}
	}

	/* phones on their side: the ring on the left, the part in front on the right */
	@media (max-width: 999px) and (max-height: 560px) and (orientation: landscape) {
		.stage {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr);
			column-gap: 24px;
			min-height: 0;
			padding: 16px max(24px, env(safe-area-inset-right)) 16px max(24px, env(safe-area-inset-left));
		}
		.ring-view {
			grid-column: 1;
			grid-row: 1;
			margin: -16px 0 -16px -24px;
		}
		.now {
			grid-column: 2;
			grid-row: 1;
			align-self: center;
			/* clear of the floor-plan sign at the foot */
			padding-bottom: 64px;
		}
		.tabs {
			margin: 0;
			padding: 0;
		}
		.now-meta {
			display: none;
		}
	}
	/* reduced motion: a plain list of parts, each with a photo strip */
	@media (prefers-reduced-motion: reduce) {
		.stage {
			display: none;
		}
		.head {
			padding-top: clamp(72px, 12vw, 96px);
		}
		.parts {
			display: grid;
			gap: 56px;
			margin: 0;
			padding: 40px max(24px, calc((100% - 1200px) / 2)) 88px;
			list-style: none;
		}
		.part {
			display: flex;
			flex-direction: column;
			gap: 10px;
			min-width: 0;
		}
		.strip {
			display: flex;
			gap: 10px;
			margin: 0 -24px 10px;
			padding: 0 24px;
			overflow-x: auto;
			scroll-snap-type: x mandatory;
			scrollbar-width: none;
		}
		.zoom {
			flex: none;
			padding: 0;
			border: 0;
			background: none;
			cursor: zoom-in;
			scroll-snap-align: start;
		}
		.zoom:focus-visible {
			outline: 2px solid var(--color-lime-400);
			outline-offset: 2px;
			border-radius: 12px;
		}
		.strip img {
			display: block;
			width: min(62vw, 260px);
			height: auto;
			aspect-ratio: 13 / 17;
			object-fit: cover;
			border-radius: 12px;
			background: var(--well);
		}
		.part .kind {
			margin: 0;
			font-family: var(--font-mono);
			color: var(--accent-ink);
		}
		.part h3 {
			margin: 0;
			font-size: 28px;
			font-weight: 400;
			line-height: 1.15;
			letter-spacing: -0.02em;
			overflow-wrap: anywhere;
		}
		.part .text {
			margin: 0;
			max-width: 65ch;
			font-size: 16px;
			line-height: 1.55;
			color: var(--ink-soft);
		}
		.part .meta {
			margin-top: 8px;
			padding-top: 14px;
			border-top: 1px solid var(--line);
			animation: none;
		}
	}
</style>
