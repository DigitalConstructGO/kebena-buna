<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { whenIdle } from '#lib/reveal.js';
	import type { ProcessContent } from '#lib/content/museum.js';
	import { m } from '#lib/i18n.ts';

	let { content }: { content: ProcessContent } = $props();

	let root: HTMLElement;
	let active = $state(0);
	let pinned: ScrollTrigger | undefined;

	const total = $derived(content.steps.length);
	const pad = (n: number) => String(n).padStart(2, '0');
	const fmt = (n: number) => n.toFixed(1).replace(/\.0$/, '');

	/**
	 * How the bean looks at each step, in order: a red cherry, cream parchment, a dried
	 * cherry, a hulled green bean, a bean ready to ship. `round` 1 is a cherry, 0 a bean.
	 */
	const LOOK = [
		{ bean: '#b3261e', glow: '#d2503c', round: 1 },
		{ bean: '#e3d4ae', glow: '#cfe0a6', round: 0.35 },
		{ bean: '#5e211a', glow: '#c06a3a', round: 0.9 },
		{ bean: '#93a865', glow: '#a8e063', round: 0 },
		{ bean: '#7f9a6a', glow: '#c5ee8a', round: 0 }
	];
	const look = (i: number) => LOOK[i % LOOK.length];

	/** The ring around the bean: every step's name, read as one sentence. */
	const ringText = $derived(content.steps.map((s) => s.title).join('  ·  ') + '  ·  ');
	const RING_R = 128;
	const RING_LEN = Math.round(2 * Math.PI * RING_R);
	const start = $derived(content.steps[0]?.moisture);

	/** Jump the pinned scroll to a step (the meter on the right). */
	const go = (i: number) => {
		if (!pinned) {
			document
				.getElementById(`process-${content.steps[i].id}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			return;
		}
		const y = pinned.start + ((i + 0.5) / total) * (pinned.end - pinned.start);
		window.scrollTo({ top: y, behavior: 'smooth' });
	};

	onMount(() =>
		whenIdle(() => {
			const { gsap, ScrollTrigger } = setupGsap();
			if (total < 2) return;
			const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			const mm = gsap.matchMedia();

			// desktop: the hall holds still while one bean changes through every step
			mm.add('(min-width: 900px) and (min-height: 600px)', () => {
				const q = gsap.utils.selector(root);
				const stage = root.querySelector<HTMLElement>('.stage')!;
				const body = root.querySelector<SVGEllipseElement>('.bean-body')!;
				const shade = root.querySelector<SVGEllipseElement>('.shade')!;
				const crease = root.querySelector<SVGGElement>('.crease')!;
				const shine = root.querySelector<SVGEllipseElement>('.shine')!;
				const bean = root.querySelector<HTMLElement>('.bean')!;
				const ring = root.querySelector<SVGSVGElement>('.orbit')!;
				const value = root.querySelector<HTMLElement>('.value') ?? undefined;
				const fill = root.querySelector<HTMLElement>('.meter-fill')!;
				const lerp = gsap.utils.interpolate;

				let shown = -1;
				const apply = (p: number) => {
					// each step owns an equal share of the scroll and holds for most of it
					const x = gsap.utils.clamp(0, total - 1, p * total - 0.5);
					const a = Math.floor(x);
					const b = Math.min(total - 1, a + 1);
					const t = gsap.utils.clamp(0, 1, (x - a - 0.3) / 0.4);
					const la = look(a);
					const lb = look(b);
					const round = lerp(la.round, lb.round, t);
					stage.style.setProperty('--glow', lerp(la.glow, lb.glow, t));
					body.setAttribute('fill', lerp(la.bean, lb.bean, t));
					const rx = (68 + round * 16).toFixed(1);
					const ry = (98 - round * 14).toFixed(1);
					for (const el of [body, shade]) {
						el.setAttribute('rx', rx);
						el.setAttribute('ry', ry);
					}
					crease.style.opacity = (1 - round).toFixed(3);
					shine.style.opacity = (0.25 + round * 0.55).toFixed(3);
					const ma = content.steps[a].moisture;
					const mb = content.steps[b].moisture;
					if (value && ma !== undefined && mb !== undefined) {
						const m = fmt(lerp(ma, mb, t));
						if (value.textContent !== m) value.textContent = m;
					}
					fill.style.transform = `scaleY(${p.toFixed(4)})`;
					if (!still) {
						ring.style.transform = `rotate(${(-p * 200).toFixed(2)}deg)`;
						bean.style.transform = `rotate(${(p * 120 - 16).toFixed(2)}deg) scale(${(0.92 + Math.sin(p * Math.PI) * 0.14).toFixed(3)})`;
					}

					const i = Math.min(total - 1, Math.floor(p * total));
					if (i !== active) active = i;
					if (i !== shown) {
						const forward = i > shown && shown !== -1;
						shown = i;
						if (forward && content.steps[i].moment && !still) moment(i);
					}
				};

				pinned = ScrollTrigger.create({
					trigger: root,
					start: 'top top',
					end: () => `+=${window.innerHeight * 0.8 * total}`,
					pin: stage,
					anticipatePin: 1,
					onUpdate: (self) => apply(self.progress),
					onRefresh: (self) => apply(self.progress)
				});

				// the hull splits: a flash, the word, and husk flakes thrown off the bean
				const canvas = root.querySelector<HTMLCanvasElement>('.burst')!;
				let raf = 0;
				const moment = (i: number) => {
					const word = q(`.moment[data-i="${i}"]`);
					gsap.fromTo(
						q('.flash'),
						{ opacity: 0.75 },
						{ opacity: 0, duration: 1.1, ease: 'power2.out' }
					);
					gsap.fromTo(
						word,
						{ autoAlpha: 0, scale: 0.75 },
						{ autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(3)' }
					);
					gsap.to(word, { autoAlpha: 0, scale: 1.12, duration: 0.6, delay: 0.8 });
					gsap.fromTo(
						bean,
						{ x: -5 },
						{
							x: 5,
							duration: 0.05,
							repeat: 9,
							yoyo: true,
							ease: 'none',
							onComplete: () => gsap.set(bean, { x: 0 })
						}
					);
					const ctx = canvas.getContext('2d');
					if (!ctx) return;
					const r = canvas.getBoundingClientRect();
					canvas.width = Math.round(r.width);
					canvas.height = Math.round(r.height);
					const cx = canvas.width / 2;
					const cy = canvas.height * 0.46;
					const parts = Array.from({ length: 70 }, () => {
						const ang = Math.random() * Math.PI * 2;
						const sp = Math.random() * 9 + 3;
						return {
							x: cx,
							y: cy,
							vx: Math.cos(ang) * sp,
							vy: Math.sin(ang) * sp - 2,
							r: Math.random() * 3 + 1.5,
							rot: Math.random() * 6,
							vr: (Math.random() - 0.5) * 0.4,
							life: 1
						};
					});
					cancelAnimationFrame(raf);
					const tick = () => {
						ctx.clearRect(0, 0, canvas.width, canvas.height);
						let alive = 0;
						ctx.fillStyle = '#d9c08e';
						for (const f of parts) {
							if (f.life <= 0) continue;
							alive++;
							f.x += f.vx;
							f.y += f.vy;
							f.vx *= 0.96;
							f.vy = f.vy * 0.96 + 0.18;
							f.rot += f.vr;
							f.life -= 0.016;
							ctx.save();
							ctx.globalAlpha = Math.max(0, f.life);
							ctx.translate(f.x, f.y);
							ctx.rotate(f.rot);
							ctx.beginPath();
							ctx.ellipse(0, 0, f.r * 1.6, f.r * 0.7, 0, 0, 7);
							ctx.fill();
							ctx.restore();
						}
						raf = alive ? requestAnimationFrame(tick) : 0;
						if (!alive) ctx.clearRect(0, 0, canvas.width, canvas.height);
					};
					raf = requestAnimationFrame(tick);
				};

				return () => {
					cancelAnimationFrame(raf);
					pinned = undefined;
				};
			});

			if (!still) {
				mm.add('(max-width: 899px), (max-height: 599px)', () => {
					gsap.utils.toArray<HTMLElement>('.m-step', root).forEach((el) => {
						gsap.from(el, {
							autoAlpha: 0,
							y: 28,
							duration: 0.8,
							ease: 'power3.out',
							scrollTrigger: { trigger: el, start: 'top 88%', once: true }
						});
					});
				});
			}
			return () => mm.revert();
		})
	);
</script>

<section class="process" id="process" bind:this={root} aria-labelledby="process-title">
	<div class="stage" style:--glow={look(0).glow}>
		<header class="head">
			<p class="kb-eyebrow">{content.eyebrow}</p>
			<h2 class="kb-title" id="process-title">{content.title}</h2>
		</header>
		<p class="intro">{content.intro}</p>

		{#if total}
			<div class="center" aria-hidden="true">
				<svg class="orbit" viewBox="0 0 300 300">
					<defs>
						<path
							id="process-ring"
							d={`M150 150 m -${RING_R} 0 a ${RING_R} ${RING_R} 0 1 1 ${RING_R * 2} 0 a ${RING_R} ${RING_R} 0 1 1 -${RING_R * 2} 0`}
						/>
					</defs>
					<text>
						<textPath href="#process-ring" textLength={RING_LEN} lengthAdjust="spacingAndGlyphs">
							{ringText}
						</textPath>
					</text>
				</svg>
				<div class="bean">
					<svg viewBox="0 0 200 260">
						<defs>
							<radialGradient id="process-shade" cx="34%" cy="28%" r="82%">
								<stop offset="0" stop-color="#fff" stop-opacity=".22" />
								<stop offset=".45" stop-color="#000" stop-opacity="0" />
								<stop offset="1" stop-color="#000" stop-opacity=".6" />
							</radialGradient>
							<radialGradient id="process-gloss" cx="50%" cy="50%" r="50%">
								<stop offset="0" stop-color="#fff" stop-opacity=".9" />
								<stop offset="1" stop-color="#fff" stop-opacity="0" />
							</radialGradient>
						</defs>
						<g transform="rotate(-14 100 130)">
							<ellipse class="bean-body" cx="100" cy="130" rx="84" ry="84" fill={look(0).bean} />
							<ellipse class="shade" cx="100" cy="130" rx="84" ry="84" fill="url(#process-shade)" />
							<g class="crease" style:opacity="0">
								<path
									d="M112 40 C 70 90, 130 160, 88 222"
									fill="none"
									stroke="#000"
									stroke-opacity=".45"
									stroke-width="9"
									stroke-linecap="round"
								/>
								<path
									d="M118 42 C 76 92, 136 160, 94 222"
									fill="none"
									stroke="#fff"
									stroke-opacity=".14"
									stroke-width="2"
								/>
							</g>
							<ellipse
								class="shine"
								cx="70"
								cy="86"
								rx="20"
								ry="32"
								fill="url(#process-gloss)"
								opacity=".8"
							/>
						</g>
					</svg>
				</div>
			</div>
			<canvas class="burst" aria-hidden="true"></canvas>
			<div class="flash" aria-hidden="true"></div>
			{#each content.steps as s, i (s.id)}
				{#if s.moment}<p class="moment" data-i={i} aria-hidden="true">{s.moment}</p>{/if}
			{/each}

			<div class="readout">
				<div class="window" aria-live="polite">
					{#each content.steps as s, i (s.id)}
						<div class={['step', { on: i === active }]} aria-hidden={i !== active}>
							<p class="num">{pad(i + 1)} <span>/ {pad(total)}</span></p>
							<h3>{s.title}</h3>
							<p class="text">{s.text}</p>
						</div>
					{/each}
				</div>
				{#if start !== undefined}
					<p class="gauge">
						<span class="value">{fmt(start)}</span><span class="unit">%</span>
						<small>{content.readoutLabel ?? m.home_process_moisture()}</small>
					</p>
				{/if}
			</div>

			<nav class="meter" aria-label={m.home_process_steps_label()}>
				<span class="meter-track" aria-hidden="true"><span class="meter-fill"></span></span>
				<ol>
					{#each content.steps as s, i (s.id)}
						<li style:top={`${((i + 0.5) / total) * 100}%`}>
							<button
								type="button"
								class={{ on: i === active }}
								aria-current={i === active ? 'step' : undefined}
								onclick={() => go(i)}
							>
								{s.title}
							</button>
						</li>
					{/each}
				</ol>
			</nav>
		{/if}
	</div>

	<!-- phones and short screens: the same steps as a simple list -->
	{#if total}
		<ol class="mobile">
			{#each content.steps as s, i (s.id)}
				<li class="m-step" id={`process-${s.id}`} style:--bean={look(i).bean}>
					<img
						src={s.photo.src}
						alt={s.photo.alt}
						width="640"
						height="480"
						loading="lazy"
						decoding="async"
					/>
					<p class="num">
						<span class="dot" aria-hidden="true"></span>{pad(i + 1)} <span>/ {pad(total)}</span>
						{#if s.moisture !== undefined}<span class="m">
								{m.home_process_moisture_value({ value: fmt(s.moisture) })}
							</span>{/if}
					</p>
					<h3>{s.title}</h3>
					<p class="text">{s.text}</p>
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.process {
		position: relative;
		background: var(--color-forest-950);
		color: #fff;
	}
	.stage {
		--glow: #d2503c;
		position: relative;
		height: 100svh;
		min-height: 600px;
		overflow: hidden;
		isolation: isolate;
		background: var(--color-forest-950);
	}
	/* candlelight: one warm pool of the bean's own colour */
	.stage::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: radial-gradient(
			46% 52% at 50% 46%,
			color-mix(in srgb, var(--glow) 26%, transparent),
			transparent 72%
		);
	}
	.head {
		position: absolute;
		top: clamp(72px, 11svh, 120px);
		left: max(24px, calc((100% - 1200px) / 2));
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: min(460px, 40%);
	}
	.head :global(.kb-eyebrow) {
		color: var(--color-lime-400);
	}
	.head :global(.kb-title) {
		color: #fff;
	}
	.intro {
		position: absolute;
		top: clamp(80px, 12svh, 128px);
		right: max(72px, calc((100% - 1200px) / 2 + 48px));
		max-width: 32ch;
		margin: 0;
		font-size: 15px;
		line-height: 1.55;
		color: rgb(255 255 255 / 0.62);
	}
	.center {
		position: absolute;
		left: 50%;
		top: 46%;
		translate: -50% -50%;
		display: grid;
		place-items: center;
	}
	.orbit {
		position: absolute;
		width: clamp(300px, 40vw, 540px);
		color: color-mix(in srgb, var(--glow) 55%, #fff);
		opacity: 0.5;
		will-change: transform;
	}
	.orbit text {
		font-size: 10.5px;
		letter-spacing: 0.08em;
		fill: currentColor;
	}
	.bean {
		width: clamp(150px, 18vw, 240px);
		will-change: transform;
	}
	.bean svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		filter: drop-shadow(0 30px 44px rgb(0 0 0 / 0.55));
	}
	.burst,
	.flash {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.burst {
		z-index: 3;
	}
	.flash {
		z-index: 4;
		opacity: 0;
		background: radial-gradient(
			circle at 50% 46%,
			rgb(245 236 200 / 0.8),
			color-mix(in srgb, var(--glow) 30%, transparent) 30%,
			transparent 60%
		);
	}
	.moment {
		position: absolute;
		left: 50%;
		top: 46%;
		z-index: 5;
		margin: 0;
		translate: -50% -50%;
		font-size: clamp(2.4rem, 6vw, 4.6rem);
		font-weight: 300;
		color: #fffbe8;
		text-shadow: 0 0 30px color-mix(in srgb, var(--glow) 80%, transparent);
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
	}
	.readout {
		position: absolute;
		left: max(24px, calc((100% - 1200px) / 2));
		right: max(72px, calc((100% - 1200px) / 2 + 48px));
		bottom: clamp(36px, 8svh, 84px);
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 32px;
	}
	.window {
		position: relative;
		flex: 1;
		min-width: 0;
		min-height: 220px;
	}
	.step {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		opacity: 0;
		translate: 0 24px;
		transition:
			opacity 0.35s ease,
			translate 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.step.on {
		opacity: 1;
		translate: 0 0;
		transition-delay: 0.12s;
	}
	.num {
		margin: 0 0 10px;
		font-family: var(--font-mono);
		font-size: 13px;
		color: color-mix(in srgb, var(--glow) 60%, #fff);
	}
	.num span {
		color: rgb(255 255 255 / 0.45);
	}
	h3 {
		margin: 0;
		max-width: 16ch;
		font-size: clamp(2.6rem, 5.6vw, 5.4rem);
		line-height: 1;
		font-weight: 300;
		letter-spacing: -0.03em;
		text-wrap: balance;
		overflow-wrap: anywhere;
	}
	.text {
		margin: 14px 0 0;
		max-width: 38ch;
		font-size: 16px;
		line-height: 1.5;
		color: rgb(255 255 255 / 0.68);
	}
	.gauge {
		flex: none;
		margin: 0;
		text-align: right;
		font-weight: 300;
		line-height: 1;
		color: color-mix(in srgb, var(--glow) 55%, #fff);
	}
	.value {
		font-size: clamp(2.6rem, 4.6vw, 4.2rem);
		font-variant-numeric: tabular-nums;
	}
	.unit {
		font-size: clamp(1.4rem, 2.2vw, 2rem);
	}
	.gauge small {
		display: block;
		margin-top: 10px;
		font-size: 12px;
		color: rgb(255 255 255 / 0.5);
	}
	.meter {
		position: absolute;
		right: max(24px, calc((100% - 1200px) / 2 - 24px));
		top: 24%;
		bottom: 24%;
		width: 2px;
	}
	.meter-track {
		position: absolute;
		inset: 0;
		border-radius: 2px;
		background: rgb(255 255 255 / 0.14);
		overflow: hidden;
	}
	.meter-fill {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--glow) 70%, #fff);
		transform: scaleY(0);
		transform-origin: 50% 0;
	}
	.meter ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.meter li {
		position: absolute;
		right: 12px;
		translate: 0 -50%;
	}
	.meter button {
		max-width: 16ch;
		padding: 4px 0;
		border: 0;
		background: none;
		color: rgb(255 255 255 / 0.4);
		font: inherit;
		font-size: 12px;
		text-align: right;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
		transition: color 0.3s;
	}
	.meter button:hover,
	.meter button.on {
		color: #fff;
	}
	.meter button:focus-visible {
		outline: 2px solid var(--color-lime-400);
		outline-offset: 2px;
		border-radius: 4px;
	}
	.mobile {
		display: none;
	}

	@media (max-width: 899px), (max-height: 599px) {
		.stage {
			height: auto;
			min-height: 0;
			padding: clamp(72px, 12vw, 96px) 24px 0;
		}
		.stage::before {
			display: none;
		}
		.head,
		.intro {
			position: static;
			max-width: 560px;
		}
		.intro {
			margin-top: 16px;
		}
		.center,
		.burst,
		.flash,
		.moment,
		.readout,
		.meter {
			display: none;
		}
		.mobile {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
			gap: 40px 24px;
			margin: 0;
			padding: 40px 24px 80px;
			list-style: none;
		}
		.m-step img {
			display: block;
			width: 100%;
			height: auto;
			aspect-ratio: 4 / 3;
			object-fit: cover;
			border-radius: 16px;
			margin-bottom: 18px;
			background: var(--color-forest-800);
		}
		.m-step .num {
			display: flex;
			align-items: center;
			flex-wrap: wrap;
			gap: 8px;
			color: var(--color-lime-400);
		}
		.dot {
			width: 12px;
			height: 15px;
			border-radius: 50%;
			background: var(--bean);
		}
		.m {
			margin-left: auto;
			color: rgb(255 255 255 / 0.55);
		}
		.m-step h3 {
			font-size: 26px;
			line-height: 1.2;
			letter-spacing: -0.01em;
		}
		.m-step .text {
			font-size: 16px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.step {
			transition: none;
		}
	}
</style>
