<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { m } from '#lib/i18n.ts';
	import { awayWhenHidden } from './away.js';
	import type { Snippet } from 'svelte';

	/**
	 * What stands behind the doors: the first hall of the page. With `closing` the story runs
	 * the other way: the doors swing shut over whatever is on screen above this section, and
	 * end as the museum's front.
	 */
	let { children, closing = false }: { children?: Snippet; closing?: boolean } = $props();

	let root: HTMLElement;

	const doors = ['left', 'right'] as const;

	onMount(() => {
		const { gsap } = setupGsap();

		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();

			mm.add('(prefers-reduced-motion: no-preference)', () => {
				/* the first screen now lies over the top of the cream panel, like a closed door */
				root.dataset.live = '';

				let open: boolean | undefined;
				const tell = (now: boolean) => {
					// doors that only ever shut have nothing waiting behind them to tell
					if (closing || now === open) return;
					open = now;
					window.dispatchEvent(new CustomEvent('kb:door', { detail: now }));
				};
				tell(false);
				let unhush: (() => void) | undefined;

				if (closing) {
					// shutting: the museum comes up over what is on screen above, stands clear for a
					// while, and then the two doors meet in front of it
					// the cup in the last frame above and the museum are the same shape, a cup with a
					// tulip on its side. So the museum starts laid exactly over the cup, and the cup
					// becomes the building before anything else of the picture is seen.
					const film = document.querySelector<HTMLVideoElement>('.hero video.pour');
					const shot = root.querySelector<HTMLElement>('.th-view .th-shot')!;
					type Mark = { cx: number; top: number; w: number };
					/** where a point of a picture lands on screen under object-fit: cover */
					const cover = (iw: number, ih: number, w: number, h: number, px: number, py: number) => {
						const k = Math.max(w / iw, h / ih);
						return { k, x: (w - iw * k) * px, y: (h - ih * k) * py };
					};
					let cup: Mark, hall: Mark;
					const measure = () => {
						const w = shot.offsetWidth;
						const h = shot.offsetHeight;
						// the museum: roof line of the building in museum.webp, hung 9% low (--drop)
						const m = cover(2400, 1348, w, h, 0.62, 0);
						hall = {
							cx: m.x + 0.6216 * 2400 * m.k,
							top: m.y + 0.1454 * 1348 * m.k + 0.09 * h,
							w: 0.3575 * 2400 * m.k
						};
						// the cup: its rim in the last frame of the hero's film, which ends 5% enlarged
						cup = hall;
						if (film) {
							const fw = film.offsetWidth;
							const fh = film.offsetHeight;
							const cs = getComputedStyle(film);
							const [px, py] = cs.objectPosition.split(' ').map((v) => parseFloat(v) / 100);
							// phones play a square cut, shown whole and low on the screen: the cup is larger in it
							const whole = cs.objectFit === 'contain';
							const vw = film.videoWidth || (whole ? 720 : 1280);
							const vh = film.videoHeight || (whole ? 720 : 704);
							const k = whole ? Math.min(fw / vw, fh / vh) : Math.max(fw / vw, fh / vh);
							const iw = vw * k;
							const ih = vh * k;
							const c = { x: (fw - iw) * px, y: (fh - ih) * py };
							const rim =
								vw / vh < 1.2
									? { cx: 0.519, top: 0.372, w: 0.635 }
									: { cx: 0.5073, top: 0.375, w: 0.3535 };
							const grow = 1.05;
							cup = {
								cx: fw / 2 + (c.x + rim.cx * iw - fw / 2) * grow,
								top: fh / 2 + (c.y + rim.top * ih - fh / 2) * grow,
								w: rim.w * iw * grow
							};
						}
						gsap.set(shot, {
							transformOrigin: `${hall.cx}px ${hall.top}px`,
							'--mx': `${hall.cx}px`,
							'--my': `${hall.top + hall.w * 0.5}px`
						});
					};
					measure();

					const tl = gsap.timeline({
						defaults: { ease: 'none' },
						scrollTrigger: {
							trigger: root,
							start: 'top top',
							end: () => '+=' + Math.max(1, root.offsetHeight - window.innerHeight),
							scrub: 0.6,
							invalidateOnRefresh: true,
							onRefreshInit: measure
						}
					});
					// the story's words, sound button and chapter marks belong to the film above: they
					// leave before the building shows, so nothing is left written across the museum
					// (looked up as it runs: the chapter marks are only drawn once the film is ready)
					const said = { gone: 0 };
					const hush = () => {
						for (const el of document.querySelectorAll<HTMLElement>(
							'.hero .copy, .hero .controls, .hero .rail'
						)) {
							el.style.opacity = said.gone ? String(1 - said.gone) : '';
							el.style.visibility = said.gone >= 1 ? 'hidden' : '';
						}
					};
					tl.to(said, { gone: 1, duration: 0.05, ease: 'power1.in', onUpdate: hush }, 0);
					// once the picture fills the screen the film under it can rest
					let over = false;
					const resting = (now: boolean) => {
						if (now === over) return;
						over = now;
						window.dispatchEvent(new CustomEvent('kb:hero-covered', { detail: now }));
					};
					tl.eventCallback('onUpdate', () => resting(tl.time() > 0.26));
					unhush = () => {
						said.gone = 0;
						hush();
						resting(false);
					};
					// 1. the building comes up where the cup is, inside a soft-edged opening
					tl.fromTo(
						'.th-view',
						{ autoAlpha: 0 },
						{ autoAlpha: 1, duration: 0.1, ease: 'sine.inOut' },
						0.03
					)
						// the room goes dark behind the picture as the opening widens, so the film
						// above never shows past its edges while it is still out of place
						.fromTo('.th-view', { '--bk': 0 }, { '--bk': 1, duration: 0.12 }, 0.1)
						.fromTo(
							shot,
							{ '--m': () => `${hall.w * 0.5}px` },
							{ '--m': () => `${hall.w * 0.85}px`, duration: 0.1 },
							0
						)
						// 2. the opening widens until the land around the museum fills the screen
						.to(
							shot,
							{
								'--m': () => `${Math.hypot(shot.offsetWidth, shot.offsetHeight) * 2.4}px`,
								duration: 0.14,
								ease: 'power2.in'
							},
							0.1
						)
						// 3. and the whole picture settles from the cup's place into its own
						.fromTo(
							shot,
							{
								x: () => cup.cx - hall.cx,
								y: () => cup.top - hall.top,
								scale: () => cup.w / hall.w
							},
							{ x: 0, y: 0, scale: 1, duration: 0.2, ease: 'power2.inOut', immediateRender: true },
							0.15
						)
						.fromTo(
							shot,
							{ '--f': () => `${shot.offsetWidth * 0.16}px` },
							{ '--f': '0px', duration: 0.1, ease: 'power1.in' },
							0.25
						)
						.fromTo('.th-name', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, 0.31)
						.fromTo(
							'.th-hero',
							{ autoAlpha: 0, yPercent: 5 },
							{ autoAlpha: 1, yPercent: 0, duration: 0.08, ease: 'power1.out' },
							0.34
						)
						// from here to 0.6 nothing moves: the museum is simply there to be looked at
						.to('.th-hero', { autoAlpha: 0, duration: 0.1 }, 0.6)
						.fromTo(
							'.th-door[data-side="left"]',
							{ xPercent: -101 },
							{ xPercent: 0, duration: 0.3, ease: 'power2.inOut' },
							0.6
						)
						.fromTo(
							'.th-door[data-side="right"]',
							{ xPercent: 101 },
							{ xPercent: 0, duration: 0.3, ease: 'power2.inOut' },
							0.6
						)
						.to({}, { duration: 0.1 });
				} else {
					gsap
						.timeline({
							defaults: { ease: 'none' },
							scrollTrigger: {
								// nothing is pinned: the doors ride along on position: sticky, and what is
								// behind them holds still by itself for this stretch
								trigger: root,
								start: 'top top',
								end: '+=135%',
								scrub: 0.5,
								invalidateOnRefresh: true,
								// the hall behind deals its cards as the doors part, and gathers them as they close
								onUpdate: (self) => tell(self.progress > 0.5)
							}
						})
						.to('.th-cue', { autoAlpha: 0, duration: 0.1 }, 0)
						.to('.th-hero', { yPercent: -7, autoAlpha: 0, duration: 0.3, ease: 'power1.in' }, 0.02)
						.to('.th-paint', { opacity: 1, duration: 0.3 }, 0)
						.to(
							'.th-door[data-side="left"]',
							{ xPercent: -101, duration: 0.6, ease: 'power2.inOut' },
							0.32
						)
						.to(
							'.th-door[data-side="right"]',
							{ xPercent: 101, duration: 0.6, ease: 'power2.inOut' },
							0.32
						)
						.from('.th-inner', { y: 70, duration: 0.6, ease: 'power2.out' }, 0.32)
						.to({}, { duration: 0.08 });
				}

				return () => {
					delete root.dataset.live;
					unhush?.();
					tell(true);
				};
			});
		}, root);

		return () => ctx.revert();
	});
</script>

<section id="entrance" class="th" data-closing={closing ? '' : undefined} bind:this={root}>
	<div class="th-pin">
		<div class="th-stage">
			{#if closing}
				<!-- the museum itself, seen clear before the doors shut in front of it -->
				<div class="th-view" aria-hidden="true">
					<div class="th-shot">
						<picture>
							<source srcset="/hero/museum.webp" type="image/webp" />
							<img src="/hero/museum.jpg" alt="" width="2400" height="1348" decoding="async" />
						</picture>
						<div class="th-scrim"></div>
					</div>
				</div>
			{/if}
			<div class="th-doors" aria-hidden="true">
				{#each doors as side (side)}
					<div class="th-door" data-side={side}>
						<div class="th-shot">
							<picture>
								<source srcset="/hero/museum.webp" type="image/webp" />
								<img
									src="/hero/museum.jpg"
									alt=""
									width="2400"
									height="1348"
									decoding="async"
									fetchpriority={side === 'left' ? 'high' : 'auto'}
								/>
							</picture>
							<div class="th-scrim"></div>
						</div>
						<div class="th-paint">
							<div class="th-leaf-frame"></div>
							<svg class="th-arch" viewBox="0 0 100 300" fill="none" preserveAspectRatio="none">
								<path d="M8 300V92A92 92 0 0 1 100 0" />
								<path d="M30 300V92A70 70 0 0 1 100 22" />
								<path d="M52 300V92A48 48 0 0 1 100 44" />
							</svg>
							<i class="th-knob"></i>
						</div>
						<!-- the name is written across both doors, so it parts with them -->
						<span class="th-sign" data-letter="door-sign">{m.museum_doorway_sign()}</span>
					</div>
				{/each}
			</div>

			{#if closing}
				<!-- one name, in front of picture and doors alike, so it stays put while they shut -->
				<span class="th-sign th-name" aria-hidden="true" data-letter="door-sign">
					Kebena Museum
				</span>
			{/if}

			<div class="th-hero">
				<div class="th-low">
					<p class="pk-label th-tag">{m.museum_tagline()}</p>
					<div class="th-foot">
						<p class="th-place">{m.museum_doorway_place()}</p>
						<p class="th-cue" aria-hidden="true" {@attach awayWhenHidden}>
							<span>{m.museum_doorway_scroll()}</span>
							<i></i>
						</p>
					</div>
				</div>
			</div>
		</div>

		{#if !closing}
			<div class="th-front">
				<div class="th-inner">{@render children?.()}</div>

				<svg class="th-band" aria-hidden="true">
					<defs>
						<pattern id="th-band-tile" width="384" height="96" patternUnits="userSpaceOnUse">
							<!-- arch -->
							<path
								d="M14 96V48a34 34 0 0 1 68 0v48M28 96V48a20 20 0 0 1 40 0v48M42 96V50a6 6 0 0 1 12 0v46"
							/>
							<!-- sun over hills -->
							<circle cx="144" cy="40" r="22" />
							<circle cx="144" cy="40" r="10" />
							<path d="M100 96l30-30 22 20 18-16 22 26" />
							<!-- leaf -->
							<path
								d="M240 90C212 66 212 30 240 8c28 22 28 58 0 82ZM240 8v88M240 40l-14-12M240 40l14-12M240 62l-18-14M240 62l18-14"
							/>
							<!-- hut -->
							<path d="M300 96V58h72v38M292 60l44-40 44 40M326 96V74h20v22" />
						</pattern>
					</defs>
					<rect width="100%" height="96" fill="url(#th-band-tile)" />
				</svg>
			</div>
		{/if}
	</div>
</section>

<style>
	.th {
		position: relative;
		background: var(--bag-deep);
	}
	.th-pin {
		position: relative;
	}

	/* ---------- first screen ---------- */
	.th-stage {
		position: relative;
		height: 100vh;
		height: 100svh;
		min-height: 520px;
		overflow: hidden;
		background: var(--bag-deep);
	}
	/* with motion on, the first screen is laid over the cream panel and parts like a door */
	.th:global([data-live]) .th-stage {
		position: sticky;
		top: 0;
		height: 100vh;
		height: 100lvh;
		margin-bottom: -100vh;
		margin-bottom: -100lvh;
		z-index: 2;
		background: none;
		pointer-events: none;
	}

	/* shutting: the section lies over the end of what is above it, see-through until the doors meet */
	.th[data-closing]:global([data-live]) {
		margin-top: -100vh;
		margin-top: -100lvh;
		z-index: 2;
		background: none;
		pointer-events: none;
	}
	.th[data-closing]:global([data-live]) .th-stage {
		margin-bottom: 0;
	}
	.th[data-closing]:global([data-live]) .th-pin::after {
		content: '';
		display: block;
		height: 300vh;
		height: 300lvh;
	}

	.th-doors {
		position: absolute;
		inset: 0;
		display: flex;
	}
	.th-stage {
		container-type: inline-size;
	}
	.th-view {
		display: none;
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	/* shutting: the picture is on the wall behind, so the doors are plain painted wood */
	.th[data-closing]:global([data-live]) .th-view {
		display: block;
		visibility: hidden;
		background: color-mix(in srgb, var(--bag-deep) calc(var(--bk, 0) * 100%), transparent);
	}
	/* a soft-edged opening, centred on the building, that the timeline widens past the screen */
	.th[data-closing]:global([data-live]) .th-view .th-shot {
		--m: 9999px;
		--f: 0px;
		/* the round opening, and a feather on all four edges for while the picture is out of place */
		mask-image:
			radial-gradient(
				circle at var(--mx, 50%) var(--my, 50%),
				#000 calc(var(--m) * 0.5),
				transparent var(--m)
			),
			linear-gradient(to right, transparent, #000 var(--f)),
			linear-gradient(to left, transparent, #000 var(--f)),
			linear-gradient(to bottom, transparent, #000 var(--f)),
			linear-gradient(to top, transparent, #000 var(--f));
		mask-composite: intersect;
		will-change: transform;
	}
	.th[data-closing]:global([data-live]) .th-door .th-shot {
		display: none;
	}
	.th[data-closing]:global([data-live]) .th-paint {
		opacity: 1;
	}
	.th-name {
		display: none;
		left: 0;
	}
	.th[data-closing]:global([data-live]) .th-name {
		display: block;
		visibility: hidden;
	}
	.th[data-closing]:global([data-live]) .th-door .th-sign {
		display: none;
	}
	/* the right door laps a hair over the left, so nothing behind shows where they meet */
	.th-door[data-side='right'] {
		flex-basis: calc(50% + 2px);
		margin-left: -2px;
	}
	.th-door {
		position: relative;
		flex: 0 0 50%;

		overflow: hidden;
		will-change: transform;
	}
	.th-shot {
		position: absolute;
		inset-block: 0;
		left: 0;
		/* the whole stage wide, whatever the door's own width */
		width: 100cqw;
	}
	.th-door[data-side='right'] .th-shot {
		left: auto;
		right: 0;
	}
	/* the picture hangs a little low, so the building's roof clears the name above it; the strip
	   this leaves at the top is the same sky, mirrored */
	.th-shot {
		--drop: 9%;
	}
	.th-shot::before {
		content: '';
		position: absolute;
		inset: 0;
		background: url('/hero/museum.webp') 62% 0% / cover no-repeat;
		transform: translateY(calc(var(--drop) - 100%)) scaleY(-1);
	}
	.th-shot picture {
		position: absolute;
		inset: 0;
		transform: translateY(var(--drop));
	}
	.th-shot img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* anchored to the top: a wide window crops the ground, never the roof up into the name */
		object-position: 62% 0%;
	}
	/* a scrim so the type reads: the photo sinks into the bag's dark green */
	.th-scrim {
		position: absolute;
		inset: 0;
		/* only the top and the foot are darkened, where the words sit: the building itself is left clear */
		background:
			linear-gradient(
				to bottom,
				rgb(25 33 27 / 0.5) 0%,
				rgb(25 33 27 / 0.1) 24%,
				rgb(25 33 27 / 0) 40%,
				rgb(25 33 27 / 0) 66%,
				rgb(25 33 27 / 0.82) 100%
			),
			rgb(35 45 37 / 0.08);
	}
	/* the door's own face: forest green with the bag's hairline frame and an arch */
	.th-paint {
		position: absolute;
		inset: 0;
		background: var(--bag);
		opacity: 0;
	}
	.th-sign {
		position: absolute;
		/* kept in the sky above the roof line, at any window shape */
		top: clamp(84px, 10vh, 112px);
		width: 100cqw;
		font-family: var(--pk-display);
		font-weight: 800;
		font-size: clamp(2.1rem, min(6vw, 10vh), 9rem);
		line-height: 1;
		letter-spacing: -0.02em;
		text-align: center;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--on-bag);
	}
	.th-door[data-side='left'] .th-sign {
		left: 0;
	}
	.th-door[data-side='right'] .th-sign {
		right: 0;
	}
	.th-door[data-side='left'] .th-paint {
		border-right: 1px solid var(--gold);
	}
	.th-door[data-side='right'] .th-paint {
		border-left: 1px solid var(--gold);
	}
	.th-leaf-frame {
		position: absolute;
		inset: clamp(12px, 1.6vw, 24px);
		border: 1px solid var(--hair);
	}
	.th-door[data-side='left'] .th-leaf-frame {
		right: 0;
		border-right: 0;
	}
	.th-door[data-side='right'] .th-leaf-frame {
		left: 0;
		border-left: 0;
	}
	.th-arch {
		position: absolute;
		bottom: clamp(12px, 1.6vw, 24px);
		right: 0;
		height: 72%;
		width: min(78%, 34vh);
		stroke: var(--gold);
		stroke-width: 1;
		opacity: 0.7;
	}
	.th-arch :global(*) {
		vector-effect: non-scaling-stroke;
	}
	.th-knob {
		position: absolute;
		top: 62%;
		right: clamp(22px, 3.4vw, 52px);
		width: 12px;
		height: 12px;
		border: 1px solid var(--gold);
		border-radius: 50%;
	}
	.th-door[data-side='right'] .th-knob {
		right: auto;
		left: clamp(22px, 3.4vw, 52px);
	}
	.th-door[data-side='right'] .th-arch {
		right: auto;
		left: 0;
		transform: scaleX(-1);
	}

	.th-hero {
		position: absolute;
		inset: 0 0 auto 0;
		height: 100vh;
		height: 100svh;
		min-height: 520px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: 96px var(--pk-gutter) clamp(18px, 3vh, 34px);
		color: var(--on-bag);
	}
	.th-low {
		position: relative;
	}
	.th-tag {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: clamp(6px, 1.2vh, 14px);
		font-size: clamp(15px, 1.25vw, 19px);
	}
	.th-tag::before {
		content: '';
		width: clamp(28px, 4vw, 64px);
		height: 1px;
		background: var(--gold);
	}
	.th-foot {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px;
		margin-top: clamp(14px, 2.4vh, 26px);
		padding-top: clamp(12px, 1.8vh, 18px);
		border-top: 1px solid var(--hair);
	}
	.th-place {
		margin: 0;
		font-size: 16px;
		line-height: 1.3;
		color: var(--on-bag);
	}
	.th-cue {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0;
		font-family: var(--pk-display);
		font-stretch: 75%;
		font-weight: 500;
		font-size: 13px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--gold);
	}
	.th-cue i {
		position: relative;
		display: block;
		width: 1px;
		height: 30px;
		background: var(--hair);
		overflow: hidden;
	}
	.th-cue i::after {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--gold);
		transform: translateY(-100%);
		animation: th-drip 2.2s var(--pk-ease) infinite;
	}
	.th-cue:global([data-away]) i::after {
		animation-play-state: paused;
	}
	@keyframes th-drip {
		0% {
			transform: translateY(-100%);
		}
		60%,
		100% {
			transform: translateY(100%);
		}
	}

	/* ---------- the bag front ---------- */
	.th-front {
		position: relative;
		min-height: 100vh;
		min-height: 100svh;
		/* clip, not hidden: the walk inside keeps its picture pinned with position: sticky */
		overflow: clip;
		background: var(--paper-tint);
		color: var(--ink);
	}
	.th-inner {
		position: relative;
	}
	.th-band {
		display: block;
		flex: none;
		display: block;
		width: 100%;
		height: 96px;
		fill: none;
		stroke: var(--ink);
		stroke-width: 1;
		opacity: 0.42;
		border-top: 1px solid var(--ink);
	}

	/* phones: the floor plan sign floats bottom centre; the place line and the scroll cue sit above it */
	@media (max-width: 720px) {
		.th-hero {
			padding-bottom: calc(max(14px, env(safe-area-inset-bottom)) + 62px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.th-cue i::after {
			animation: none;
			transform: none;
		}
	}
</style>
