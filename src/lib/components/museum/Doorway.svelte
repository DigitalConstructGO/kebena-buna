<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import type { Snippet } from 'svelte';

	/** What stands behind the doors: the first hall of the page. */
	let { children }: { children?: Snippet } = $props();

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
					if (now === open) return;
					open = now;
					window.dispatchEvent(new CustomEvent('kb:door', { detail: now }));
				};
				tell(false);

				const tl = gsap.timeline({
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
				});

				tl.to('.th-cue', { autoAlpha: 0, duration: 0.1 }, 0)
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

				return () => {
					delete root.dataset.live;
					tell(true);
				};
			});
		}, root);

		return () => ctx.revert();
	});
</script>

<section id="entrance" class="th" bind:this={root}>
	<div class="th-pin">
		<div class="th-stage">
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
						<span class="th-sign">Kebena Museum</span>
					</div>
				{/each}
			</div>

			<div class="th-hero">
				<div class="th-low">
					<p class="pk-label th-tag">From farm to cup</p>
					<div class="th-foot">
						<p class="th-place">Coffee museum · Jimma, Ethiopia</p>
						<p class="th-cue" aria-hidden="true">
							<span>Scroll</span>
							<i></i>
						</p>
					</div>
				</div>
			</div>
		</div>

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

	.th-doors {
		position: absolute;
		inset: 0;
		display: flex;
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
		width: 200%;
	}
	.th-door[data-side='right'] .th-shot {
		left: -100%;
	}
	.th-shot img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 62% 50%;
	}
	/* a scrim so the type reads: the photo sinks into the bag's dark green */
	.th-scrim {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				to bottom,
				rgb(25 33 27 / 0.72) 0%,
				rgb(25 33 27 / 0.3) 26%,
				rgb(25 33 27 / 0.42) 52%,
				rgb(25 33 27 / 0.94) 100%
			),
			rgb(35 45 37 / 0.34);
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
		top: clamp(84px, 13vh, 150px);
		width: 200%;
		font-family: var(--pk-display);
		font-weight: 800;
		font-size: clamp(2.1rem, 8.2vw, 9rem);
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

	@media (prefers-reduced-motion: reduce) {
		.th-cue i::after {
			animation: none;
			transform: none;
		}
	}
</style>
