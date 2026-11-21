<script lang="ts">
	import { onMount } from 'svelte';
	import { srcsetFor } from '#lib/img.js';
	import { setupGsap } from '#lib/gsap.js';
	import { whenIdle } from '#lib/reveal.js';
	import type { HallsContent } from '#lib/content/museum.js';

	let { content }: { content: HallsContent } = $props();

	const halls = $derived(content.halls);
	const total = $derived(halls.length);
	const pad = (n: number) => String(n).padStart(2, '0');

	let root = $state<HTMLElement>();
	let stage = $state<HTMLElement>();
	let active = $state(0);
	let broken = $state<Record<string, boolean>>({});

	/** Card geometry in design pixels; the stage scales it to fit. */
	const CARD_W = 380;
	const CARD_H = 520;

	let layout: (animate: boolean) => void = () => {};

	const go = (i: number) => {
		if (!total) return;
		const next = Math.max(0, Math.min(total - 1, i));
		if (next === active) return;
		active = next;
		layout(true);
	};
	const prev = () => go(active - 1);
	const next = () => go(active + 1);

	const onkeydown = (e: KeyboardEvent) => {
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			prev();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			next();
		} else if (e.key === 'Home') {
			e.preventDefault();
			go(0);
		} else if (e.key === 'End') {
			e.preventDefault();
			go(total - 1);
		}
	};

	// drag or swipe: the track follows the pointer a little, a decisive flick changes hall
	let dragX = 0;
	let dragging = false;
	let dragFrom = 0;
	const onpointerdown = (e: PointerEvent) => {
		if (e.button !== 0 || total < 2) return;
		dragging = true;
		dragFrom = e.clientX;
		dragX = 0;
	};
	const onpointermove = (e: PointerEvent) => {
		if (!dragging) return;
		dragX = e.clientX - dragFrom;
		if (Math.abs(dragX) > 6) stage?.setPointerCapture(e.pointerId);
		layout(false);
	};
	const onpointerup = () => {
		if (!dragging) return;
		dragging = false;
		const dx = dragX;
		dragX = 0;
		if (dx < -50) next();
		else if (dx > 50) prev();
		else layout(true);
	};

	// set up once the page is idle: none of this is visible on the first screen
	onMount(() =>
		whenIdle(() => {
			if (!root || !stage) return;
			const { gsap } = setupGsap();
			const host = stage;
			const scope = root;
			const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			let k = 1;

			const ctx = gsap.context(() => {
				const q = gsap.utils.selector(scope);

				const measure = () => {
					const r = host.getBoundingClientRect();
					// fit the active card by width (it leaves room for its neighbours to peek) and by height
					k = Math.min(1, (r.width * 0.8) / CARD_W, r.height / CARD_H);
					host.style.setProperty('--k', String(k));
				};

				layout = (animate) => {
					const cards = q('.slot') as HTMLElement[];
					const backs = q('.backdrop') as HTMLElement[];
					const dur = animate && !still ? 0.75 : 0;
					cards.forEach((el, i) => {
						const d = i - active;
						const a = Math.abs(d);
						const side = Math.sign(d);
						const offset = a === 0 ? 0 : a === 1 ? 0.953 : 0.953 + (a - 1) * 0.72;
						const s = a === 0 ? 1 : a === 1 ? 0.79 : 0.66;
						gsap.to(el, {
							x: side * offset * CARD_W * k + dragX * (a === 0 ? 0.4 : 0.3),
							scale: s * k,
							autoAlpha: a <= 1 ? 1 : a === 2 ? 0.55 : 0,
							zIndex: 10 - a,
							duration: dragging ? 0.25 : dur,
							ease: 'power3.out',
							overwrite: 'auto'
						});
					});
					backs.forEach((el, i) => {
						const on = i === active;
						gsap.to(el, {
							autoAlpha: on ? 1 : 0,
							duration: dur ? 0.9 : 0,
							ease: 'power2.out',
							overwrite: 'auto'
						});
						if (on && dur)
							gsap.fromTo(el, { scale: 1.08 }, { scale: 1, duration: 6, ease: 'power1.out' });
					});
					// a soft glare crosses the card that just arrived
					const glare = cards[active]?.querySelector('.glare');
					if (glare && dur && !dragging)
						gsap.fromTo(
							glare,
							{ xPercent: -160 },
							{ xPercent: 360, duration: 1.1, ease: 'power2.inOut' }
						);
				};

				measure();
				layout(false);

				const ro = new ResizeObserver(() => {
					measure();
					layout(false);
				});
				ro.observe(host);

				if (!still) {
					gsap.from(q('.head > *'), {
						autoAlpha: 0,
						y: 24,
						duration: 0.8,
						ease: 'power3.out',
						stagger: 0.08,
						scrollTrigger: { trigger: root, start: 'top 70%', once: true }
					});
					gsap.from(q('.slot-inner'), {
						y: 80,
						autoAlpha: 0,
						duration: 1,
						ease: 'power3.out',
						stagger: { each: 0.07, from: 'center' },
						scrollTrigger: { trigger: host, start: 'top 80%', once: true }
					});
					gsap.from(q('.navi, .dots'), {
						autoAlpha: 0,
						y: 16,
						duration: 0.7,
						ease: 'power3.out',
						delay: 0.35,
						scrollTrigger: { trigger: host, start: 'top 80%', once: true }
					});
				}

				return () => ro.disconnect();
			}, scope);

			return () => {
				layout = () => {};
				ctx.revert();
			};
		})
	);
</script>

{#if total}
	<section
		class="halls"
		id="halls"
		bind:this={root}
		aria-labelledby="halls-title"
		aria-roledescription="carousel"
	>
		<div class="backdrops" aria-hidden="true">
			{#each halls as h, i (h.id)}
				<img
					class="backdrop"
					src={h.photo}
					alt=""
					loading="lazy"
					decoding="async"
					style:opacity={i === 0 ? 1 : 0}
					onerror={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
				/>
			{/each}
			<div class="shade"></div>
		</div>

		<header class="head">
			<p class="eyebrow">{content.eyebrow}</p>
			<h2 id="halls-title">{content.title}</h2>
			<p class="intro">{content.intro}</p>
		</header>

		<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
		<div
			class="stage"
			bind:this={stage}
			role="group"
			aria-label="Halls, use the arrow keys to move between them"
			tabindex="0"
			{onkeydown}
			{onpointerdown}
			{onpointermove}
			{onpointerup}
			onpointercancel={onpointerup}
		>
			<ol class="track">
				{#each halls as h, i (h.id)}
					{@const on = i === active}
					<li
						class="slot"
						aria-roledescription="slide"
						aria-label={`${i + 1} of ${total}`}
						aria-current={on ? 'true' : undefined}
					>
						<div class="slot-inner">
							<article class="card" inert={!on}>
								<div class="photo">
									{#if broken[h.id]}
										<div class="photo-missing"></div>
									{:else}
										<img
											src={h.photo}
											srcset={srcsetFor(h.photo)}
											sizes="(min-width: 900px) 300px, 70vw"
											alt=""
											loading="lazy"
											decoding="async"
											draggable="false"
											onerror={() => (broken[h.id] = true)}
										/>
									{/if}
									<span class="chip">Hall {pad(i + 1)}</span>
								</div>
								<div class="tibeb" aria-hidden="true"></div>
								<div class="body">
									<h3>{h.title}</h3>
									{#if h.text}<p class="text">{h.text}</p>{/if}
									<div class="foot">
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- hall links come from content -->
										<a href={h.href}>Enter hall <span aria-hidden="true">→</span></a>
										<span class="count">{pad(i + 1)} / {pad(total)}</span>
									</div>
								</div>
								<span class="glare" aria-hidden="true"></span>
							</article>
							{#if !on}
								<button
									type="button"
									class="pick"
									tabindex="-1"
									aria-label={`Show hall ${pad(i + 1)}, ${h.title}`}
									onclick={() => go(i)}
								></button>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		</div>

		{#if total > 1}
			<div class="navi">
				<button
					type="button"
					class="arrow"
					onclick={prev}
					disabled={active === 0}
					aria-label="Previous hall"
				>
					<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
						<path d="M12 5 7 10l5 5" />
					</svg>
				</button>
				<div class="now" aria-live="polite">
					{#if !broken[halls[active].id]}<img
							class="thumb"
							src={halls[active].photo}
							srcset={srcsetFor(halls[active].photo)}
							sizes="60px"
							width="60"
							height="60"
							alt=""
							loading="lazy"
							decoding="async"
						/>{/if}
					<p class="now-text">
						<span class="now-title">Hall {pad(active + 1)} · {halls[active].title}</span>
						{#if halls[active].tagline}<span class="now-sub">{halls[active].tagline}</span>{/if}
					</p>
				</div>
				<button
					type="button"
					class="arrow"
					onclick={next}
					disabled={active === total - 1}
					aria-label="Next hall"
				>
					<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
						<path d="m8 5 5 5-5 5" />
					</svg>
				</button>
			</div>

			<div class="dots">
				{#each halls as h, i (h.id)}
					<button
						type="button"
						class={['dot', { on: i === active }]}
						aria-label={`Hall ${pad(i + 1)}, ${h.title}`}
						aria-current={i === active ? 'true' : undefined}
						onclick={() => go(i)}
					></button>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style>
	.halls {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: min(900px, max(100svh, 640px));
		padding: 64px max(24px, calc((100% - 1200px) / 2)) 28px;
		background: var(--paper);
		color: var(--ink);
	}
	.backdrops,
	.backdrop,
	.shade {
		position: absolute;
		inset: 0;
	}
	.backdrops {
		z-index: -1;
	}
	.backdrop {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.shade {
		background: var(--scrim);
	}

	.head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 360px);
		column-gap: 48px;
		align-items: end;
	}
	.eyebrow {
		grid-column: 1;
		margin: 0 0 10px;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent-mark);
	}
	h2 {
		grid-column: 1;
		margin: 0;
		font-size: clamp(2rem, 2.8vw, 2.5rem);
		line-height: 1.2;
		font-weight: 400;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.intro {
		grid-column: 2;
		grid-row: 1 / span 2;
		align-self: end;
		margin: 0;
		font-size: 16px;
		line-height: 1.25;
		color: var(--ink);
		text-wrap: pretty;
	}

	.stage {
		--k: 1;
		position: relative;
		flex: 1;
		min-height: 300px;
		margin: 28px 0 20px;
		touch-action: pan-y;
		user-select: none;
	}
	.stage:focus-visible {
		outline: none;
	}
	.track {
		position: absolute;
		inset: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.slot {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 380px;
		height: 520px;
		margin: -260px 0 0 -190px;
		will-change: transform;
	}
	.slot-inner {
		position: relative;
		width: 100%;
		height: 100%;
	}
	.card {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: 10px;
		border-radius: 24px;
		overflow: hidden;
		background: var(--glass);
		border: 1px solid var(--glass-line);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}
	.photo {
		position: relative;
		/* gives way to a two-line title instead of crowding the footer */
		flex: 0 1 290px;
		min-height: 190px;
		border-radius: 16px;
		overflow: hidden;
		background: var(--well);
	}
	.photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		-webkit-user-drag: none;
	}
	.photo-missing {
		width: 100%;
		height: 100%;
		background:
			url('/halls/tibeb-diamond.svg') 0 50% / auto 14px repeat-x,
			var(--well);
		opacity: 0.6;
	}
	.chip {
		position: absolute;
		top: 16px;
		left: 16px;
		padding: 6px 12px;
		border-radius: 8px;
		background: rgb(8 23 14 / 0.6);
		color: #fff;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 16px;
		white-space: nowrap;
	}
	.tibeb {
		flex: none;
		height: 14px;
		margin-top: 10px;
		border-radius: 3px;
		background: url('/halls/tibeb-diamond.svg') 0 0 / auto 14px repeat-x;
	}
	.body {
		flex: 1 0 auto;
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding: 20px 18px 8px;
	}
	h3 {
		margin: 0;
		font-size: 28px;
		line-height: 36px;
		font-weight: 400;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	.text {
		margin: 12px 0 0;
		font-size: 16px;
		line-height: 22px;
		color: var(--ink-soft);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.foot {
		margin-top: auto;
		padding-top: 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.foot a {
		color: var(--accent-mark);
		text-decoration: none;
		font-size: 15px;
		white-space: nowrap;
	}
	.foot a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-soft);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.glare {
		position: absolute;
		top: -20%;
		left: 0;
		width: 45%;
		height: 140%;
		background: linear-gradient(
			90deg,
			rgb(255 255 255 / 0),
			rgb(255 255 255 / 0.18),
			rgb(255 255 255 / 0)
		);
		transform: translateX(-160%) rotate(14deg);
		pointer-events: none;
	}
	.pick {
		position: absolute;
		inset: 0;
		border: 0;
		border-radius: 24px;
		background: none;
		cursor: pointer;
	}

	.navi {
		display: flex;
		align-items: center;
		gap: 16px;
		width: min(480px, 100%);
		margin: 0 auto;
		padding: 19px;
		border-radius: 24px;
		background: var(--glass);
		border: 1px solid var(--glass-line);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
	}
	.arrow {
		flex: none;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 16px;
		border: 0;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.arrow svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.arrow:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 16%, transparent);
	}
	.arrow:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.now {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.thumb {
		flex: none;
		width: 60px;
		height: 60px;
		border-radius: 50%;
		object-fit: cover;
	}
	.now-text {
		min-width: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.now-title {
		font-size: 16px;
		line-height: 20px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.now-sub {
		font-size: 13px;
		line-height: 16px;
		color: var(--ink-soft);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dots {
		display: flex;
		justify-content: center;
		gap: 4px;
		margin-top: 6px;
	}
	.dot {
		/* 24px hit area around an 8px dot */
		position: relative;
		width: 24px;
		height: 24px;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.dot::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 8px;
		height: 8px;
		margin: -4px 0 0 -4px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--ink) 35%, transparent);
		transition:
			width 0.3s,
			margin 0.3s,
			background-color 0.3s;
	}
	.dot.on::after {
		width: 22px;
		margin-left: -11px;
		background: var(--accent-mark);
	}
	button:focus-visible,
	.foot a:focus-visible,
	.stage:focus-visible {
		outline: 2px solid var(--accent-mark);
		outline-offset: 3px;
	}

	@media (min-width: 1800px) {
		.halls {
			padding-inline: calc((100% - 1440px) / 2);
			min-height: min(1080px, 100svh);
		}
	}
	@media (max-width: 760px) {
		.halls {
			padding-top: 56px;
		}
		.head {
			grid-template-columns: 1fr;
		}
		.intro {
			grid-column: 1;
			grid-row: auto;
			margin-top: 12px;
		}
		.navi {
			padding: 10px;
			gap: 10px;
		}
		.thumb {
			width: 44px;
			height: 44px;
		}
		.now {
			gap: 10px;
		}
	}
	@media (max-width: 400px) {
		/* the title needs the room more than the thumbnail does */
		.thumb {
			display: none;
		}
	}
	@media (max-height: 560px) and (orientation: landscape) {
		.halls {
			min-height: 0;
			padding-top: 32px;
		}
		.stage {
			min-height: 260px;
			margin: 16px 0 12px;
		}
		.navi {
			width: min(400px, 100%);
			padding: 8px;
			gap: 10px;
		}
		.arrow {
			width: 40px;
			height: 40px;
			border-radius: 12px;
		}
		.thumb {
			width: 40px;
			height: 40px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.dot::after {
			transition: none;
		}
	}
</style>
