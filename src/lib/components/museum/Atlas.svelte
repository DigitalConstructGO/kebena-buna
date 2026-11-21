<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { whenIdle } from '#lib/reveal.js';
	import { COUNTRY, SIZE, project } from './ethiopia.js';
	import type { AtlasContent } from '#lib/content/museum.js';

	let { content }: { content: AtlasContent } = $props();

	let root: HTMLElement;
	let svg = $state<SVGSVGElement>();
	let active = $state(0);

	const [W, H] = SIZE;
	const pad = (n: number) => String(n).padStart(2, '0');
	const pts = $derived(content.origins.map((o) => project(o.lon, o.lat)));
	const current = $derived(content.origins[active]);

	/** A soft curve through the origins in list order: quadratic bends through the midpoints. */
	const route = $derived.by(() => {
		if (pts.length < 2) return '';
		let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
		for (let i = 1; i < pts.length - 1; i++) {
			const [x, y] = pts[i];
			const [nx, ny] = pts[i + 1];
			d += ` Q${x.toFixed(1)} ${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`;
		}
		const [lx, ly] = pts[pts.length - 1];
		return `${d} T${lx.toFixed(1)} ${ly.toFixed(1)}`;
	});

	const FULL = `-30 -20 ${W + 60} ${H + 40}`;
	/** The camera: drift toward the chosen origin without losing the country. */
	const viewFor = (i: number) => {
		const p = pts[i];
		if (!p) return FULL;
		const w = W * 0.78;
		const h = H * 0.78;
		const x = Math.min(Math.max(p[0] - w / 2, -30), W + 30 - w);
		const y = Math.min(Math.max(p[1] - h / 2, -20), H + 20 - h);
		return `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
	};

	let gsapRef: ReturnType<typeof setupGsap>['gsap'] | undefined;
	let reduce = false;

	const pick = (i: number) => {
		active = i;
		if (!svg) return;
		if (gsapRef && !reduce)
			gsapRef.to(svg, {
				attr: { viewBox: viewFor(i) },
				duration: 1.1,
				ease: 'power3.inOut',
				overwrite: true
			});
		else svg.setAttribute('viewBox', viewFor(i));
	};

	const onKey = (e: KeyboardEvent) => {
		const n = content.origins.length;
		if (e.key === 'ArrowDown' || e.key === 'ArrowRight') pick((active + 1) % n);
		else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') pick((active - 1 + n) % n);
		else return;
		e.preventDefault();
		root.querySelector<HTMLElement>(`[data-i="${active}"]`)?.focus();
	};

	onMount(() =>
		whenIdle(() => {
			const { gsap } = setupGsap();
			gsapRef = gsap;
			reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			if (reduce || !content.origins.length) return;
			const ctx = gsap.context(() => {
				const tl = gsap.timeline({
					scrollTrigger: { trigger: root, start: 'top 65%', once: true }
				});
				tl.from('.land', { opacity: 0, duration: 0.8, ease: 'power2.out' })
					.from('.route', { drawSVG: '0%', duration: 2.2, ease: 'power2.inOut' }, 0.3)
					.from(
						'.pin',
						{
							scale: 0,
							transformOrigin: '50% 50%',
							duration: 0.5,
							ease: 'back.out(2)',
							stagger: 0.12
						},
						0.4
					)
					.from('.panel', { autoAlpha: 0, x: 24, duration: 0.8, ease: 'power3.out' }, 0.2);
			}, root);
			return () => ctx.revert();
		})
	);
</script>

<section class="atlas" id="origins" bind:this={root} aria-labelledby="atlas-title">
	<header class="head">
		<p class="kb-eyebrow">{content.eyebrow}</p>
		<h2 class="kb-title" id="atlas-title">{content.title}</h2>
	</header>

	{#if content.origins.length}
		<div class="grid">
			<div class="stage">
				<svg
					bind:this={svg}
					viewBox={FULL}
					role="img"
					aria-label={`Map of Ethiopia with ${content.origins.length} coffee origins`}
				>
					<g class="rings" aria-hidden="true">
						{#each [180, 270, 360, 450] as r (r)}
							<circle cx={pts[0][0]} cy={pts[0][1]} {r} />
						{/each}
					</g>
					<path class="land" d={COUNTRY} />
					{#if route}<path class="route" d={route} />{/if}
					{#each content.origins as o, i (o.id)}
						{@const [x, y] = pts[i]}
						<g class={['pin', { on: i === active }]} transform={`translate(${x} ${y})`}>
							{#if i === active}<circle class="halo" r="14" />{/if}
							<circle class="dot" r={i === active ? 6.5 : 5} />
							<text x={x > W * 0.75 ? -12 : 12} y="4" text-anchor={x > W * 0.75 ? 'end' : 'start'}>
								{o.name}
							</text>
						</g>
					{/each}
				</svg>
				<p class="note">Locations are approximate.</p>
			</div>

			<div class="panel">
				{#key active}
					<div class="detail" aria-live="polite">
						<p class="count">Origin {pad(active + 1)} / {pad(content.origins.length)}</p>
						<h3>{current.name}</h3>
						<p class="coords">{current.lat.toFixed(2)}° N, {current.lon.toFixed(2)}° E</p>
						<p class="text">{current.text}</p>
					</div>
				{/key}
				<ol class="list" aria-label="Origins">
					{#each content.origins as o, i (o.id)}
						<li>
							<button
								type="button"
								data-i={i}
								class={{ on: i === active }}
								aria-pressed={i === active}
								tabindex={i === active ? 0 : -1}
								onclick={() => pick(i)}
								onkeydown={onKey}
							>
								<span class="n">{pad(i + 1)}</span>{o.name}
							</button>
						</li>
					{/each}
				</ol>
			</div>
		</div>
	{/if}
</section>

<style>
	.atlas {
		display: flex;
		flex-direction: column;
		gap: 32px;
		padding: clamp(64px, 8vw, 100px) max(24px, calc((100% - 1280px) / 2));
		background: var(--paper);
		color: var(--ink);
	}
	.atlas :global(.kb-eyebrow) {
		color: var(--accent-mark);
		text-transform: none;
		font-size: 13px;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 860fr) minmax(300px, 400fr);
		gap: 20px;
	}
	.stage {
		position: relative;
		border-radius: 28px;
		border: 1px solid var(--line);
		background: var(--paper-tint);
		overflow: hidden;
		aspect-ratio: 860 / 690;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.rings circle {
		fill: none;
		stroke: var(--line);
		stroke-width: 1.2;
	}
	.land {
		fill: var(--card);
		stroke: color-mix(in srgb, var(--accent-ink) 55%, transparent);
		stroke-width: 1.4;
		stroke-linejoin: round;
	}
	.route {
		fill: none;
		stroke: var(--accent-mark);
		stroke-width: 2.6;
		stroke-linecap: round;
	}
	.dot {
		fill: var(--ink);
		stroke: var(--card);
		stroke-width: 2;
		transition: r 0.3s;
	}
	.pin.on .dot {
		fill: var(--accent-mark);
	}
	.halo {
		fill: color-mix(in srgb, var(--accent-mark) 25%, transparent);
		animation: pulse 1.8s ease-out infinite;
		transform-box: fill-box;
		transform-origin: center;
	}
	@keyframes pulse {
		from {
			scale: 0.6;
			opacity: 1;
		}
		to {
			scale: 1.8;
			opacity: 0;
		}
	}
	text {
		fill: var(--ink-soft);
		font-size: 17px;
		paint-order: stroke;
		stroke: var(--card);
		stroke-width: 4px;
	}
	.pin.on text {
		fill: var(--ink);
	}
	.note {
		position: absolute;
		left: 20px;
		bottom: 16px;
		margin: 0;
		font-size: 12px;
		color: var(--ink-soft);
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 28px 24px;
		border-radius: 28px;
		border: 1px solid var(--line);
		background: var(--paper-soft);
	}
	.detail {
		min-height: 230px;
		padding-bottom: 20px;
		border-bottom: 1px solid var(--line);
		animation: swap 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	@keyframes swap {
		from {
			opacity: 0;
			translate: 0 10px;
		}
	}
	.count,
	.coords {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent-mark);
	}
	.coords {
		font-size: 13px;
		color: var(--ink-soft);
	}
	h3 {
		margin: 12px 0 10px;
		font-size: clamp(32px, 3.2vw, 44px);
		line-height: 1.1;
		font-weight: 400;
		overflow-wrap: anywhere;
	}
	.text {
		margin: 18px 0 0;
		font-size: 16px;
		line-height: 1.5;
		color: var(--ink);
	}
	.list {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.list button {
		position: relative;
		display: flex;
		gap: 14px;
		width: 100%;
		padding: 8px 12px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: var(--ink-soft);
		font: inherit;
		font-size: 15px;
		text-align: start;
		cursor: pointer;
		transition:
			color 0.2s,
			background-color 0.2s;
	}
	.list button:hover {
		color: var(--ink);
		background: color-mix(in srgb, var(--ink) 5%, transparent);
	}
	/* the chosen origin is a tinted row with an accent number, not a side stripe */
	.list button.on {
		color: var(--ink);
		background: color-mix(in srgb, var(--accent-mark) 12%, transparent);
	}
	.list button.on .n {
		color: var(--accent-mark);
	}
	.list button:focus-visible {
		outline: 2px solid var(--accent-mark);
		outline-offset: 1px;
	}
	.n {
		font-variant-numeric: tabular-nums;
	}
	@media (max-width: 900px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.detail {
			min-height: 0;
		}
		.list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.halo,
		.detail {
			animation: none;
		}
	}
</style>
