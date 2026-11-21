<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { whenIdle } from '#lib/reveal.js';
	import type { JourneyContent } from '#lib/content/museum.js';

	let { content }: { content: JourneyContent } = $props();

	const steps = $derived(content.steps);
	const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
	const roman = (i: number) => ROMAN[i] ?? String(i + 1);

	let root = $state<HTMLElement>();
	let broken = $state<Record<string, boolean>>({});
	/** The cup fills once the stream reaches it. */
	let full = $state(false);

	// set up once the page is idle: none of this is visible on the first screen
	onMount(() =>
		whenIdle(() => {
			if (!root || !steps.length) return;
			const { gsap, ScrollTrigger } = setupGsap();
			const sec = root;
			const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

			const svg = sec.querySelector<SVGSVGElement>('.pour-svg')!;
			const grad = sec.querySelector<SVGLinearGradientElement>('#journey-ribbon')!;
			const [glow, main, hi] = (['.rb-glow', '.rb-main', '.rb-hi'] as const).map((s) =>
				sec.querySelector<SVGPathElement>(s)!
			);
			const head = sec.querySelector<SVGGElement>('.rb-head')!;
			const headDrop = head.querySelector<SVGEllipseElement>('.drop')!;
			const headShine = head.querySelector<SVGEllipseElement>('.shine')!;
			const top = sec.querySelector<HTMLElement>('.pour-head')!;
			const cup = sec.querySelector<HTMLElement>('.sini')!;
			const cards = [...sec.querySelectorAll<HTMLElement>('.step')];

			let len = 1;
			let prog = still ? 1 : 0;
			let shown = -1;

			/** Draw as much of the stream as the reader has scrolled through, with a drop at its tip. */
			const paint = () => {
				if (Math.abs(prog - shown) < 1e-4) return;
				shown = prog;
				const off = String(len * (1 - prog));
				for (const p of [glow, main, hi]) p.style.strokeDashoffset = off;
				const pt = main.getPointAtLength(len * prog);
				head.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
				head.style.opacity = prog > 0.002 && prog < 0.995 ? '1' : '0';
				full = prog > 0.985;
			};

			/** One smooth curve from under the title, weaving beside each card, into the cup. */
			const build = () => {
				const R = sec.getBoundingClientRect();
				const W = R.width;
				const H = R.height;
				svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
				grad.setAttribute('y2', String(H));
				const rw = W > 900 ? 30 : W > 600 ? 22 : 15;
				const P: [number, number][] = [[W / 2, top.getBoundingClientRect().bottom - R.top + 24]];
				cards.forEach((c, i) => {
					const r = c.getBoundingClientRect();
					const x0 = r.left - R.left;
					const x1 = r.right - R.left;
					const y = r.top - R.top + r.height / 2;
					let x: number;
					// beside the card when there is room, otherwise behind it, showing through the glass
					if (r.width < W * 0.62) x = x0 > W - x1 ? x0 * 0.5 : x1 + (W - x1) * 0.5;
					else x = i % 2 ? W * 0.8 : W * 0.2;
					P.push([x, y]);
				});
				const c = cup.getBoundingClientRect();
				P.push([c.left - R.left + c.width / 2, c.top - R.top + 12]);
				let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
				for (let k = 1; k < P.length; k++) {
					const [xa, ya] = P[k - 1];
					const [xb, yb] = P[k];
					const dy = yb - ya;
					d += ` C${xa.toFixed(1)} ${(ya + dy * 0.55).toFixed(1)} ${xb.toFixed(1)} ${(yb - dy * 0.55).toFixed(1)} ${xb.toFixed(1)} ${yb.toFixed(1)}`;
				}
				for (const p of [glow, main, hi]) p.setAttribute('d', d);
				glow.setAttribute('stroke-width', String(rw * 2.4));
				main.setAttribute('stroke-width', String(rw));
				hi.setAttribute('stroke-width', String(Math.max(2, rw * 0.16)));
				hi.setAttribute('transform', `translate(${(-rw * 0.24).toFixed(1)} 0)`);
				headDrop.setAttribute('rx', String(rw * 0.62));
				headDrop.setAttribute('ry', String(rw * 0.82));
				headShine.setAttribute('rx', String(rw * 0.16));
				headShine.setAttribute('ry', String(rw * 0.24));
				headShine.setAttribute('cx', String(-rw * 0.2));
				headShine.setAttribute('cy', String(-rw * 0.2));
				len = main.getTotalLength() || 1;
				for (const p of [glow, main, hi]) p.style.strokeDasharray = `${len} ${len + 10}`;
				shown = -1;
				paint();
			};

			const ctx = gsap.context(() => {
				if (still) return;
				const s = { v: 0 };
				// the stream trails the scroll a little, so it pours rather than jumps
				ScrollTrigger.create({
					trigger: sec,
					start: 'top 55%',
					end: 'bottom bottom',
					onUpdate: (self) =>
						gsap.to(s, {
							v: self.progress,
							duration: 0.6,
							ease: 'power2.out',
							overwrite: true,
							onUpdate: () => {
								prog = s.v;
								paint();
							}
						})
				});
				gsap.from(top.children, {
					y: 30,
					autoAlpha: 0,
					duration: 1,
					ease: 'expo.out',
					stagger: 0.08,
					scrollTrigger: { trigger: top, start: 'top 85%' }
				});
				for (const card of cards) {
					gsap.from(card, {
						y: 50,
						autoAlpha: 0,
						duration: 1.2,
						ease: 'expo.out',
						scrollTrigger: {
							trigger: card,
							start: 'top 88%',
							toggleActions: 'play none none reverse'
						}
					});
				}
			}, sec);

			build();
			let t: ReturnType<typeof setTimeout> | undefined;
			let lastW = sec.clientWidth;
			const ro = new ResizeObserver(() => {
				clearTimeout(t);
				t = setTimeout(() => {
					build();
					// only a width change moves the triggers; height changes come from images loading
					if (sec.clientWidth !== lastW) ScrollTrigger.refresh();
					lastW = sec.clientWidth;
				}, 150);
			});
			ro.observe(sec);

			return () => {
				clearTimeout(t);
				ro.disconnect();
				ctx.revert();
			};
		})
	);
</script>

{#if steps.length}
	<section class="pour" id="journey" bind:this={root} aria-labelledby="journey-title">
		<svg class="pour-svg" aria-hidden="true">
			<defs>
				<linearGradient
					id="journey-ribbon"
					gradientUnits="userSpaceOnUse"
					x1="0"
					y1="0"
					x2="0"
					y2="1000"
				>
					<stop offset="0" stop-color="#5a2b12" />
					<stop offset="0.35" stop-color="#8f4f24" />
					<stop offset="0.6" stop-color="#b8743a" />
					<stop offset="1" stop-color="#6a3517" />
				</linearGradient>
			</defs>
			<path
				class="rb-glow"
				fill="none"
				stroke="#c07a3e"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity="0.16"
			/>
			<path
				class="rb-main"
				fill="none"
				stroke="url(#journey-ribbon)"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				class="rb-hi"
				fill="none"
				stroke="#fff1de"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity="0.45"
			/>
			<g class="rb-head">
				<ellipse class="drop" rx="10" ry="13" fill="#7a4020" />
				<ellipse class="shine" rx="3" ry="4" fill="#fff4e4" opacity="0.7" />
			</g>
		</svg>

		<header class="pour-head">
			<p class="eyebrow">{content.eyebrow}</p>
			<h2 id="journey-title">{content.title} <span class="accent">{content.accent}</span></h2>
		</header>

		<ol class="steps">
			{#each steps as s, i (s.id)}
				<li class="step">
					<figure class="photo">
						{#if !broken[s.id]}
							<img
								src={s.photo.src}
								alt={s.photo.alt}
								loading="lazy"
								decoding="async"
								onerror={() => (broken = { ...broken, [s.id]: true })}
							/>
						{/if}
					</figure>
					<span class="num" aria-hidden="true">{roman(i)}</span>
					<h3>{s.title} <span class="accent">{s.accent}</span></h3>
					{#if s.text}<p>{s.text}</p>{/if}
				</li>
			{/each}
		</ol>

		<div class="pour-end">
			<!-- the sini, with the red tulip of the Kebena cup -->
			<svg class={['sini', { full }]} viewBox="0 0 120 80" aria-hidden="true">
				<defs>
					<clipPath id="journey-sini">
						<path d="M14 14 L106 14 Q102 64 74 70 L46 70 Q18 64 14 14Z" />
					</clipPath>
				</defs>
				<ellipse cx="60" cy="76" rx="40" ry="4" fill="#000" opacity="0.25" />
				<path
					d="M10 10 L110 10 Q106 68 76 74 L44 74 Q14 68 10 10Z"
					fill="#fffaf2"
					stroke="#e2c3a0"
					stroke-width="1.5"
				/>
				<g clip-path="url(#journey-sini)">
					<rect class="fill" x="0" y="18" width="120" height="60" fill="#3a1a0b" />
				</g>
				<ellipse cx="60" cy="10" rx="50" ry="4" fill="none" stroke="#d9a05b" stroke-width="1.5" />
				<g class="tulip">
					<path d="M60 58 V40" stroke="#5f7d4f" stroke-width="2" fill="none" />
					<path
						d="M60 50 q-7 -2 -9 -8 M60 50 q7 -2 9 -8"
						stroke="#5f7d4f"
						stroke-width="1.6"
						fill="none"
					/>
					<path
						d="M53 30 q2 8 7 10 q5 -2 7 -10 q-4 2 -7 -4 q-3 6 -7 4Z"
						fill="none"
						stroke="#c4493c"
						stroke-width="1.6"
					/>
				</g>
			</svg>
			<p>{content.end}</p>
		</div>
	</section>
{/if}

<style>
	.pour {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		padding: clamp(100px, 14vh, 160px) max(24px, calc((100% - 1200px) / 2)) clamp(60px, 10vh, 120px);
		background: var(--paper);
		color: var(--ink);
	}
	.pour-svg {
		position: absolute;
		inset: 0;
		z-index: -1;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.rb-head {
		opacity: 0;
	}

	.pour-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		text-align: center;
	}
	.eyebrow {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent-mark);
	}
	h2 {
		margin: 0;
		font-size: clamp(2.4rem, 4.6vw, 4.2rem);
		line-height: 1.05;
		font-weight: 400;
		letter-spacing: -0.03em;
		text-wrap: balance;
	}
	.accent {
		color: var(--caramel);
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: clamp(90px, 18vh, 200px);
		list-style: none;
		margin: clamp(80px, 14vh, 160px) 0 0;
		padding: 0;
	}
	/* frosted cards: the stream shows through them as it passes behind */
	.step {
		width: min(460px, 46%);
		padding: 12px 12px clamp(20px, 2.4vw, 30px);
		border-radius: 24px;
		background: color-mix(in srgb, var(--card) 62%, transparent);
		border: 1px solid var(--line);
		backdrop-filter: blur(18px) saturate(1.4);
		-webkit-backdrop-filter: blur(18px) saturate(1.4);
	}
	.step:nth-child(odd) {
		align-self: flex-start;
	}
	.step:nth-child(even) {
		align-self: flex-end;
	}
	.photo {
		margin: 0 0 20px;
		aspect-ratio: 16 / 10;
		border-radius: 14px;
		overflow: hidden;
		/* shown when a photo is missing, so the card keeps its shape */
		background: var(--well);
	}
	.photo img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.num,
	.step h3,
	.step p {
		margin-inline: clamp(10px, 1.4vw, 18px);
	}
	.num {
		display: block;
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.2em;
		color: var(--caramel);
	}
	.step h3 {
		margin-block: 10px;
		font-size: clamp(1.7rem, 2.6vw, 2.4rem);
		line-height: 1.1;
		font-weight: 400;
		letter-spacing: -0.02em;
		text-wrap: balance;
		overflow-wrap: anywhere;
	}
	.step p {
		margin-block: 0;
		font-size: 16px;
		line-height: 1.55;
		color: var(--ink-soft);
		text-wrap: pretty;
	}

	.pour-end {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		margin-top: clamp(70px, 12vh, 140px);
	}
	.sini {
		width: 120px;
		height: auto;
		overflow: visible;
	}
	.sini .fill {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		transform: scaleY(0);
		transition: transform 1.4s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.sini.full .fill {
		transform: none;
	}
	.pour-end p {
		margin: 0;
		font-size: clamp(1.4rem, 2.4vw, 2rem);
		color: var(--ink);
	}

	@media (max-width: 760px) {
		.step {
			width: 100%;
		}
		.steps {
			gap: 120px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sini .fill {
			transition: none;
		}
	}
</style>
