<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { whenIdle } from '#lib/reveal.js';
	import { COUNTRY, REGIONS, SIZE, project } from './ethiopia.js';
	import type { AtlasContent } from '#lib/content/museum.js';

	let { content }: { content: AtlasContent } = $props();

	let root: HTMLElement;
	let svg = $state<SVGSVGElement>();
	let active = $state(0);

	const [W, H] = SIZE;
	const pad = (n: number) => String(n).padStart(2, '0');
	const pts = $derived(content.origins.map((o) => project(o.lon, o.lat)));
	const current = $derived(content.origins[active]);

	/** Every origin sends its coffee home: an arc from each one to the first (Jimma). */
	const arcs = $derived(
		pts.map(([x, y], i) => {
			if (i === 0) return '';
			const [hx, hy] = pts[0];
			const dx = hx - x;
			const dy = hy - y;
			const bend = dx > 0 ? -0.22 : 0.22;
			const cx = (x + hx) / 2 - dy * bend;
			const cy = (y + hy) / 2 + dx * bend;
			return `M${x.toFixed(1)} ${y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)}`;
		})
	);

	/* the altitude gauge runs from 1,000 to 2,500 m, which covers every growing band */
	const LOW = 1000;
	const HIGH = 2500;
	const band = $derived.by(() => {
		const a = current.altitude;
		if (!a) return null;
		const from = ((a[0] - LOW) / (HIGH - LOW)) * 100;
		const to = ((a[1] - LOW) / (HIGH - LOW)) * 100;
		return {
			from,
			width: to - from,
			label: `${a[0].toLocaleString('en')} to ${a[1].toLocaleString('en')} m`
		};
	});
	const MONTHS = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	const season = $derived.by(() => {
		const h = current.harvest;
		if (!h?.length) return '';
		return `${MONTHS[h[0] - 1]} to ${MONTHS[h[h.length - 1] - 1]}`;
	});

	/** A name goes to the left of its pin near the east edge, or when a neighbour sits just to its right. */
	const flip = $derived(
		pts.map(
			([x, y], i) =>
				x > W * 0.75 ||
				pts.some(([ox, oy], j) => j !== i && ox > x && ox - x < 70 && Math.abs(oy - y) < 18)
		)
	);

	const FULL = `-30 -20 ${W + 60} ${H + 40}`;
	/** The camera: drift toward the chosen origin without losing the country. */
	const viewFor = (i: number) => {
		const p = pts[i];
		if (!p) return FULL;
		/* a phone draws the map square and stands closer, so names and pins stay finger-sized */
		const phone = typeof window !== 'undefined' && window.innerWidth <= 600;
		const w = W * (phone ? 0.62 : 0.78);
		const h = phone ? w : H * 0.78;
		/* aim between the origin and home, so the whole road stays in the picture */
		const cx = p[0] * 0.55 + pts[0][0] * 0.45;
		const cy = p[1] * 0.55 + pts[0][1] * 0.45;
		const x = Math.min(Math.max(cx - w / 2, -30), W + 30 - w);
		const y = Math.min(Math.max(cy - h / 2, -20), H + 20 - h);
		return `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
	};

	let gsapRef: ReturnType<typeof setupGsap>['gsap'] | undefined;
	let reduce = $state(true);

	/* the map tours its origins by itself until someone takes over */
	let touring = $state(false);
	let seen = false;
	let timer: ReturnType<typeof setInterval> | undefined;
	const STEP = 4200;
	const tour = () => {
		clearInterval(timer);
		if (!touring || !seen) return;
		timer = setInterval(() => show((active + 1) % content.origins.length), STEP);
	};
	/** A person chose: stop the tour and go where they asked. */
	const pick = (i: number) => {
		touring = false;
		clearInterval(timer);
		show(i);
	};

	/* the plate leans toward the pointer and a pool of light follows it */
	let stage = $state<HTMLElement>();
	const lean = (e: PointerEvent) => {
		if (!stage || reduce || e.pointerType !== 'mouse') return;
		const r = stage.getBoundingClientRect();
		const x = (e.clientX - r.left) / r.width;
		const y = (e.clientY - r.top) / r.height;
		stage.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
		stage.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
		stage.style.setProperty('--ry', `${((x - 0.5) * 7).toFixed(2)}deg`);
		stage.style.setProperty('--rx', `${((0.5 - y) * 6).toFixed(2)}deg`);
		stage.dataset.lit = '';
	};
	const level = () => {
		if (!stage) return;
		stage.style.setProperty('--ry', '0deg');
		stage.style.setProperty('--rx', '0deg');
		delete stage.dataset.lit;
	};

	const show = (i: number) => {
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
			if (window.innerWidth <= 600) svg?.setAttribute('viewBox', viewFor(active));
			if (reduce || !content.origins.length) return;
			touring = true;
			const io = new IntersectionObserver(
				([entry]) => {
					seen = entry.isIntersecting;
					tour();
				},
				{ threshold: 0.35 }
			);
			io.observe(root);
			const ctx = gsap.context(() => {
				const tl = gsap.timeline({
					scrollTrigger: { trigger: root, start: 'top 65%', once: true }
				});
				tl.from('.land', { opacity: 0, duration: 0.8, ease: 'power2.out' })
					.from('.regions path', { opacity: 0, duration: 0.6, stagger: 0.04 }, 0.1)
					.from('.arc', { drawSVG: '0%', duration: 1.4, ease: 'power2.inOut', stagger: 0.1 }, 0.5)
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
			return () => {
				clearInterval(timer);
				io.disconnect();
				ctx.revert();
			};
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
			<div
				class="stage"
				bind:this={stage}
				onpointermove={lean}
				onpointerleave={level}
				role="presentation"
			>
				<div class="plate">
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
						<g class="regions" aria-hidden="true">
							{#each REGIONS as r (r.name)}
								<path d={r.d} />
							{/each}
						</g>
						<g class="arcs" aria-hidden="true">
							{#each arcs as d, i (i)}
								{#if d}<path class={['arc', { on: i === active }]} {d} />{/if}
							{/each}
						</g>
						{#if !reduce && arcs[active]}
							{#key active}
								<g class="bean" aria-hidden="true">
									<ellipse rx="7" ry="4.6" />
									<path d="M-5.5 0Q0 -2.4 5.5 0" />
									<animateMotion
										dur="2.6s"
										repeatCount="indefinite"
										rotate="auto"
										path={arcs[active]}
										calcMode="spline"
										keyTimes="0;1"
										keySplines="0.45 0 0.55 1"
									/>
								</g>
							{/key}
						{/if}
						{#each content.origins as o, i (o.id)}
							{@const [x, y] = pts[i]}
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
							<g
								class={['pin', { on: i === active, home: i === 0 }]}
								transform={`translate(${x} ${y})`}
								onclick={() => pick(i)}
							>
								<circle class="hit" r="26" />
								{#if i === active}<circle class="halo" r="14" />{/if}
								{#if i === 0}<circle class="ring" r="11" />{/if}
								<circle class="dot" r={i === active ? 6.5 : 5} />
								<text x={flip[i] ? -14 : 14} y="5" text-anchor={flip[i] ? 'end' : 'start'}>
									{o.name}
								</text>
							</g>
						{/each}
					</svg>
				</div>
				<div class="glow" aria-hidden="true"></div>
				<p class="note">Locations are approximate.</p>
				<p class="hint" aria-hidden="true">Tap an origin</p>
			</div>

			<div class="panel">
				{#key active}
					<div class="detail" aria-live="polite">
						<p class="count">Origin {pad(active + 1)} / {pad(content.origins.length)}</p>
						<h3>{current.name}</h3>
						<p class="coords">{current.lat.toFixed(2)}° N, {current.lon.toFixed(2)}° E</p>
						<p class="text">{current.text}</p>
						{#if band || current.harvest?.length}
							<dl class="facts">
								{#if band}
									<div>
										<dt>Altitude</dt>
										<dd>
											<span class="value">{band.label}</span>
											<span class="gauge" aria-hidden="true">
												<i style:left={`${band.from}%`} style:width={`${band.width}%`}></i>
											</span>
										</dd>
									</div>
								{/if}
								{#if current.harvest?.length}
									<div>
										<dt>Harvest</dt>
										<dd>
											<span class="value">{season}</span>
											<span class="year" aria-hidden="true">
												{#each MONTHS as mo, n (mo)}
													<i class={{ ripe: current.harvest.includes(n + 1) }}>{mo[0]}</i>
												{/each}
											</span>
										</dd>
									</div>
								{/if}
							</dl>
						{/if}
					</div>
				{/key}
				<ol class="list" aria-label="Origins">
					{#each content.origins as o, i (o.id)}
						<li>
							<button
								type="button"
								data-i={i}
								class={{ on: i === active, touring: touring && i === active }}
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
		padding: clamp(64px, 8vw, 100px) max(24px, calc((100% - 1200px) / 2));
		background: var(--paper);
		color: var(--ink);
	}
	.atlas :global(.kb-eyebrow) {
		color: var(--accent-mark);
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
	.stage {
		perspective: 1400px;
	}
	.plate {
		width: 100%;
		height: 100%;
		transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
		transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.glow {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(
			340px circle at var(--mx, 50%) var(--my, 50%),
			color-mix(in srgb, var(--gold) 26%, transparent),
			transparent 70%
		);
		opacity: 0;
		transition: opacity 0.4s;
	}
	.stage:global([data-lit]) .glow {
		opacity: 1;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.regions path {
		fill: none;
		stroke: color-mix(in srgb, var(--accent-ink) 22%, transparent);
		stroke-width: 0.9;
		stroke-dasharray: 3 5;
		stroke-linejoin: round;
	}
	.arc {
		fill: none;
		stroke: color-mix(in srgb, var(--accent-mark) 34%, transparent);
		stroke-width: 1.6;
		stroke-linecap: round;
		transition:
			stroke 0.4s,
			stroke-width 0.4s;
	}
	.arc.on {
		stroke: var(--accent-mark);
		stroke-width: 2.8;
	}
	.bean ellipse {
		fill: #5a3a22;
		stroke: var(--card);
		stroke-width: 1.4;
	}
	.bean path {
		fill: none;
		stroke: #2c1a0e;
		stroke-width: 1.2;
		stroke-linecap: round;
	}
	.pin {
		cursor: pointer;
	}
	.hit {
		fill: transparent;
	}
	.ring {
		fill: none;
		stroke: var(--accent-mark);
		stroke-width: 1.4;
	}
	.pin:hover .dot {
		fill: var(--accent-mark);
	}
	.pin:hover text {
		fill: var(--ink);
	}
	.hint {
		position: absolute;
		inset-inline-end: 20px;
		bottom: 16px;
		margin: 0;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent-mark);
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
	/* phones draw the map about 340px wide, where every name would be 6px and crowd the Jimma
	   cluster: name only the chosen origin, larger; the list below names the rest */
	@media (max-width: 600px) {
		/* the map runs wider and square, and the camera stands closer (see viewFor) */
		.stage {
			aspect-ratio: 1;
			margin-inline: -12px;
			border-radius: 22px;
		}
		.pin text {
			font-size: 23px;
			stroke-width: 6px;
		}
		.pin.on text {
			font-size: 28px;
			font-weight: 600;
		}
		.hit {
			r: 44px;
		}
		.hint {
			top: 14px;
			bottom: auto;
			inset-inline-end: 16px;
		}
		.stage .note {
			inset-inline-start: 16px;
			bottom: 12px;
		}
		.list button {
			align-items: center;
			min-height: 44px;
		}
	}
	.note {
		position: absolute;
		inset-inline-start: 20px;
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
		min-height: 360px;
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
		/* below the section title (h2, 40px): the chosen origin never outranks it */
		font-size: clamp(28px, 2.8vw, 36px);
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
	.facts {
		display: grid;
		gap: 14px;
		margin: 22px 0 0;
	}
	.facts dt {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent-mark);
	}
	.facts dd {
		display: grid;
		gap: 8px;
		margin: 4px 0 0;
	}
	.value {
		font-size: 15px;
		font-variant-numeric: tabular-nums;
	}
	.gauge {
		position: relative;
		height: 6px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
	}
	.gauge i {
		position: absolute;
		inset-block: 0;
		border-radius: 3px;
		background: var(--accent-mark);
		transition:
			left 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
			width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.year {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 3px;
	}
	.year i {
		padding: 3px 0;
		border-radius: 4px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--ink-soft);
		font-style: normal;
		font-size: 11px;
		line-height: 1.2;
		text-align: center;
	}
	.year i.ripe {
		background: var(--accent-mark);
		color: var(--paper);
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
	/* while the map tours by itself, the chosen row fills up until the next stop */
	.list button.touring::after {
		content: '';
		position: absolute;
		inset: auto 12px 3px;
		height: 2px;
		border-radius: 1px;
		background: var(--accent-mark);
		transform-origin: left;
		animation: fill 4.2s linear;
	}
	@keyframes fill {
		from {
			transform: scaleX(0);
		}
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
		.plate {
			transform: none;
		}
	}
</style>
