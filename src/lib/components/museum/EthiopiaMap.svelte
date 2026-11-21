<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { m } from '#lib/paraglide/messages.js';
	import { CITIES, COUNTRY, JIMMA_ZONE, REGIONS, SIZE, project } from './ethiopia.js';
	import type { Kingdom } from '#lib/content/story.js';

	let {
		kingdoms,
		currentId,
		zoomed = $bindable(false),
		nameOf,
		onpick
	}: {
		kingdoms: Kingdom[];
		currentId: string;
		/** false: the whole of Ethiopia; true: the Gibe region, where the kingdoms are drawn. */
		zoomed?: boolean;
		nameOf: (k: Kingdom) => string;
		onpick: (id: string) => void;
	} = $props();

	/*
	 * The five kingdoms, drawn as a tiling that shares edges, then placed over the
	 * Jimma zone where they stood. The tiling is schematic: positions follow the
	 * borders the sources give, not surveyed boundaries.
	 */
	const T: Record<string, readonly [number, number]> = {
		A: [170, 62],
		B: [300, 34],
		C: [432, 70],
		D: [474, 150],
		E: [204, 192],
		F: [304, 214],
		G: [414, 192],
		H: [222, 302],
		I: [160, 352],
		J: [70, 322],
		K: [52, 204],
		L: [108, 112],
		M: [424, 300],
		N: [330, 352],
		P: [560, 190],
		Q: [582, 330],
		R: [502, 432],
		S: [392, 412],
		T: [300, 472],
		U: [170, 444]
	};
	/** Tiling units (620 × 520) to longitude/latitude over the Jimma zone, then to map units. */
	const at = (x: number, y: number) => project(35.98 + (x / 620) * 1.5, 8.62 - (y / 520) * 1.32);
	const SHAPES: Record<string, { pts: string[]; capital: [number, number] }> = {
		limmu: { pts: ['A', 'B', 'C', 'D', 'G', 'F', 'E'], capital: [318, 132] },
		gumma: { pts: ['A', 'E', 'H', 'I', 'J', 'K', 'L'], capital: [150, 214] },
		gomma: { pts: ['E', 'F', 'G', 'M', 'S', 'N', 'H'], capital: [330, 288] },
		jimma: { pts: ['D', 'P', 'Q', 'R', 'S', 'M', 'G'], capital: [494, 300] },
		gera: { pts: ['I', 'H', 'N', 'S', 'T', 'U'], capital: [270, 410] }
	};
	const shape = (pts: string[]) =>
		'M' +
		pts
			.map((p) =>
				at(...T[p])
					.map((n) => n.toFixed(1))
					.join(' ')
			)
			.join('L') +
		'Z';
	const middle = (pts: string[]) => {
		const xs = pts.map((p) => T[p][0]);
		const ys = pts.map((p) => T[p][1]);
		return [
			xs.reduce((a, b) => a + b) / xs.length,
			ys.reduce((a, b) => a + b) / ys.length
		] as const;
	};
	const curve = (pts: [number, number][]) => {
		const [p0, c1, c2, p1] = pts.map(([x, y]) =>
			at(x, y)
				.map((n) => n.toFixed(1))
				.join(' ')
		);
		return `M${p0} C ${c1}, ${c2}, ${p1}`;
	};
	const RIVERS = [
		{
			name: 'Didessa',
			d: curve([
				[40, 40],
				[28, 140],
				[52, 240],
				[24, 400]
			]),
			label: at(14, 230),
			vertical: true
		},
		{
			name: 'Gibe',
			d: curve([
				[470, 22],
				[540, 70],
				[600, 140],
				[606, 300]
			]),
			label: at(592, 96),
			vertical: false
		},
		{
			name: 'Gojeb',
			d: curve([
				[110, 488],
				[220, 512],
				[380, 506],
				[520, 470]
			]),
			label: at(300, 514),
			vertical: false
		}
	];
	const PEOPLES = [
		{ name: 'Macha Oromo', at: at(104, 30) },
		{ name: 'Kaffa', at: at(560, 506) }
	];

	const placed = $derived(kingdoms.filter((k) => SHAPES[k.id]));

	/** Region names as they are known today; the source still has SNNP as one region. */
	const REGION_NAME: Record<string, string> = {
		'Benishangul Gumz': 'Benishangul-Gumuz',
		SNNP: 'Central & South Ethiopia',
		'South West Ethiopia': 'South West',
		'Addis Ababa': ''
	};
	const SMALL = new Set(['Harari', 'Dire Dawa']);
	const CALLOUT = [-14, 724] as const;

	/* the two framings; the inset shows where the close-up sits in the country */
	const [W, H] = SIZE;
	const FAR = [-24, -24, W + 48, H + 48];
	const [nx, ny] = project(35.82, 8.78);
	const [sx, sy] = project(37.62, 7.14);
	const NEAR = [nx, ny, sx - nx, sy - ny];
	const box = (v: number[]) => v.map((n) => n.toFixed(1)).join(' ');

	let svg = $state<SVGSVGElement>();
	let frame = $state<HTMLElement>();
	let ready = false;

	/** Keep labels and strokes the same size on screen at any zoom: --u is map units per CSS pixel. */
	const setUnit = () => {
		if (!svg || !frame) return;
		const vb = svg.viewBox.baseVal;
		const k = Math.max(vb.width / frame.clientWidth, vb.height / frame.clientHeight);
		svg.style.setProperty('--u', String(k));
	};

	let gsapRef: ReturnType<typeof setupGsap>['gsap'] | undefined;
	let still = false;
	let drawn = false;

	$effect(() => {
		const target = box(zoomed ? NEAR : FAR);
		if (!svg || !ready) return;
		if (!gsapRef || still) {
			svg.setAttribute('viewBox', target);
			setUnit();
			return;
		}
		gsapRef.to(svg, {
			attr: { viewBox: target },
			duration: 1.6,
			ease: 'power3.inOut',
			overwrite: true,
			onUpdate: setUnit
		});
		// the first time in, the borders and rivers draw themselves as the camera lands
		if (zoomed && !drawn) {
			drawn = true;
			const lands = svg.querySelectorAll('.land, .river');
			gsapRef.from(lands, {
				drawSVG: 0,
				duration: 1.4,
				ease: 'power2.inOut',
				stagger: 0.1,
				delay: 0.9
			});
		}
	});

	onMount(() => {
		const { gsap } = setupGsap();
		gsapRef = gsap;
		still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		ready = true;
		setUnit();
		const ro = new ResizeObserver(setUnit);
		if (frame) ro.observe(frame);
		return () => ro.disconnect();
	});
</script>

<div class={['emap', { zoomed }]} bind:this={frame}>
	<!-- the chapter list mirrors the map; keyboard and screen readers use that -->
	<svg
		bind:this={svg}
		viewBox={box(FAR)}
		role="presentation"
		preserveAspectRatio="xMidYMid meet"
		style="direction: ltr"
	>
		<g class="country-layer">
			{#each REGIONS as r (r.name)}
				<path class="region" d={r.d} />
			{/each}
			<path class="border" d={COUNTRY} />
		</g>

		<g class="zone-layer">
			<path class="zone" d={JIMMA_ZONE} />
		</g>

		<g class="far-labels" aria-hidden="true">
			{#each REGIONS as r (r.name)}
				{@const name = REGION_NAME[r.name] ?? r.name}
				{#if name}
					<text
						class={['region-label', { small: SMALL.has(r.name) }]}
						x={r.label[0]}
						y={r.label[1] + (r.name === 'Harari' ? 14 : r.name === 'Dire Dawa' ? -10 : 0)}
						text-anchor="middle"
					>
						{name}
					</text>
				{/if}
			{/each}
			{#each CITIES as c (c.name)}
				{#if c.name !== 'Jimma'}
					<circle class="city" cx={c.at[0]} cy={c.at[1]} r="2" />
					<text class="city-label" x={c.at[0] + 8} y={c.at[1] + 4}>{c.name}</text>
				{/if}
			{/each}
			{#if true}
				{@const j = CITIES.find((c) => c.name === 'Jimma')!.at}
				<circle class="pulse" cx={j[0]} cy={j[1]} r="10" />
				<circle class="city on" cx={j[0]} cy={j[1]} r="3" />
				<!-- the callout sits in the empty space south-west of the border, clear of the region names -->
				<path
					class="leader"
					d={`M${j[0] - 6} ${j[1] + 8} L${CALLOUT[0] + 40} ${CALLOUT[1] - 26}`}
				/>
				<text class="callout" x={CALLOUT[0]} y={CALLOUT[1]}>Jimma</text>
				<text class="callout-sub" x={CALLOUT[0]} y={CALLOUT[1] + 22}>{m.story_map_gibe()}</text>
			{/if}
		</g>

		<g class="near-layer">
			{#each RIVERS as r (r.name)}
				<path class="river" d={r.d} />
			{/each}
			{#each placed as k (k.id)}
				{@const s = SHAPES[k.id]}
				{@const [cx, cy] = middle(s.pts)}
				{@const cap = at(...s.capital)}
				{@const lab = at(cx, cy + (s.capital[1] > cy ? -12 : 26))}
				{@const on = k.id === currentId}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<g class={['realm', { on }]} onclick={() => onpick(k.id)}>
					<path class="land-fill" d={shape(s.pts)} />
					<path class="land" d={shape(s.pts)} />
					<circle class="cap" cx={cap[0]} cy={cap[1]} r="3" />
					<text class="realm-label" x={lab[0]} y={lab[1]} text-anchor="middle">{nameOf(k)}</text>
				</g>
			{/each}
			{#each RIVERS as r (r.name)}
				<text
					class="river-label"
					x={r.label[0]}
					y={r.label[1]}
					transform={r.vertical ? `rotate(-90 ${r.label[0]} ${r.label[1]})` : undefined}
				>
					{r.name}
				</text>
			{/each}
			{#each PEOPLES as p (p.name)}
				<text class="people" x={p.at[0]} y={p.at[1]}>{p.name}</text>
			{/each}
		</g>
	</svg>

	<!-- where the close-up sits in Ethiopia -->
	<svg class="inset" viewBox={box(FAR)} aria-hidden="true">
		<path class="inset-country" d={COUNTRY} />
		<rect class="inset-box" x={NEAR[0]} y={NEAR[1]} width={NEAR[2]} height={NEAR[3]} />
	</svg>

	<button
		type="button"
		class="zoom"
		aria-label={zoomed ? m.story_map_country() : m.story_map_region()}
		onclick={() => (zoomed = !zoomed)}
	>
		{#if zoomed}
			<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h10" /></svg>
			<span class="zoom-label">{m.story_map_country()}</span>
		{:else}
			<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
				<path d="M3 8h10M8 3v10" />
			</svg>
			<span class="zoom-label">{m.story_map_region()}</span>
		{/if}
	</button>
</div>

<style>
	.emap {
		container-type: inline-size;
		position: relative;
		width: 100%;
		aspect-ratio: 991 / 772;
	}
	.emap > svg:first-child {
		--u: 1.6;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	path,
	circle,
	rect {
		vector-effect: non-scaling-stroke;
	}

	/* the country */
	.region {
		fill: var(--card);
		stroke: var(--accent-line);
		stroke-width: 1;
		stroke-linejoin: round;
		transition: fill 0.8s;
	}
	.border {
		fill: none;
		stroke: color-mix(in srgb, var(--accent-mark) 50%, transparent);
		stroke-width: 1.5;
		stroke-linejoin: round;
	}
	.zone {
		fill: var(--accent-area);
		stroke: var(--accent-mark);
		stroke-width: 1.5;
		stroke-linejoin: round;
		transition:
			fill 0.8s,
			stroke 0.8s,
			opacity 0.8s;
	}
	.zoomed .region {
		fill: color-mix(in srgb, var(--card) 70%, transparent);
	}
	.zoomed .zone {
		fill: none;
		stroke: var(--accent-line);
		stroke-dasharray: 4 4;
	}

	text {
		font-family: var(--font-sans);
	}
	.far-labels,
	.near-layer {
		transition: opacity 0.7s;
	}
	.far-labels {
		opacity: 1;
	}
	.zoomed .far-labels {
		opacity: 0;
		pointer-events: none;
	}
	.near-layer {
		opacity: 0;
		pointer-events: none;
	}
	.zoomed .near-layer {
		opacity: 1;
		pointer-events: auto;
		transition-delay: 0.6s;
	}
	.region-label {
		font-size: calc(var(--u) * 12px);
		fill: var(--ink-soft);
	}
	.region-label.small {
		font-size: calc(var(--u) * 9px);
	}
	.city {
		r: calc(var(--u) * 3.5px);
		fill: var(--ink-soft);
	}
	.city.on {
		r: calc(var(--u) * 5px);
		fill: var(--accent-mark);
	}
	.city-label {
		font-size: calc(var(--u) * 11px);
		fill: var(--ink-soft);
	}
	.leader {
		fill: none;
		stroke: var(--accent-mark);
		stroke-width: 1;
		opacity: 0.7;
	}
	.callout {
		font-size: calc(var(--u) * 16px);
		fill: var(--ink-strong);
	}
	.callout-sub {
		font-size: calc(var(--u) * 11px);
		fill: var(--accent-mark);
	}
	.pulse {
		r: calc(var(--u) * 14px);
		fill: none;
		stroke: var(--accent-mark);
		stroke-width: 1.5;
		transform-box: fill-box;
		transform-origin: center;
		animation: pulse 2.4s ease-out infinite;
	}
	@keyframes pulse {
		from {
			scale: 0.4;
			opacity: 1;
		}
		to {
			scale: 2.2;
			opacity: 0;
		}
	}

	/* the close-up */
	.river {
		fill: none;
		stroke: var(--water);
		stroke-width: 2;
		stroke-linecap: round;
		opacity: 0.7;
	}
	.river-label,
	.people {
		font-size: calc(var(--u) * 12px);
		font-style: italic;
		fill: var(--water-ink);
	}
	.people {
		fill: var(--ink-soft);
	}
	.realm {
		cursor: pointer;
	}
	.land-fill {
		fill: var(--card);
		transition: fill 0.5s;
	}
	.land {
		fill: none;
		stroke: color-mix(in srgb, var(--accent-mark) 35%, transparent);
		stroke-width: 1.5;
		stroke-linejoin: round;
		transition: stroke 0.5s;
	}
	.realm:hover .land-fill {
		fill: color-mix(in srgb, var(--card), var(--ink) 10%);
	}
	.realm.on .land-fill {
		fill: var(--accent-area);
	}
	.realm.on .land {
		stroke: var(--accent-mark);
		stroke-width: 2.2;
	}
	.cap {
		r: calc(var(--u) * 3.5px);
		fill: var(--accent-mark);
		transition: r 0.4s;
	}
	.realm-label {
		font-size: calc(var(--u) * 14px);
		fill: var(--ink);
		pointer-events: none;
		transition: fill 0.4s;
	}
	.realm.on .cap {
		r: calc(var(--u) * 6px);
	}
	.realm.on .realm-label {
		fill: var(--ink-strong);
	}

	/* inset locator and the zoom switch */
	.inset {
		position: absolute;
		inset-block-end: 8px;
		inset-inline-end: 8px;
		width: 18%;
		height: auto;
		opacity: 0;
		transition: opacity 0.6s;
		pointer-events: none;
	}
	.zoomed .inset {
		opacity: 1;
		transition-delay: 0.8s;
	}
	.inset-country {
		fill: color-mix(in srgb, var(--paper) 85%, transparent);
		stroke: color-mix(in srgb, var(--accent-mark) 50%, transparent);
		stroke-width: 1;
	}
	.inset-box {
		fill: color-mix(in srgb, var(--accent-mark) 30%, transparent);
		stroke: var(--accent-mark);
		stroke-width: 1.2;
	}
	.zoom {
		position: absolute;
		inset-block-start: 8px;
		inset-inline-end: 8px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 12px;
		border: 0;
		border-radius: 10px;
		background: color-mix(in srgb, var(--paper) 80%, transparent);
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		white-space: nowrap;
		cursor: pointer;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}
	.zoom:hover {
		background: var(--paper);
	}
	.zoom:focus-visible {
		outline: 2px solid var(--accent-mark);
		outline-offset: 2px;
	}
	.zoom path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}

	/* too small for thirteen region names; the country shape, the capital and Jimma carry it */
	@container (max-width: 520px) {
		.region-label {
			display: none;
		}
		.zoom {
			font-size: 12px;
			padding: 6px 10px;
		}
	}
	/* a thumbnail-sized map keeps just the icon; the button still has its name */
	@container (max-width: 340px) {
		.zoom-label {
			display: none;
		}
		.zoom {
			padding: 7px;
		}
		.callout-sub {
			display: none;
		}
		.realm-label {
			font-size: calc(var(--u) * 11px);
		}
		.river-label,
		.people {
			font-size: calc(var(--u) * 10px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
			opacity: 0;
		}
	}
</style>
