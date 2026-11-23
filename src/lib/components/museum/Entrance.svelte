<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { whenIdle } from '#lib/reveal.js';
	import type { EntranceContent } from '#lib/content/museum.js';

	/** The pinned hero this sheet slides over; it sinks back and dims as it is covered. */
	let { content, under }: { content: EntranceContent; under?: HTMLElement } = $props();

	const fmt = new Intl.NumberFormat('en');

	/** The title, split in two: one half stands either side of the doorway. */
	const halves = $derived.by(() => {
		const words = content.title.split(' ');
		const cut = Math.ceil(words.length / 2);
		return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
	});

	let root: HTMLElement;
	/**
	 * The doorway photo sits only one screen below the hero in the raw HTML (the pinned
	 * hero adds its scroll length later), so native lazy loading would fetch it during
	 * the first paint. Ask for it once the page has loaded and the main thread is idle.
	 */
	let photoReady = $state(false);

	onMount(() => {
		let stopIdle: (() => void) | undefined;
		const fetchPhoto = () => (stopIdle = whenIdle(() => void (photoReady = true)));
		if (document.readyState === 'complete') fetchPhoto();
		else window.addEventListener('load', fetchPhoto, { once: true });
		const cancelPhoto = () => {
			window.removeEventListener('load', fetchPhoto);
			stopIdle?.();
		};
		const { gsap } = setupGsap();
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return cancelPhoto;

		const ctx = gsap.context(() => {
			// the sheet slides up over the pinned hero, which sinks back and dims
			if (under) {
				gsap
					.timeline({
						scrollTrigger: { trigger: root, start: 'top bottom', end: 'top top', scrub: true }
					})
					.to(under, { scale: 0.93, yPercent: -4, borderRadius: 28, ease: 'none' }, 0)
					.to(under.querySelector('.shade'), { opacity: 0.65, ease: 'none' }, 0);
			}

			const counts = gsap.utils.toArray<HTMLElement>('.count', root);
			const countUp = (tl: gsap.core.Timeline, at: number) =>
				counts.forEach((el, i) => {
					const n = { v: 0 };
					tl.fromTo(
						n,
						{ v: 0 },
						{
							v: Number(el.dataset.to),
							duration: 0.5,
							ease: 'power2.out',
							onUpdate: () => {
								el.textContent = fmt.format(Math.round(n.v));
							}
						},
						at + i * 0.06
					);
				});

			const mm = gsap.matchMedia();

			// desktop: the hall holds still while the doorway opens and you walk through it
			mm.add('(min-width: 900px) and (min-height: 600px)', () => {
				root.classList.add('live');
				const stage = root.querySelector<HTMLElement>('.stage')!;
				const tl = gsap.timeline({
					defaults: { ease: 'none' },
					scrollTrigger: {
						trigger: stage,
						start: 'top top',
						end: () => `+=${window.innerHeight * 1.6}`,
						pin: true,
						scrub: 0.6,
						anticipatePin: 1
					}
				});
				tl.fromTo(
					'.door',
					{ clipPath: 'inset(13% 39% 9% 39% round 11vw 11vw 0vw 0vw)' },
					{
						clipPath: 'inset(0% 0% 0% 0% round 0vw 0vw 0vw 0vw)',
						duration: 0.6,
						ease: 'power1.inOut'
					},
					0
				)
					.fromTo('.door img', { scale: 1.3 }, { scale: 1, duration: 0.6 }, 0)
					.to('.half.l', { xPercent: -60, autoAlpha: 0, duration: 0.45, ease: 'power1.in' }, 0.05)
					.to('.half.r', { xPercent: 60, autoAlpha: 0, duration: 0.45, ease: 'power1.in' }, 0.05)
					.to('.stage > .eyebrow', { autoAlpha: 0, duration: 0.2 }, 0.05)
					.fromTo('.scrim', { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0.42)
					.fromTo(
						'.inside > *, .fact',
						{ autoAlpha: 0, y: 28 },
						{ autoAlpha: 1, y: 0, duration: 0.18, stagger: 0.04, ease: 'power2.out' },
						0.56
					)
					.to({}, { duration: 0.12 });
				countUp(tl, 0.62);
				return () => root.classList.remove('live');
			});

			// phones and short screens: the arch and the figures arrive as they scroll in
			mm.add('(max-width: 899px), (max-height: 599px)', () => {
				gsap.from('.door', {
					clipPath: 'inset(8% 18% 0% 18% round 999px 999px 16px 16px)',
					duration: 1.3,
					ease: 'expo.out',
					scrollTrigger: { trigger: '.door', start: 'top 85%', once: true }
				});
				const tl = gsap.timeline({
					scrollTrigger: { trigger: '.ledger', start: 'top 88%', once: true }
				});
				tl.from('.fact', { autoAlpha: 0, y: 20, duration: 0.6, stagger: 0.08, ease: 'power3.out' });
				countUp(tl, 0.1);
			});

			return () => mm.revert();
		}, root);

		return () => {
			cancelPhoto();
			ctx.revert();
		};
	});
</script>

<section class="entrance" id="entrance" bind:this={root} aria-labelledby="entrance-title">
	<span class="handle" aria-hidden="true"></span>

	<div class="stage">
		{#if content.backdrop}
			<!-- the hall itself, soft and dim, so the photo is there from the moment the sheet arrives -->
			<img
				class="backdrop"
				src={content.backdrop}
				width="160"
				height="90"
				alt=""
				aria-hidden="true"
			/>
		{/if}
		<p class="eyebrow">{content.eyebrow}</p>
		<h2 class="title" id="entrance-title">
			<span class="half l">{halves[0]}</span>
			<span class="half r">{halves[1]}</span>
		</h2>

		<!-- the doorway: an arch on the way in, the whole hall once you are through -->
		<figure class="door">
			<img
				src={photoReady ? content.photo.src : undefined}
				alt={content.photo.alt}
				width={content.photo.width}
				height={content.photo.height}
				loading="lazy"
				decoding="async"
			/>
			<span class="scrim" aria-hidden="true"></span>
		</figure>

		<div class="inside">
			{#each content.body as para, i (i)}
				<p class="body">{para}</p>
			{/each}
			{#if content.facts.length}
				<ul class="ledger">
					{#each content.facts as f, i (i)}
						<li class="fact">
							<p class="value">
								<span class="count" data-to={f.value}>{fmt.format(f.value)}</span><span
									class="unit"
								>
									{f.suffix}
								</span>
							</p>
							{#if f.note}<p class="note">{f.note}</p>{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</section>

<style>
	.entrance {
		position: relative;
		z-index: 2;
		border-radius: 36px 36px 0 0;
		background: var(--paper);
		color: var(--ink);
		overflow: clip;
	}
	.handle {
		position: absolute;
		z-index: 3;
		top: 16px;
		left: 50%;
		translate: -50% 0;
		width: 56px;
		height: 5px;
		border-radius: 3px;
		background: var(--line);
	}

	/* ---- the plain layout: phones, short screens, reduced motion, before the script runs ---- */
	.stage {
		display: flex;
		flex-direction: column;
		gap: 28px;
		padding: 96px max(24px, calc((100% - 1200px) / 2)) 96px;
	}
	.eyebrow {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 16px;
		color: var(--accent-ink);
	}
	.title {
		margin: 0;
		font-size: clamp(2.5rem, 7vw, 4rem);
		line-height: 1.05;
		letter-spacing: -0.03em;
		font-weight: 300;
		color: var(--ink);
		text-wrap: balance;
	}
	.half {
		display: inline;
	}
	.door {
		position: relative;
		margin: 0;
		aspect-ratio: 4 / 5;
		max-height: 72svh;
		width: 100%;
		max-width: 520px;
		align-self: center;
		/* an arched doorway */
		border-radius: 999px 999px 16px 16px;
		overflow: hidden;
		background: var(--paper-tint);
	}
	.door img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.scrim,
	.backdrop {
		display: none;
	}
	.inside {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.body {
		margin: 0;
		max-width: 60ch;
		font-size: 18px;
		line-height: 28px;
		color: var(--ink-soft);
		text-wrap: pretty;
	}
	/* the figures read like a ledger: a rule, a big number, a note; no tiles */
	.ledger {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 28px 20px;
		margin: 20px 0 0;
		padding: 0;
		list-style: none;
	}
	.fact {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 14px;
		border-top: 1px solid var(--line);
	}
	.value {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		margin: 0;
		color: var(--ink);
	}
	.count {
		font-size: clamp(44px, 5vw, 76px);
		font-weight: 300;
		line-height: 0.95;
		letter-spacing: -0.04em;
		font-variant-numeric: tabular-nums;
	}
	.unit {
		/* keeps the suffix's own leading space: "2 estates", but "30+ years" */
		white-space: pre;
		font-size: 15px;
		color: var(--ink-soft);
	}
	.note {
		margin: 0;
		font-size: 14px;
		line-height: 20px;
		color: var(--ink-soft);
	}

	/* ---- the doorway hall: desktop, once the script has taken over ---- */
	:global(.entrance.live) .stage {
		position: relative;
		display: block;
		height: 100svh;
		min-height: 600px;
		padding: 0;
		overflow: hidden;
	}
	:global(.entrance.live) .backdrop {
		display: block;
		position: absolute;
		inset: -4%;
		width: 108%;
		max-width: none;
		height: 108%;
		object-fit: cover;
		filter: brightness(0.5) saturate(0.9);
	}
	:global(.entrance.live) .eyebrow {
		color: var(--color-lime-300);
		position: absolute;
		z-index: 2;
		top: 6%;
		left: 50%;
		translate: -50% 0;
		white-space: nowrap;
	}
	/* the two halves of the title stand either side of the arch */
	:global(.entrance.live) .title {
		color: #fff;
		position: absolute;
		z-index: 2;
		inset: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 22vw minmax(0, 1fr);
		align-items: center;
		column-gap: 3vw;
		padding: 0 4vw;
		font-size: clamp(44px, 5.2vw, 96px);
		line-height: 1;
		pointer-events: none;
	}
	:global(.entrance.live) .half {
		display: block;
	}
	:global(.entrance.live) .half.l {
		grid-column: 1;
		text-align: end;
	}
	:global(.entrance.live) .half.r {
		grid-column: 3;
		text-align: start;
	}
	:global(.entrance.live) .door {
		position: absolute;
		inset: 0;
		width: auto;
		max-width: none;
		max-height: none;
		aspect-ratio: auto;
		border-radius: 0;
		clip-path: inset(13% 39% 9% 39% round 11vw 11vw 0vw 0vw);
	}
	:global(.entrance.live) .door img {
		will-change: transform;
	}
	:global(.entrance.live) .scrim {
		display: block;
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgb(8 23 14 / 0.88),
			rgb(8 23 14 / 0.55) 55%,
			rgb(8 23 14 / 0.35)
		);
		opacity: 0;
	}
	/* once through the door: the story and the figures, over the drying beds */
	:global(.entrance.live) .inside {
		position: absolute;
		z-index: 2;
		inset: auto 0 0;
		gap: 18px;
		padding: 0 max(48px, calc((100% - 1320px) / 2)) clamp(40px, 7vh, 72px);
		color: #fff;
	}
	:global(.entrance.live) .inside > *,
	:global(.entrance.live) .fact {
		visibility: hidden;
	}
	:global(.entrance.live) .body {
		max-width: 56ch;
		font-size: 19px;
		line-height: 30px;
		color: rgb(255 255 255 / 0.82);
	}
	:global(.entrance.live) .ledger {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 32px;
		margin-top: 28px;
	}
	:global(.entrance.live) .fact {
		border-top-color: rgb(255 255 255 / 0.28);
	}
	:global(.entrance.live) .value {
		color: #fff;
	}
	:global(.entrance.live) .unit,
	:global(.entrance.live) .note {
		color: rgb(255 255 255 / 0.88);
	}

	@media (min-width: 700px) {
		.ledger {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	@media (max-width: 560px) {
		.stage {
			padding-top: 80px;
			padding-bottom: 80px;
		}
		.entrance {
			border-radius: 28px 28px 0 0;
		}
	}
</style>
