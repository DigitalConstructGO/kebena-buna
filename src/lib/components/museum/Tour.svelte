<script lang="ts">
	import { onMount } from 'svelte';

	export type TourStop = { id: string; title: string; text: string; src: string; alt: string };
	export type TourOutro = {
		eyebrow: string;
		title: string;
		text: string;
		cta: string;
		href: string;
	};

	/** A walk through the building, one picture per scroll step. */
	let {
		stops,
		note,
		outro,
		lead = 0
	}: {
		stops: TourStop[];
		note?: string;
		/** The closing words, laid over the last picture after one more screen of scrolling. */
		outro?: TourOutro;
		/** Screens of scrolling to hold the first picture before the walk starts (while the doors open). */
		lead?: number;
	} = $props();

	const pad = (n: number) => String(n).padStart(2, '0');

	let root = $state<HTMLElement>();
	let active = $state(0);
	let moving = $state(false);
	let ended = $state(false);
	// scroll steps in the walk: one per change of picture, and one more for the closing words
	const steps = $derived(stops.length - 1 + (outro ? 1 : 0));

	onMount(() => {
		if (!root || stops.length < 2) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const el = root;
		const shots = [...el.querySelectorAll<HTMLElement>('.shot')];
		moving = true;

		let frame = 0;
		const paint = () => {
			frame = 0;
			const box = el.getBoundingClientRect();
			const hold = lead * window.innerHeight;
			const span = box.height - window.innerHeight - hold;
			if (span <= 0 || box.bottom < 0 || box.top > window.innerHeight) return;
			// position along the walk, in pictures: 2.4 is 40% of the way from the third to the fourth
			const at = Math.min(1, Math.max(0, (-box.top - hold) / span)) * steps;
			active = Math.min(stops.length - 1, Math.round(at));
			// the closing words come up over the last picture during the final step
			const end = outro ? Math.min(1, Math.max(0, (at - (stops.length - 1) - 0.3) / 0.5)) : 0;
			el.style.setProperty('--end', end.toFixed(3));
			ended = end > 0.5;
			shots.forEach((shot, i) => {
				const d = at - i;
				// the next room fades in over the last part of each step, so each view is held first
				const show = i === 0 ? 1 : Math.min(1, Math.max(0, (d + 0.45) / 0.45));
				shot.style.opacity = String(show);
				// each picture drifts towards you while it is on screen, like stepping forward
				shot.style.transform = `scale(${(1.02 + Math.min(1, Math.max(0, d + 1)) * 0.1).toFixed(4)})`;
			});
		};
		const onScroll = () => (frame ||= requestAnimationFrame(paint));
		paint();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});

	const jump = (i: number) => {
		if (!root) return;
		const box = root.getBoundingClientRect();
		const hold = lead * window.innerHeight;
		const span = box.height - window.innerHeight - hold;
		window.scrollTo({ top: window.scrollY + box.top + hold + (span * i) / steps });
	};
</script>

{#if stops.length}
	<section
		class={['tour', { moving }]}
		id="tour"
		bind:this={root}
		style:--n={stops.length + lead + (outro ? 1 : 0)}
		aria-label="A walk through the museum"
	>
		<div class="frame">
			<ol class="shots">
				{#each stops as s, i (s.id)}
					<li class="shot">
						<img
							src={s.src}
							alt={s.alt}
							loading={i === 0 ? 'eager' : 'lazy'}
							decoding="async"
							draggable="false"
						/>
						<div class="caption static">
							<p class="count">{pad(i + 1)} / {pad(stops.length)}</p>
							<h2>{s.title}</h2>
							<p class="text">{s.text}</p>
						</div>
					</li>
				{/each}
			</ol>

			<div class="veil" aria-hidden="true"></div>

			<!-- with motion on, one caption stands still while the pictures change behind it -->
			<div class="caption live" aria-hidden="true">
				{#key active}
					<div class="swap">
						<p class="count">{pad(active + 1)} / {pad(stops.length)}</p>
						<p class="title">{stops[active].title}</p>
						<p class="text">{stops[active].text}</p>
					</div>
				{/key}
			</div>

			<div class="rail">
				{#each stops as s, i (s.id)}
					<button
						type="button"
						class={['tick', { on: i === active }]}
						aria-label={`Go to ${s.title}`}
						aria-current={i === active ? 'step' : undefined}
						onclick={() => jump(i)}
					></button>
				{/each}
			</div>

			{#if note}<p class="note">{note}</p>{/if}

			{#if outro}
				<div class="dim" aria-hidden="true"></div>
				<div class={['outro', { ended }]}>
					<p class="pk-label">{outro.eyebrow}</p>
					<h2 class="last">{outro.title}</h2>
					<p class="words">{outro.text}</p>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- same-page anchor -->
					<a class="go" href={outro.href} tabindex={moving && !ended ? -1 : undefined}>
						<span>{outro.cta}</span>
						<svg viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6h11.5M7.5 1l5 5-5 5" /></svg>
					</a>
				</div>
			{/if}
		</div>
	</section>
{/if}

<style>
	.tour {
		position: relative;
		background: var(--bag-deep);
		color: var(--on-bag);
	}
	.frame {
		position: relative;
	}
	.shots {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.shot {
		position: relative;
		height: 100vh;
		height: 100svh;
		min-height: 480px;
		overflow: hidden;
	}
	.shot img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.caption {
		position: absolute;
		inset-inline: clamp(20px, 4.4vw, 72px);
		bottom: clamp(88px, 12vh, 120px);
		max-width: 34rem;
	}
	.static {
		padding: 18px 20px;
		background: var(--chrome);
		backdrop-filter: var(--glass-fx);
		-webkit-backdrop-filter: var(--glass-fx);
		border: 1px solid var(--glass-line);
		border-radius: 18px;
	}
	.count {
		margin: 0 0 10px;
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: 14px;
		font-weight: 500;
		letter-spacing: 0.12em;
		font-variant-numeric: tabular-nums;
		color: var(--gold);
	}
	h2,
	.title {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 5.4vw, 4.6rem);
		font-weight: 700;
		line-height: 0.98;
		letter-spacing: -0.035em;
		text-wrap: balance;
	}
	.text {
		margin: 12px 0 0;
		max-width: 40ch;
		font-size: clamp(1rem, 1.2vw, 1.15rem);
		line-height: 1.5;
		color: var(--on-bag);
	}
	.veil,
	.live,
	.rail,
	.dim {
		display: none;
	}

	/* the closing words: a plain block at the end, or laid over the last picture with motion */
	.outro {
		display: grid;
		justify-items: center;
		gap: 18px;
		padding: clamp(72px, 12vh, 140px) clamp(20px, 4.4vw, 72px);
		text-align: center;
	}
	.outro .pk-label {
		color: var(--gold);
	}
	.last {
		max-width: 14ch;
		font-size: clamp(2.6rem, 8vw, 7rem);
		font-weight: 800;
		line-height: 0.94;
		text-transform: uppercase;
	}
	.words {
		margin: 0;
		max-width: 38ch;
		font-size: clamp(1.05rem, 1.4vw, 1.3rem);
		line-height: 1.5;
		color: var(--on-bag);
		text-wrap: pretty;
	}
	.go {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		margin-top: 10px;
		padding: 0 26px;
		border-radius: 999px;
		background: var(--gold);
		color: var(--bag-deep);
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: 15px;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		text-decoration: none;
		transition: background-color 0.3s ease;
	}
	.go:hover {
		background: var(--gold-soft);
	}
	.go:focus-visible {
		outline: 2px solid var(--on-bag);
		outline-offset: 3px;
	}
	.go svg {
		width: 14px;
		height: 12px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.go:hover svg {
		transform: translateX(4px);
	}
	.note {
		position: absolute;
		top: clamp(84px, 11vh, 110px);
		inset-inline-end: clamp(20px, 4.4vw, 72px);
		margin: 0;
		padding: 6px 12px;
		border: 1px solid var(--hair);
		border-radius: 999px;
		background: var(--chrome);
		backdrop-filter: var(--glass-fx);
		-webkit-backdrop-filter: var(--glass-fx);
		font-size: 12px;
		letter-spacing: 0.04em;
		color: var(--on-bag);
	}

	/* with motion: the frame stays put for one screen of scrolling per picture */
	.moving {
		height: calc(var(--n) * 100vh);
		height: calc(var(--n) * 100svh);
	}
	.moving .frame {
		position: sticky;
		top: 0;
		height: 100vh;
		height: 100svh;
		min-height: 480px;
		overflow: hidden;
	}
	.moving .shot {
		position: absolute;
		inset: 0;
		height: auto;
		min-height: 0;
		opacity: 0;
		will-change: opacity, transform;
	}
	.moving .shot:first-child {
		opacity: 1;
	}
	.moving .static {
		display: none;
	}
	.moving .veil {
		display: block;
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgb(25 33 27 / 0.82),
			rgb(25 33 27 / 0.2) 42%,
			transparent 62%
		);
		pointer-events: none;
	}
	.moving .live {
		display: block;
		opacity: calc(1 - var(--end, 0) * 2);
	}
	.moving .rail,
	.moving .note {
		opacity: calc(1 - var(--end, 0));
	}
	.moving .dim {
		display: block;
		position: absolute;
		inset: 0;
		background: var(--bag-deep);
		opacity: calc(var(--end, 0) * 0.8);
		pointer-events: none;
	}
	.moving .outro {
		position: absolute;
		inset: 0;
		align-content: center;
		padding-block: 96px;
		opacity: var(--end, 0);
		transform: translateY(calc((1 - var(--end, 0)) * 28px));
		pointer-events: none;
	}
	.moving .outro.ended {
		pointer-events: auto;
	}
	.swap {
		animation: rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(18px);
		}
	}
	.moving .rail {
		display: flex;
		flex-direction: column;
		position: absolute;
		inset-inline-end: clamp(8px, 2.2vw, 36px);
		top: 50%;
		transform: translateY(-50%);
	}
	.tick {
		position: relative;
		width: 44px;
		height: 30px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	/* the tick stays a hairline; the finger gets a full 44px row */
	.tick::before {
		content: '';
		position: absolute;
		inset: -7px 0;
	}
	.tick::after {
		content: '';
		position: absolute;
		inset-inline-end: 12px;
		top: 50%;
		width: 12px;
		height: 1.5px;
		background: var(--on-bag);
		opacity: 0.55;
		transition:
			width 0.3s ease,
			opacity 0.3s ease,
			background-color 0.3s ease;
	}
	.tick.on::after {
		width: 26px;
		background: var(--gold);
		opacity: 1;
	}
	.tick:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: -4px;
	}
</style>
