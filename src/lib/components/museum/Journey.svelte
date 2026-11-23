<script lang="ts">
	import { onMount } from 'svelte';
	import { srcsetFor } from '#lib/img.js';
	import { setupGsap } from '#lib/gsap.js';
	import { whenIdle } from '#lib/reveal.js';
	import ImageViewer from '@nahu/admin-kit/components/ImageViewer.svelte';
	import type { JourneyContent, JourneyStep } from '#lib/content/museum.js';
	import { m } from '#lib/i18n.ts';

	let { content }: { content: JourneyContent } = $props();

	const steps = $derived(content.steps);
	/** Steps grouped into acts: a step with an act title opens a new one. */
	const acts = $derived.by(() => {
		const out: { title?: string; start: number; steps: JourneyStep[] }[] = [];
		steps.forEach((s, i) => {
			if (s.act || !out.length) out.push({ title: s.act, start: i, steps: [] });
			out[out.length - 1].steps.push(s);
		});
		return out;
	});
	const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
	const roman = (i: number) => ROMAN[i] ?? String(i + 1);

	/**
	 * The stream is drawn as a few nested ribbons, the way light passes through a thread of
	 * coffee: amber at the thin edges, near black in the core, one narrow glint on the lit side.
	 * `w` is the share of the stream's half-width, `o` how far it leans towards the light.
	 */
	const LAYERS = [
		{ cls: 'edge', w: 1, o: 0 },
		{ cls: 'body', w: 0.78, o: -0.1 },
		{ cls: 'core', w: 0.5, o: -0.2 },
		{ cls: 'glint', w: 0.15, o: 0.5 }
	] as const;
	/** Light from the upper left, as it falls on the rest of the page. */
	const LX = -0.6;
	const LY = -0.8;
	/** Samples per piece of stream: finished pieces change rarely, only the one at the tip every frame. */
	const CH = 40;

	let root = $state<HTMLElement>();
	let broken = $state<Record<string, boolean>>({});
	/** A step's photo pressed opens all the steps' photos large, starting on that one. */
	let viewerOpen = $state(false);
	let viewerAt = $state(0);
	/** The cup fills once the stream reaches it. */
	let full = $state(false);
	/** The cup is on screen: only then do the ripples run. */
	let live = $state(false);

	// set up once the page is idle: none of this is visible on the first screen
	onMount(() =>
		whenIdle(() => {
			if (!root || !steps.length) return;
			const { gsap, ScrollTrigger } = setupGsap();
			const sec = root;
			const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

			const svg = sec.querySelector<SVGSVGElement>('.pour-svg')!;
			const main = sec.querySelector<SVGPathElement>('.rb-main')!;
			const groups = [...sec.querySelectorAll<SVGGElement>('.rb-layers > g')];
			const falls = [...sec.querySelectorAll<SVGPathElement>('.rb-fall path')];
			const fallClip = sec.querySelector<SVGRectElement>('#journey-fall-clip rect')!;
			const head = sec.querySelector<SVGGElement>('.rb-head')!;
			const headGlint = head.querySelector<SVGEllipseElement>('.glint')!;
			const top = sec.querySelector<HTMLElement>('.pour-head')!;
			const cup = sec.querySelector<HTMLElement>('.sini')!;
			const pourIn = cup.querySelector<SVGRectElement>('.pour-in')!;
			const cards = [...sec.querySelectorAll<HTMLElement>('.step')];
			const marks = [...sec.querySelectorAll<HTMLElement>('.act-title, .step')];
			const NS = 'http://www.w3.org/2000/svg';

			let len = 1;
			/** The last drop from spout to cup: where it starts, how far it falls, and what share of the pour it is. */
			let fx = 0;
			let fy = 0;
			let fh = 0;
			let fw = 1;
			let pFall = 1;
			let fp = still ? 1 : 0;
			let prog = still ? 1 : 0;
			let shown = -1;
			/** Samples along the stream, taken once per layout: centre, normal, half-width. */
			let n = 0;
			let cx = new Float32Array(0);
			let cy = new Float32Array(0);
			let nx = new Float32Array(0);
			let ny = new Float32Array(0);
			let hw = new Float32Array(0);
			/** Per layer, the two edges of its ribbon at every sample: x0 y0 x1 y1. */
			let edges: Float32Array[] = [];
			let pieces: string[][] = [];
			let dones: SVGPathElement[] = [];
			let tips: SVGPathElement[] = [];
			let done = -1;

			/** Where a layer sits across the stream: its offset from the centre and half-width. */
			const across = (L: (typeof LAYERS)[number], w: number, lit: number, s: number) => {
				// the glint comes and goes along the stream, as light catches a moving surface
				if (L.cls !== 'glint') return [L.o * w * lit, L.w * w] as const;
				const k = Math.max(
					0,
					0.25 + Math.sin(s / 41 + 2) * Math.sin(s / 157) + 0.3 * Math.sin(s / 13)
				);
				const o = L.o + 0.12 * Math.sin(s / 67);
				return [o * w * lit, L.w * w * Math.min(1, k)] as const;
			};
			const fmt = (v: number) => (Math.round(v * 10) / 10).toString();
			/** One closed ribbon from sample a to b, out along one edge and back along the other. */
			const ribbon = (E: Float32Array, a: number, b: number, tip?: number[]) => {
				let d = `M${fmt(E[a * 4])} ${fmt(E[a * 4 + 1])}`;
				for (let k = a + 1; k <= b; k++) d += ` ${fmt(E[k * 4])} ${fmt(E[k * 4 + 1])}`;
				if (tip) d += ` ${fmt(tip[0])} ${fmt(tip[1])} ${fmt(tip[2])} ${fmt(tip[3])}`;
				for (let k = b; k >= a; k--) d += ` ${fmt(E[k * 4 + 2])} ${fmt(E[k * 4 + 3])}`;
				return d + 'Z';
			};

			/** The fall from the spout: it speeds up and thins, and near the cup it starts to bead. */
			const drawFall = (t: number) => {
				if (fh <= 0) return;
				const m = Math.max(8, Math.ceil(fh / 4));
				const lit = -LX; // the normal of a straight drop points left
				LAYERS.forEach((L, li) => {
					let l = '';
					let r = '';
					for (let j = 0; j <= m; j++) {
						const d = (fh * j) / m;
						const u = d / fh;
						let w = fw * Math.pow(60 / (60 + d), 0.35);
						const bead = 0.22 * Math.max(0, Math.min(1, (u - 0.35) / 0.65)) ** 2;
						w *= 1 + bead * Math.sin(((d - t * 70) / (12 + d * 0.04)) * Math.PI * 2);
						const sway = 0.6 * u * u * Math.sin(t * 1.7 + d * 0.02);
						const [o, h] = across(L, w, lit, len + d);
						const x = fx + sway;
						const y = fy + d;
						l += `${j ? ' ' : 'M'}${fmt(x - (o - h))} ${fmt(y)}`;
						r = ` ${fmt(x - (o + h))} ${fmt(y)}` + r;
					}
					falls[li].setAttribute('d', l + r + 'Z');
				});
			};

			/** Draw as much of the stream as the reader has scrolled through, with a drop at its tip. */
			const paint = () => {
				// nothing to draw along until the stream has been laid out and sampled
				if (!n || Math.abs(prog - shown) < 1e-4) return;
				shown = prog;
				// the winding stream fills first, then the straight fall into the cup
				const mp = Math.min(1, prog / pFall);
				fp = pFall < 1 ? Math.min(1, Math.max(0, (prog - pFall) / (1 - pFall))) : 1;
				fallClip.setAttribute('height', (fh * fp).toFixed(1));
				const f = mp * (n - 1);
				const k = Math.min(n - 2, Math.floor(f));
				const u = f - k;
				const piece = Math.floor(k / CH);
				if (piece !== done) {
					pieces.forEach((row, li) => dones[li].setAttribute('d', row.slice(0, piece).join('')));
					done = piece;
				}
				// the piece at the tip, cut between two samples so the stream grows smoothly
				LAYERS.forEach((_, li) => {
					const E = edges[li];
					const tip = [0, 1, 2, 3].map((c) => E[k * 4 + c] + (E[k * 4 + 4 + c] - E[k * 4 + c]) * u);
					tips[li].setAttribute('d', ribbon(E, piece * CH, k, tip));
				});
				let x = cx[k] + (cx[k + 1] - cx[k]) * u;
				let y = cy[k] + (cy[k + 1] - cy[k]) * u;
				let a = Math.atan2(-nx[k], ny[k]);
				let w = hw[k] + (hw[k + 1] - hw[k]) * u;
				if (mp >= 1) {
					// on the fall the drop runs ahead of the thinning stream
					x = fx;
					y = fy + fh * fp;
					a = Math.PI / 2;
					w = fw * Math.pow(60 / (60 + fh * fp), 0.35);
				}
				const lit = nx[k] * LX + ny[k] * LY;
				headGlint.setAttribute('cy', (lit * 0.45).toFixed(2));
				if (Number.isFinite(x) && Number.isFinite(y))
					head.setAttribute(
						'transform',
						`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((a * 180) / Math.PI).toFixed(1)}) scale(${w.toFixed(2)})`
					);
				head.style.opacity = prog > 0.002 && fp < 0.97 ? '1' : '0';
				full = fp > 0.97;
			};

			/** One smooth curve from under the title, weaving beside each card, into the cup. */
			const build = () => {
				const R = sec.getBoundingClientRect();
				const W = R.width;
				const H = R.height;
				svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
				// a thread, not a pipe: the photos and words carry the section, the stream joins them
				const rw = W > 900 ? 9 : W > 600 ? 7 : 6;

				const P: [number, number][] = [[W / 2, top.getBoundingClientRect().bottom - R.top + 24]];
				// full-width cards leave a narrow lane on one side: the stream runs down it,
				// so it is seen in full and never crosses a card or a heading
				const first = cards[0]?.getBoundingClientRect();
				const stacked = !!first && first.width >= W * 0.62;
				const lane = !first
					? W / 2
					: first.left - R.left > R.right - first.right
						? (first.left - R.left) / 2
						: W - (R.right - first.right) / 2;
				let i = -1;
				for (const c of marks) {
					const r = c.getBoundingClientRect();
					if (c.classList.contains('act-title')) {
						// into the lane before the first heading, so the swing never crosses it
						if (stacked) P.push([lane, r.top - R.top - (i < 0 ? 14 : -r.height / 2)]);
						continue;
					}
					i++;
					const x0 = r.left - R.left;
					const x1 = r.right - R.left;
					const y = r.top - R.top + r.height / 2;
					if (stacked) {
						// a small meander, as a runnel of liquid never runs dead straight
						P.push([lane + (i % 2 ? 2.5 : -2.5), y]);
						continue;
					}
					P.push([x0 > W - x1 ? x0 * 0.5 : x1 + (W - x1) * 0.5, y]);
				}
				// the stream gathers above the cup, then falls straight down into it
				const c = cup.getBoundingClientRect();
				const last = cards.at(-1)?.getBoundingClientRect();
				const cupY = c.top - R.top + (c.height * 16) / 80;
				const lastY = last ? last.bottom - R.top : P[0][1];
				if (stacked && last) P.push([lane, lastY + 4]);
				fx = c.left - R.left + c.width / 2;
				fy = lastY + Math.max(0, cupY - lastY) * (stacked ? 0.62 : 0.18);
				fh = Math.max(0, cupY - fy);
				P.push([fx, fy]);
				let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
				for (let k = 1; k < P.length; k++) {
					const [xa, ya] = P[k - 1];
					const [xb, yb] = P[k];
					const dy = yb - ya;
					d += ` C${xa.toFixed(1)} ${(ya + dy * 0.55).toFixed(1)} ${xb.toFixed(1)} ${(yb - dy * 0.55).toFixed(1)} ${xb.toFixed(1)} ${yb.toFixed(1)}`;
				}
				main.setAttribute('d', d);
				len = main.getTotalLength() || 1;

				// sample the centreline about every 5px, with a width that wanders like real liquid
				n = Math.max(3, Math.ceil(len / 5) + 1);
				cx = new Float32Array(n);
				cy = new Float32Array(n);
				nx = new Float32Array(n);
				ny = new Float32Array(n);
				hw = new Float32Array(n);
				for (let k = 0; k < n; k++) {
					const q = main.getPointAtLength((len * k) / (n - 1));
					cx[k] = q.x;
					cy[k] = q.y;
				}
				for (let k = 0; k < n; k++) {
					const a = Math.max(0, k - 1);
					const b = Math.min(n - 1, k + 1);
					const tx = cx[b] - cx[a];
					const ty = cy[b] - cy[a];
					const m = Math.hypot(tx, ty) || 1;
					nx[k] = -ty / m;
					ny[k] = tx / m;
					const s = (len * k) / (n - 1);
					const wander =
						1 +
						0.17 * Math.sin(s / 61 + 1.3) +
						0.08 * Math.sin(s / 23 + 0.4) +
						0.04 * Math.sin(s / 9.7);
					// it starts as a trickle and gathers before the drop
					const grow = Math.min(1, 0.25 + s / 90);
					hw[k] = (rw / 2) * wander * grow;
				}
				fw = hw[n - 1];
				edges = LAYERS.map((L) => {
					const E = new Float32Array(n * 4);
					for (let k = 0; k < n; k++) {
						const lit = nx[k] * LX + ny[k] * LY;
						const [o, h] = across(L, hw[k], lit, (len * k) / (n - 1));
						E[k * 4] = cx[k] + nx[k] * (o - h);
						E[k * 4 + 1] = cy[k] + ny[k] * (o - h);
						E[k * 4 + 2] = cx[k] + nx[k] * (o + h);
						E[k * 4 + 3] = cy[k] + ny[k] * (o + h);
					}
					return E;
				});
				// finished pieces are fixed shapes joined into one path per layer, so their seams
				// fill as a single shape and never show
				const count = Math.ceil((n - 1) / CH);
				pieces = edges.map((E) =>
					Array.from({ length: count }, (_, p) => ribbon(E, p * CH, Math.min(n - 1, (p + 1) * CH)))
				);
				dones = groups.map(() => document.createElementNS(NS, 'path'));
				tips = groups.map(() => document.createElementNS(NS, 'path'));
				groups.forEach((g, li) => g.replaceChildren(dones[li], tips[li]));

				done = -1;
				drawFall(gsap.ticker.time);
				fallClip.setAttribute('x', String(fx - rw * 2));
				fallClip.setAttribute('y', String(fy - 1));
				fallClip.setAttribute('width', String(rw * 4));
				// the thin stream carries on inside the cup, down to the rising coffee
				const scale = c.width / 120;
				const inW = (2 * fw * Math.pow(60 / (60 + fh), 0.35)) / scale;
				pourIn.setAttribute('x', (60 - inW / 2).toFixed(2));
				pourIn.setAttribute('width', inW.toFixed(2));
				pFall = fh > 0 ? len / (len + fh * 1.6) : 1;
				shown = -1;
				paint();
			};

			// the fall stays alive while the cup is on screen: beads run down it, the foot sways
			const tick = () => {
				if (fp > 0) drawFall(gsap.ticker.time);
			};
			let ticking = false;
			const io = new IntersectionObserver(([e]) => {
				live = e.isIntersecting;
				if (still) return;
				if (live && !ticking) gsap.ticker.add(tick);
				if (!live && ticking) gsap.ticker.remove(tick);
				ticking = live;
			});
			io.observe(sec.querySelector('.pour-end')!);

			const ctx = gsap.context(() => {
				if (still) return;
				const s = { v: 0 };
				// the stream trails the scroll a little, so it pours rather than jumps;
				// quickTo reuses one tween instead of building a new one on every scroll event
				const pourTo = gsap.quickTo(s, 'v', {
					duration: 0.6,
					ease: 'power2.out',
					onUpdate: () => {
						prog = s.v;
						paint();
					}
				});
				ScrollTrigger.create({
					trigger: sec,
					start: 'top 55%',
					end: 'bottom bottom',
					onUpdate: (self) => pourTo(self.progress)
				});
				gsap.from(top.children, {
					y: 30,
					autoAlpha: 0,
					duration: 1,
					ease: 'expo.out',
					stagger: 0.08,
					scrollTrigger: { trigger: top, start: 'top 85%' }
				});
				// each card comes forward as it crosses the middle of the screen, then steps back
				const small = sec.clientWidth <= 760;
				cards.forEach((card, i) => {
					const face = card.querySelector('.face');
					if (!face) return;
					const tilt = i % 2 ? 2.5 : -2.5;
					const far = small ? 0.86 : 0.8;
					const near = small ? 1 : 1.07;
					gsap
						.timeline({
							defaults: { duration: 0.5 },
							scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 0.5 }
						})
						.fromTo(
							face,
							{ scale: far, rotation: tilt },
							{ scale: near, rotation: 0, ease: 'sine.out' }
						)
						.to(face, { scale: far, rotation: -tilt, ease: 'sine.in' });
				});
				for (const card of marks) {
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
				io.disconnect();
				gsap.ticker.remove(tick);
				ctx.revert();
			};
		})
	);
</script>

{#if steps.length}
	<section class="pour" id="journey" bind:this={root} aria-labelledby="journey-title">
		<svg class="pour-svg" aria-hidden="true">
			<defs>
				<clipPath id="journey-fall-clip" clipPathUnits="userSpaceOnUse">
					<rect x="0" y="0" width="0" height="0" />
				</clipPath>
			</defs>
			<!-- only the route: the stream itself is drawn from samples along it -->
			<path class="rb-main" fill="none" />
			<g class="rb-layers">
				<g class="edge"></g>
				<g class="body"></g>
				<g class="core"></g>
				<g class="glint"></g>
			</g>
			<g class="rb-fall" clip-path="url(#journey-fall-clip)">
				<path class="edge" />
				<path class="body" />
				<path class="core" />
				<path class="glint" />
			</g>
			<!-- the bead at the front of the stream, in units of its half-width -->
			<g class="rb-head">
				<ellipse class="edge" rx="1.5" ry="1.14" />
				<ellipse class="body" cx="0.05" cy="0.08" rx="1.2" ry="0.84" />
				<ellipse class="core" cx="0.1" cy="0.2" rx="0.86" ry="0.52" />
				<ellipse class="glint" cx="-0.25" rx="0.6" ry="0.2" />
			</g>
		</svg>

		<header class="pour-head">
			<p class="eyebrow">{content.eyebrow}</p>
			<h2 id="journey-title">{content.title} <span class="accent">{content.accent}</span></h2>
		</header>

		<div class="acts">
			{#each acts as act (act.start)}
				<div class="act">
					{#if act.title}<h3 class="act-title">{act.title}</h3>{/if}
					<ol class="steps" start={act.start + 1}>
						{#each act.steps as s, j (s.id)}
							{@const i = act.start + j}
							<li class={['step', { wide: s.wide }]}>
								<!-- the card itself: it grows as it reaches the middle of the screen, then falls back -->
								<div class="face">
									<div class="card-top" aria-hidden="true">
										<span class="num">{roman(i)}</span>
										<span class="suit">{m.home_journey_card_suit()}</span>
									</div>
									<figure class="photo">
										{#if !broken[s.id]}
											<button
												type="button"
												class="zoom"
												aria-label={m.home_view_larger({ title: `${s.title} ${s.accent}` })}
												onclick={() => {
													viewerAt = i;
													viewerOpen = true;
												}}
											>
												<img
													src={s.photo.src}
													srcset={srcsetFor(s.photo.src)}
													sizes={s.wide
														? '(min-width: 900px) 640px, 90vw'
														: '(min-width: 900px) 440px, 90vw'}
													alt={s.photo.alt}
													loading="lazy"
													decoding="async"
													onerror={() => (broken = { ...broken, [s.id]: true })}
												/>
											</button>
										{/if}
									</figure>
									<!-- one level under the act heading, or straight under the section's when there are no acts -->
									<svelte:element this={act.title ? 'h4' : 'h3'} class="step-title">
										{s.title} <span class="accent">{s.accent}</span>
									</svelte:element>
									{#if s.text}<p>{s.text}</p>{/if}
									<div class="band" aria-hidden="true"></div>
								</div>
							</li>
						{/each}
					</ol>
				</div>
			{/each}
		</div>

		<div class={['pour-end', { live }]}>
			<div class={['table', { full }]}>
				<!-- the bag this coffee came from, standing just behind the cup once it is poured -->
				<div class="bag">
					<img
						src="/hero/bag-front.jpg"
						alt={m.home_journey_bag_alt()}
						width="452"
						height="632"
						loading="lazy"
						decoding="async"
					/>
				</div>
				<!-- the sini, with the red tulip of the Kebena cup -->
				<svg class={['sini', { full }]} viewBox="0 0 120 80" aria-hidden="true">
					<defs>
						<clipPath id="journey-sini">
							<path d="M14 14 L106 14 Q102 64 74 70 L46 70 Q18 64 14 14Z" />
						</clipPath>
						<!-- crema: a golden ring of foam, darker where the stream lands -->
						<radialGradient id="journey-crema" cx="0.5" cy="0.5" r="0.5">
							<stop class="crema-in" offset="0" />
							<stop class="crema-mid" offset="0.55" />
							<stop class="crema-out" offset="1" />
						</radialGradient>
					</defs>
					<ellipse cx="60" cy="76" rx="40" ry="4" fill="#000" opacity="0.25" />
					<path
						d="M10 10 L110 10 Q106 68 76 74 L44 74 Q14 68 10 10Z"
						fill="#fffaf2"
						stroke="#e2c3a0"
						stroke-width="1.5"
					/>
					<!-- the stream carries on into the cup, down to the rising coffee -->
					<rect class="pour-in" x="59" y="10" width="2" height="60" />
					<g clip-path="url(#journey-sini)">
						<rect class="fill" x="0" y="18" width="120" height="60" fill="#3a1a0b" />
						<ellipse class="crema" cx="60" cy="18.6" rx="45" ry="3.4" fill="url(#journey-crema)" />
						<ellipse class="ripple" cx="60" cy="18.6" rx="6" ry="1.2" />
						<ellipse class="ripple" cx="60" cy="18.6" rx="6" ry="1.2" />
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
			</div>
			<p class="last">{content.end}</p>
			{#if content.next}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- in-page section link -->
				<a class="next" href={content.next.href}>
					{content.next.label} <span aria-hidden="true">→</span>
				</a>
			{/if}
		</div>
	</section>
	<ImageViewer
		bind:open={viewerOpen}
		bind:index={viewerAt}
		images={steps.map((s) => s.photo.src)}
		captions={steps.map((s) => `${s.title} ${s.accent}: ${s.photo.alt}`)}
		title={`${content.title} ${content.accent}`}
	/>
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
	/* the wall behind the pour: dotted streams (bookofshapes.com) falling slowly, in the theme's ink.
	   The layer is one tile taller than the section and slides down by exactly one tile, so the
	   loop has no seam and only a transform moves. */
	.pour::before {
		content: '';
		position: absolute;
		inset: -800px 0 0;
		z-index: -2;
		pointer-events: none;
		background: var(--accent-ink);
		opacity: 0.2;
		-webkit-mask: url('/art/flow-dots.svg') 50% 0 / 629.6px 800px repeat;
		mask: url('/art/flow-dots.svg') 50% 0 / 629.6px 800px repeat;
		animation: pour-fall 48s linear infinite;
		will-change: transform;
	}
	@keyframes pour-fall {
		to {
			transform: translateY(800px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pour::before {
			animation: none;
		}
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
	/* coffee from the palette: thin edges let the light through and go amber,
	   the core is near black, and a narrow glint runs along the lit side */
	.pour-svg,
	.sini {
		--stream-edge: color-mix(in oklab, var(--caramel) 90%, var(--paper));
		--stream-body: color-mix(in oklab, var(--caramel) 74%, black);
		--stream-core: color-mix(in oklab, var(--caramel) 42%, black);
		--stream-glint: color-mix(in oklab, var(--caramel) 40%, white);
	}
	/* on forest the light comes through from behind: a near-black core would read as a hollow tube */
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) :is(.pour-svg, .sini) {
			--stream-body: color-mix(in oklab, var(--caramel) 86%, black);
			--stream-core: color-mix(in oklab, var(--caramel) 66%, black);
		}
	}
	:global(:root[data-theme='dark']) :is(.pour-svg, .sini) {
		--stream-body: color-mix(in oklab, var(--caramel) 86%, black);
		--stream-core: color-mix(in oklab, var(--caramel) 66%, black);
	}
	.pour-svg .edge {
		fill: var(--stream-edge);
	}
	.pour-svg .body {
		fill: var(--stream-body);
	}
	.pour-svg .core {
		fill: var(--stream-core);
	}
	.pour-svg .glint {
		fill: var(--stream-glint);
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

	/* two acts, the farm and the ceremony: a wide breath between them, a closer cadence within */
	.acts {
		display: flex;
		flex-direction: column;
		gap: clamp(130px, 22vh, 240px);
		margin-top: clamp(80px, 14vh, 160px);
	}
	.act-title {
		/* only as wide as its words, so the stream can pass beside it */
		width: fit-content;
		max-width: 46%;
		margin: 0 0 clamp(32px, 5vh, 56px);
		font-size: clamp(2rem, 3.6vw, 3.2rem);
		line-height: 1.05;
		font-weight: 400;
		letter-spacing: -0.03em;
		text-wrap: balance;
	}
	.steps {
		display: flex;
		flex-direction: column;
		gap: clamp(64px, 12.6vh, 140px);
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.step {
		width: min(460px, 46%);
	}
	/* a playing card: double gold frame, number in the corner, the bag's line art along the foot */
	.face {
		position: relative;
		padding: 14px 14px 0;
		border-radius: 18px;
		background: var(--card);
		backdrop-filter: var(--glass-fx);
		-webkit-backdrop-filter: var(--glass-fx);
		border: 1.5px solid var(--gold);
		box-shadow:
			inset 0 0 0 5px var(--card),
			inset 0 0 0 6px var(--hair),
			0 26px 44px -30px rgb(25 33 27 / 0.55);
		overflow: hidden;
		will-change: transform;
	}
	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 4px 8px 12px;
	}
	.suit {
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.band {
		height: 46px;
		margin: clamp(18px, 2vw, 26px) -14px 0;
		border-top: 1px solid var(--hair);
		background: var(--accent-mark);
		opacity: 0.55;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='384' height='96' fill='none' stroke='%23000' stroke-width='2'%3E%3Cpath d='M14 96V48a34 34 0 0 1 68 0v48M28 96V48a20 20 0 0 1 40 0v48M42 96V50a6 6 0 0 1 12 0v46'/%3E%3Ccircle cx='144' cy='40' r='22'/%3E%3Ccircle cx='144' cy='40' r='10'/%3E%3Cpath d='M100 96l30-30 22 20 18-16 22 26M240 90C212 66 212 30 240 8c28 22 28 58 0 82ZM240 8v88M240 40l-14-12M240 40l14-12M240 62l-18-14M240 62l18-14M300 96V58h72v38M292 60l44-40 44 40M326 96V74h20v22'/%3E%3C/svg%3E")
			0 100% / auto 38px repeat-x;
	}
	.step:nth-child(odd) {
		align-self: flex-start;
	}
	.step:nth-child(even) {
		align-self: flex-end;
	}
	/* the roasting pan and the jebena: the moments the eye should rest on */
	.step.wide {
		width: min(640px, 56%);
	}
	.step.wide .photo {
		aspect-ratio: 3 / 2;
	}
	.photo {
		margin: 0 0 20px;
		aspect-ratio: 16 / 10;
		border-radius: 8px;
		border: 1px solid var(--hair);
		overflow: hidden;
		/* shown when a photo is missing, so the card keeps its shape */
		background: var(--well);
	}
	.zoom {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: none;
		cursor: zoom-in;
	}
	.zoom:focus-visible {
		outline: 2px solid var(--color-lime-400);
		outline-offset: -2px;
	}
	.photo img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.step-title,
	.step p {
		margin-inline: clamp(10px, 1.4vw, 18px);
	}
	.num {
		display: grid;
		place-items: center;
		min-width: 34px;
		height: 34px;
		padding-inline: 6px;
		border: 1px solid var(--gold);
		border-radius: 50%;
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.06em;
		color: var(--caramel);
	}
	.step-title {
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
		margin-top: clamp(170px, 28vh, 320px);
		text-align: center;
	}
	/* the cup stays on the centre line, where the stream lands; the bag stands off to one side */
	.table {
		position: relative;
		display: flex;
		justify-content: center;
		width: 100%;
	}
	.bag {
		position: absolute;
		bottom: 2%;
		inset-inline-start: calc(50% + clamp(190px, 22vw, 280px) * 0.3);
		z-index: -1;
		width: clamp(104px, 12.5vw, 172px);
		transform: rotate(5deg);
		transform-origin: 50% 100%;
		transition:
			opacity 0.9s ease 0.5s,
			transform 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.5s;
	}
	.pour-end.live .table:not(.full) .bag {
		opacity: 0;
		transform: translateY(18px) rotate(1deg);
	}
	/* a pouch: crimped seal along the top, a soft fold of light down one side */
	.bag::before {
		content: '';
		position: absolute;
		inset: -7% 0 auto;
		height: 8%;
		border-radius: 3px 3px 0 0;
		background: repeating-linear-gradient(90deg, #2f3b31 0 3px, #232d25 3px 6px);
	}
	.bag::after {
		content: '';
		position: absolute;
		inset: -7% 0 0;
		border-radius: 3px 3px 7px 7px;
		background: linear-gradient(
			90deg,
			rgb(25 33 27 / 0.28),
			transparent 14%,
			rgb(255 255 255 / 0.16) 30%,
			transparent 48%,
			transparent 82%,
			rgb(25 33 27 / 0.3)
		);
		box-shadow: 0 22px 26px -18px rgb(25 33 27 / 0.6);
		pointer-events: none;
	}
	.bag img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0 0 7px 7px;
	}
	.sini {
		width: clamp(190px, 22vw, 280px);
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
	.pour-in {
		fill: var(--stream-body);
		opacity: 0;
		transition: opacity 0.3s;
	}
	.sini.full .pour-in {
		opacity: 1;
	}
	.crema-in {
		stop-color: color-mix(in oklab, var(--caramel) 35%, #3a1a0b);
	}
	.crema-mid {
		stop-color: color-mix(in oklab, var(--caramel) 70%, #3a1a0b);
	}
	.crema-out {
		stop-color: color-mix(in oklab, var(--caramel) 85%, white);
	}
	/* the foam settles once the cup is full */
	.crema {
		opacity: 0;
		transition: opacity 1s 1.1s;
	}
	.sini.full .crema {
		opacity: 0.9;
	}
	/* rings spread from where the stream meets the coffee, only while the cup is on screen */
	.ripple {
		fill: none;
		stroke: var(--stream-glint);
		stroke-width: 0.5;
		opacity: 0;
		transform-box: fill-box;
		transform-origin: center;
	}
	/* they start once the coffee has risen, and stop when the cup scrolls away */
	.live .sini.full .ripple {
		animation: ripple 2.8s cubic-bezier(0.2, 0.6, 0.3, 1) 1.4s infinite;
	}
	.live .sini.full .ripple + .ripple {
		animation-delay: 2.8s;
	}

	@keyframes ripple {
		from {
			transform: scale(0.35);
			opacity: 0.8;
		}
		to {
			transform: scale(2.4);
			opacity: 0;
		}
	}
	.last {
		margin: clamp(28px, 4vh, 44px) 0 0;
		max-width: 14ch;
		font-size: clamp(2.6rem, 5.2vw, 4.8rem);
		line-height: 1.02;
		font-weight: 400;
		letter-spacing: -0.035em;
		color: var(--ink);
		text-wrap: balance;
	}
	.next {
		margin-top: calc(clamp(22px, 3vh, 32px) - 8px);
		margin-bottom: -8px;
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding-block: 6px;
		color: var(--accent-mark);
		font-size: 16px;
		text-decoration: none;
		white-space: nowrap;
	}
	.next:hover {
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.next:focus-visible {
		outline: 2px solid var(--accent-mark);
		outline-offset: 4px;
		border-radius: 2px;
	}

	@media (max-width: 760px) {
		/* a narrow lane on the starting side for the stream, so phones see the whole pour */
		.pour {
			padding-inline: 16px;
		}
		.acts {
			padding-inline-start: 22px;
		}
		.step,
		.step.wide {
			width: 100%;
		}
		.steps {
			gap: 84px;
		}
		.act-title {
			max-width: 70%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sini .fill,
		.pour-in,
		.crema,
		.bag {
			transition: none;
		}
		.ripple {
			display: none;
		}
	}
</style>
