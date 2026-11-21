<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { whenIdle } from '#lib/reveal.js';
	import type { FarmsContent, Photo } from '#lib/content/museum.js';

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
		const out: { key: string; src: string; k: number; j: number }[] = [];
		for (let i = -LEAD; i < n + TAIL; i++) {
			const p = at(i);
			for (let k = 0; k < SLICES; k++)
				out.push({ key: `${i}-${k}`, src: p.photo.src, k, j: i * SLICES + k + 0.5 - SLICES / 2 });
		}
		return out;
	});
	/** Photos load only once the desktop ribbon is set up; phones never fetch them twice. */
	let near = $state(false);
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
			const { gsap } = setupGsap();
			const n = panels.length;
			if (n < 2) return;
			const mm = gsap.matchMedia();

			// desktop: the hall holds still while the ribbon turns and sinks past the viewer
			mm.add(
				'(min-width: 900px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)',
				() => {
					const stage = root.querySelector<HTMLElement>('.stage')!;
					const helix = root.querySelector<HTMLElement>('.helix')!;
					const cards = [...root.querySelectorAll<HTMLElement>('.slice')];
					const proxy = { a: 0 };
					near = true;

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
							trigger: stage,
							start: 'top top',
							end: () => `+=${window.innerHeight * 0.32 * n}`,
							pin: true,
							scrub: 0.8,
							anticipatePin: 1
						}
					});
					pinned = tween.scrollTrigger;
					apply();

					return () => {
						pinned = undefined;
						helix.style.transform = '';
						cards.forEach((el) => {
							el.style.opacity = '';
						});
					};
				}
			);

			// phones and short screens: each part fades up as it arrives
			mm.add('(max-width: 899px), (max-height: 599px)', () => {
				gsap.utils.toArray<HTMLElement>('.part', root).forEach((el) => {
					gsap.from(el, {
						autoAlpha: 0,
						y: 28,
						duration: 0.8,
						ease: 'power3.out',
						scrollTrigger: { trigger: el, start: 'top 88%', once: true }
					});
				});
			});
			return () => mm.revert();
		})
	);

	/** The phone strip shows each photo at most 260px wide; the full 520px file is for the desktop ring. */
	const stripSet = (src: string) =>
		`${src.replace(/\.webp$/, '-280.webp')} 280w, ${src.replace(/\.webp$/, '-440.webp')} 440w`;
</script>

<section class="farms" id="farms" bind:this={root} aria-labelledby="farms-title">
	<header class="head">
		<p class="kb-eyebrow">{content.eyebrow}</p>
		<h2 class="kb-title" id="farms-title">{content.title}</h2>
		<p class="intro">{content.intro}</p>
	</header>
	<div class="stage">
		{#if panels.length}
			<!-- the turning ribbon: every photo of every part, wound round one cylinder -->
			<div class="ring-view" aria-hidden="true">
				<div class="tilt">
					<div class="helix">
						{#each slices as sl (sl.key)}
							<div
								class={['slice', { edge: sl.k === 0 }]}
								style:--j={sl.j}
								style:--k={sl.k}
								style:background-image={near ? `url(${sl.src})` : undefined}
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
							{#each current.meta as m (m.label)}
								<div>
									<dt>{m.label}</dt>
									<dd>{m.value}</dd>
								</div>
							{/each}
						</dl>
					{/key}
				</div>
				<p class="count" aria-hidden="true">
					<span class="small">{current.kind ?? 'Estate'}</span>
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
							<span class="kind">{farm.kind ?? 'Estate'}</span>
							<span class="name">{farm.title}</span>
							<span class="rule" aria-hidden="true"></span>
							<span class="text">{farm.text}</span>
						</button>
					</li>
				{/each}
			</ol>
		{/if}
	</div>

	<!-- phones, short screens and reduced motion: each part with a strip of its photos -->
	{#if content.farms.length}
		<ol class="parts">
			{#each content.farms as farm, i (farm.id)}
				<li class="part" id={`farm-${farm.id}`}>
					<div class="strip">
						{#each [farm.photo, ...(farm.gallery ?? [])] as photo, k (k)}
							<img
								src={photo.src.replace(/\.webp$/, '-440.webp')}
								srcset={stripSet(photo.src)}
								sizes="min(62vw, 260px)"
								alt={photo.alt}
								width="520"
								height="680"
								loading="lazy"
								decoding="async"
							/>
						{/each}
					</div>
					<p class="kind">{pad(i + 1)} · {farm.kind ?? 'Estate'}</p>
					<h3>{farm.title}</h3>
					<p class="text">{farm.text}</p>
					{#if farm.meta.length}
						<dl class="meta">
							{#each farm.meta as m (m.label)}
								<div>
									<dt>{m.label}</dt>
									<dd>{m.value}</dd>
								</div>
							{/each}
						</dl>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.farms {
		background: var(--paper-soft);
		color: var(--ink);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: clamp(72px, 9vw, 112px) max(40px, calc((100% - 1440px) / 2)) 0;
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
	.stage {
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
		font-weight: 500;
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
	.parts {
		display: none;
	}

	/* phones, short screens and reduced motion: a plain list of parts, each with a photo strip */
	@media (max-width: 899px), (max-height: 599px), (prefers-reduced-motion: reduce) {
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
		.strip img {
			flex: none;
			width: min(62vw, 260px);
			height: auto;
			aspect-ratio: 13 / 17;
			object-fit: cover;
			border-radius: 12px;
			scroll-snap-align: start;
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
			font-weight: 500;
			line-height: 1.15;
			letter-spacing: -0.02em;
			overflow-wrap: anywhere;
		}
		.part .text {
			margin: 0;
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
