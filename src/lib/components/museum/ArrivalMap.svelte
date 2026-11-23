<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { town, TOWN_H, TOWN_W } from './arrival-map.js';

	type Row = { label: string; value: string };
	type Action = { label: string; href: string; external?: boolean };

	/**
	 * The way to the museum, told as you scroll (after froservices.com's closing scene): a blurred
	 * street plan comes into focus around the museum's pin, the offerings pop up inside its ring,
	 * the plan tips back, the coffee cup building rises, and a sand wash brings in the headline with
	 * the address and the ways to get here. Without motion (or JavaScript) it is just that last frame.
	 */
	let {
		id,
		eyebrow,
		title,
		beats,
		tags,
		place,
		rows,
		actions,
		photo = '/tour/building.webp'
	}: {
		id?: string;
		eyebrow: string;
		title: string;
		/** The two captions read while the plan sharpens and while it tips back. */
		beats: [string, string];
		/** What waits inside: up to six, around the ring. */
		tags: string[];
		place: { name: string; area: string };
		rows: Row[];
		actions: Action[];
		/** The building, behind the headline: a backdrop, so it carries no description. */
		photo?: string;
	} = $props();

	const uid = $props.id();
	const plan = town();

	/** The title in up to three lines of about equal length; the last one is set large. */
	const lines = $derived.by(() => {
		const words = title.trim().split(/\s+/);
		if (words.length < 3) return [title];
		const target = title.length / 3;
		const out: string[] = [];
		let line = '';
		for (const w of words) {
			if (line && out.length < 2 && (line + ' ' + w).length > target * 1.15) {
				out.push(line);
				line = w;
			} else line = line ? `${line} ${w}` : w;
		}
		return [...out, line];
	});

	/** Where each tag sits around the ring, in degrees from three o'clock. */
	const ANGLES = [-148, -38, 14, 164, 62, -96];
	const shown = $derived(tags.slice(0, ANGLES.length));

	const linkFor = (v: string) =>
		/^\S+@\S+\.\S+$/.test(v)
			? `mailto:${v}`
			: /^\+?[\d\s-]{7,}$/.test(v)
				? `tel:${v.replace(/\s/g, '')}`
				: undefined;

	let root: HTMLElement;
	/** Jump to the end of the scene, where its links are, when a keyboard lands on one early. */
	let toEnd: (() => void) | undefined;

	onMount(() => {
		const { gsap } = setupGsap();
		const ctx = gsap.context(() => {
			const mm = gsap.matchMedia();
			// a short window cannot hold the scene's last frame; it gets the still version
			mm.add('(prefers-reduced-motion: no-preference) and (min-height: 560px)', () => {
				root.dataset.live = '';

				gsap.set('.am-plane', {
					autoAlpha: 1,
					scale: 1.25,
					rotationX: 0,
					transformPerspective: 1100,
					transformOrigin: '50% 50%'
				});
				gsap.set('.am-sharp', { opacity: 0 });
				gsap.set('.am-ring', { drawSVG: '0%' });
				gsap.set('.am-tag', { autoAlpha: 0, scale: 0.6 });
				gsap.set('.am-pin', { autoAlpha: 1 });
				gsap.set('.am-cap', { autoAlpha: 0, y: 30 });
				gsap.set('.am-photo', { clipPath: 'inset(100% 0% 0% 0%)' });
				gsap.set('.am-photo img', { scale: 1.18 });
				gsap.set('.am-flood', { clipPath: 'circle(0% at 0% 100%)' });
				gsap.set('.am-eyebrow', { autoAlpha: 0, y: 16 });
				gsap.set('.am-line > span', { yPercent: 110 });
				gsap.set('.am-main', { filter: 'blur(12px)', opacity: 0.45 });
				// opacity only, so the links stay reachable by keyboard
				gsap.set('.am-meta', { opacity: 0, y: 24 });

				const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });

				/*
				 * The scene reads its own place on every frame rather than through a ScrollTrigger: the
				 * pinned halls above it add their runways after this mounts, which would leave a trigger's
				 * start and end measured against the wrong page.
				 */
				const span = () => {
					const r = root.getBoundingClientRect();
					return { r, run: Math.max(1, r.height - window.innerHeight) };
				};
				let frame = 0;
				const follow = () => {
					frame = 0;
					const { r, run } = span();
					const p = Math.min(1, Math.max(0, -r.top / run));
					gsap.to(tl, { progress: p, duration: 0.6, ease: 'power3.out', overwrite: true });
				};
				const onScroll = () => {
					frame ||= requestAnimationFrame(follow);
				};
				window.addEventListener('scroll', onScroll, { passive: true });
				window.addEventListener('resize', onScroll);
				toEnd = () => {
					const { r, run } = span();
					if (-r.top < run * 0.97)
						window.scrollTo({ top: window.scrollY + r.top + run, behavior: 'instant' });
				};

				tl
					// 1. the plan comes into focus around the pin
					.to('.am-plane', { scale: 1, duration: 0.2, ease: 'power1.out' }, 0)
					.to('.am-sharp', { opacity: 1, duration: 0.16 }, 0.02)
					.to('.am-ring', { drawSVG: '100%', duration: 0.18, ease: 'power1.inOut' }, 0.1)
					.to(
						'.am-tag',
						{ autoAlpha: 1, scale: 1, duration: 0.08, stagger: 0.025, ease: 'back.out(2)' },
						0.16
					)
					.to('.am-cap[data-n="1"]', { autoAlpha: 1, y: 0, duration: 0.08 }, 0.12)
					// 2. it tips back, like looking up from the map
					.to('.am-cap[data-n="1"]', { autoAlpha: 0, y: -24, duration: 0.06 }, 0.34)
					.to('.am-tag', { autoAlpha: 0, duration: 0.06 }, 0.38)
					.to(
						'.am-plane',
						{ rotationX: 56, yPercent: 6, scale: 0.92, duration: 0.2, ease: 'power1.inOut' },
						0.36
					)
					.to('.am-cap[data-n="2"]', { autoAlpha: 1, y: 0, duration: 0.08 }, 0.42)
					// 3. the building rises where the pin was
					.to('.am-cap[data-n="2"]', { autoAlpha: 0, y: -24, duration: 0.05 }, 0.58)
					.to('.am-plane', { rotationX: 74, autoAlpha: 0, duration: 0.12 }, 0.58)
					.to('.am-pin', { autoAlpha: 0, duration: 0.06 }, 0.6)
					.to(
						'.am-photo',
						{ clipPath: 'inset(0% 0% 0% 0%)', duration: 0.16, ease: 'power2.out' },
						0.58
					)
					.to('.am-photo img', { scale: 1, duration: 0.2, ease: 'power2.out' }, 0.58)
					// 4. the headline, then the sand wash, then the way here
					.to('.am-flood', { clipPath: 'circle(160% at 0% 100%)', duration: 0.14 }, 0.68)
					.to('.am-eyebrow', { autoAlpha: 1, y: 0, duration: 0.05 }, 0.74)
					.to(
						'.am-line > span',
						{ yPercent: 0, duration: 0.07, stagger: 0.03, ease: 'power2.out' },
						0.75
					)
					.to('.am-main', { filter: 'blur(0px)', opacity: 1, duration: 0.1 }, 0.82)
					.to('.am-meta', { opacity: 1, y: 0, duration: 0.07, ease: 'power2.out' }, 0.88)
					.to({}, { duration: 0.03 });
				tl.progress(Math.min(1, Math.max(0, -span().r.top / span().run)));

				return () => {
					window.removeEventListener('scroll', onScroll);
					window.removeEventListener('resize', onScroll);
					cancelAnimationFrame(frame);
					gsap.killTweensOf(tl);
					delete root.dataset.live;
					toEnd = undefined;
				};
			});
		}, root);
		return () => ctx.revert();
	});
</script>

<section class="am" {id} bind:this={root} aria-labelledby="{uid}-title">
	<div class="am-stage">
		<div class="am-ground" aria-hidden="true">
			<div class="am-plane">
				<svg
					class="am-map am-soft"
					viewBox="0 0 {TOWN_W} {TOWN_H}"
					preserveAspectRatio="xMidYMid slice"
				>
					<use href="#{uid}-town" />
				</svg>
				<svg
					class="am-map am-sharp"
					viewBox="0 0 {TOWN_W} {TOWN_H}"
					preserveAspectRatio="xMidYMid slice"
				>
					<defs>
						<g id="{uid}-town">
							<rect class="t-ground" x="-200" y="-200" width={TOWN_W + 400} height={TOWN_H + 400} />
							{#each plan.parks as p, i (i)}
								<rect class="t-park" x={p.x} y={p.y} width={p.w} height={p.h} rx="10" />
							{/each}
							<g class="t-minor">
								{#each plan.minor as d, i (i)}<path {d} />{/each}
							</g>
							{#each plan.blocks as b, i (i)}
								<rect
									class={b.hi ? 't-hi' : 't-block'}
									x={b.x}
									y={b.y}
									width={b.w}
									height={b.h}
									rx="4"
								/>
							{/each}
							<path class="t-bank" d={plan.river} />
							<path class="t-river" d={plan.river} />
							<g class="t-major">
								{#each plan.major as d, i (i)}<path {d} />{/each}
							</g>
							<path class="t-dash" d={plan.major[0]} />
						</g>
					</defs>
					<use href="#{uid}-town" />
				</svg>
				<div class="am-radius">
					<svg viewBox="0 0 100 100">
						<circle class="am-fill" cx="50" cy="50" r="48" />
						<circle class="am-ring" cx="50" cy="50" r="48" />
					</svg>
					{#each shown as t, i (t)}
						<span class="am-tag" style:--a="{ANGLES[i]}deg">{t}</span>
					{/each}
				</div>
			</div>
			<div class="am-pin">
				<svg viewBox="0 0 40 52" width="40" height="52">
					<path class="pin-tail" d="M12 34 20 50 28 34Z" />
					<circle class="pin-head" cx="20" cy="20" r="17" />
					<circle class="pin-eye" cx="20" cy="20" r="7" />
				</svg>
				<span class="am-place">
					<b>{place.name}</b>
					<small>{place.area}</small>
				</span>
			</div>
		</div>

		{#each beats as b, i (i)}
			<p class={['am-cap', { long: b.length > 40 }]} data-n={i + 1}>{b}</p>
		{/each}

		<figure class="am-photo">
			<img src={photo} alt="" loading="lazy" decoding="async" />
		</figure>
		<div class="am-flood" aria-hidden="true"></div>

		<div class="am-final">
			<p class="am-eyebrow">{eyebrow}</p>
			<h2 class="am-title" id="{uid}-title">
				{#each lines as l, i (i)}
					<span class={['am-line', { 'am-last': i === lines.length - 1 && lines.length > 1 }]}>
						<span class={{ 'am-main': i === lines.length - 1 }}>{l}</span>
					</span>
				{/each}
			</h2>
			<div class="am-meta" onfocusin={() => toEnd?.()}>
				<dl>
					{#each rows as r (r.label)}
						{@const href = linkFor(r.value)}
						<div>
							<dt>{r.label}</dt>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- mailto: and tel: links -->
							<dd>
								{#if href}<a {href}>{r.value}</a>{:else}{r.value}{/if}
							</dd>
						</div>
					{/each}
				</dl>
				<div class="am-actions">
					{#each actions as a, i (a.href)}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the parent passes resolved or external links -->
						<a
							class={['am-btn', { primary: i === 0 }]}
							href={a.href}
							target={a.external ? '_blank' : undefined}
							rel={a.external ? 'noopener noreferrer' : undefined}
						>
							{a.label}
						</a>
					{/each}
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	/* the town's colours, in the museum's paper and forest */
	.am {
		--m-ground: #efdcb8;
		--m-block: #e4c99a;
		--m-hi: #f3e4c8;
		--m-street: #fbf2e1;
		--m-park: #c8d4a0;
		--m-water: #9fc3cb;
		--m-ring: var(--caramel);
		--m-mark: var(--color-forest-900);
		--m-mark-ink: var(--color-mist-50);
		--gold: var(--color-lime-400);
		/* the frosted glass behind the headline, and the ink on it */
		--wash: 244 228 196;
		--wash-alpha: 0.62;
		--wash-edge: rgb(255 255 255 / 0.55);
		--f-ink: var(--color-forest-950);
		--f-soft: rgb(35 45 37 / 0.72);
		--f-line: rgb(35 45 37 / 0.22);
		--f-accent: var(--color-leaf-700);
		--f-on-ink: var(--color-mist-50);
		--f-hover: rgb(35 45 37 / 0.1);
		--photo-dim: none;
		position: relative;
		isolation: isolate;
		color: var(--ink);
	}
	:global([data-theme='dark']) .am {
		--m-ground: #1b231d;
		--m-block: #27322a;
		--m-hi: #2f3b31;
		--m-street: #36443a;
		--m-park: #2b3e2e;
		--m-water: #24424b;
		--m-mark: var(--color-mist-50);
		--m-mark-ink: var(--color-forest-900);
		--wash: 25 33 27;
		--wash-alpha: 0.6;
		--wash-edge: rgb(255 255 255 / 0.12);
		--f-ink: #f4ebd9;
		--f-soft: rgb(244 235 217 / 0.72);
		--f-line: rgb(244 235 217 / 0.2);
		--f-accent: var(--color-lime-300);
		--f-on-ink: var(--color-forest-950);
		--f-hover: rgb(244 235 217 / 0.12);
		--photo-dim: brightness(0.72) saturate(0.9);
	}
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .am {
			--m-ground: #1b231d;
			--m-block: #27322a;
			--m-hi: #2f3b31;
			--m-street: #36443a;
			--m-park: #2b3e2e;
			--m-water: #24424b;
			--m-mark: var(--color-mist-50);
			--m-mark-ink: var(--color-forest-900);
			--wash: 25 33 27;
			--wash-alpha: 0.6;
			--wash-edge: rgb(255 255 255 / 0.12);
			--f-ink: #f4ebd9;
			--f-soft: rgb(244 235 217 / 0.72);
			--f-line: rgb(244 235 217 / 0.2);
			--f-accent: var(--color-lime-300);
			--f-on-ink: var(--color-forest-950);
			--f-hover: rgb(244 235 217 / 0.12);
			--photo-dim: brightness(0.72) saturate(0.9);
		}
	}

	/* ── Still (and the scene's last frame): the building, the sand wash and the way here ── */
	.am-stage {
		position: relative;
		min-height: 100svh;
		overflow: hidden;
		display: grid;
	}
	.am-ground,
	.am-cap {
		visibility: hidden;
	}
	/* ── Live: a tall runway, and the stage holds still on it while the scene plays ── */
	.am:global([data-live]) {
		height: 480svh;
	}
	.am:global([data-live]) .am-stage {
		position: sticky;
		top: 0;
		height: 100svh;
		min-height: 0;
	}
	.am:global([data-live]) .am-ground {
		visibility: visible;
	}

	.am-ground {
		/* where the museum sits across the screen: right of centre, clear of the captions */
		--px: 64%;
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: var(--m-ground);
		perspective: 1100px;
	}
	.am-plane {
		position: absolute;
		inset-block: -30%;
		left: calc(var(--px) - 75%);
		width: 150%;
		opacity: 0;
		/* the far side melts into haze once the plan tips back */
		mask-image: linear-gradient(to bottom, transparent, #000 18%);
		will-change: transform;
	}
	.am-map {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.am-soft {
		filter: blur(10px);
	}
	.t-ground {
		fill: var(--m-ground);
	}
	.t-park {
		fill: var(--m-park);
	}
	.t-block {
		fill: var(--m-block);
	}
	.t-hi {
		fill: var(--m-hi);
	}
	.t-minor path,
	.t-major path,
	.t-bank,
	.t-river,
	.t-dash {
		fill: none;
		stroke-linecap: round;
	}
	.t-minor path {
		stroke: var(--m-street);
		stroke-width: 14;
	}
	.t-major path {
		stroke: var(--m-street);
		stroke-width: 30;
	}
	.t-dash {
		stroke: var(--m-ring);
		stroke-width: 2.5;
		stroke-dasharray: 18 14;
		opacity: 0.7;
	}
	.t-bank {
		stroke: var(--m-street);
		stroke-width: 62;
	}
	.t-river {
		stroke: var(--m-water);
		stroke-width: 44;
	}
	/* the ring around the museum, and what waits inside it */
	.am-radius {
		position: absolute;
		left: 50%;
		top: 50%;
		width: clamp(240px, 46vmin, 440px);
		aspect-ratio: 1;
		translate: -50% -50%;
	}
	.am-radius svg {
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.am-fill {
		fill: var(--m-ring);
		opacity: 0.08;
	}
	.am-ring {
		fill: none;
		stroke: var(--m-ring);
		vector-effect: non-scaling-stroke;
		stroke-width: 1.6px;
	}
	.am-tag {
		position: absolute;
		left: calc(50% + cos(var(--a)) * 44%);
		top: calc(50% + sin(var(--a)) * 44%);
		translate: -50% -50%;
		padding: 6px 11px;
		border-radius: 8px;
		background: var(--m-mark);
		color: var(--m-mark-ink);
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		box-shadow: 0 6px 16px rgb(25 33 27 / 0.25);
		opacity: 0;
	}
	.am-pin {
		position: absolute;
		left: var(--px);
		top: 50%;
		display: grid;
		justify-items: center;
		gap: 8px;
		translate: -50% -48px;
		filter: drop-shadow(0 8px 10px rgb(25 33 27 / 0.3));
	}
	.pin-head {
		fill: var(--m-mark);
	}
	.pin-eye {
		fill: var(--m-mark-ink);
	}
	.pin-tail {
		fill: var(--gold);
	}
	.am-place {
		display: grid;
		justify-items: center;
		padding: 7px 12px;
		border-radius: 10px;
		background: var(--glass-strong, var(--card));
		backdrop-filter: var(--glass-fx);
		-webkit-backdrop-filter: var(--glass-fx);
		color: var(--ink-strong);
		white-space: nowrap;
	}
	.am-place b {
		font-size: 13px;
		font-weight: 600;
	}
	.am-place small {
		font-size: 11px;
		color: var(--ink-soft);
	}
	.am-cap {
		position: absolute;
		inset-inline-start: max(var(--gutter, 16px), (100% - 1120px) / 2);
		top: 50%;
		translate: 0 -50%;
		max-width: min(7.5em, 36%);
		margin: 0;
		font-family: var(--font-display);
		font-stretch: 75%;
		font-weight: 700;
		font-size: clamp(32px, 4.6vw, 64px);
		line-height: 0.95;
		letter-spacing: -0.01em;
		color: var(--ink-strong);
		text-shadow: 0 0 24px var(--m-ground);
	}

	.am-cap.long {
		max-width: min(12em, 36%);
		font-size: clamp(26px, 2.9vw, 42px);
	}

	.am-photo {
		position: absolute;
		inset: 0;
		margin: 0;
		overflow: hidden;
	}
	.am-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* the building to the right, the sky and hills behind the glass */
		object-position: 0% 50%;
		filter: var(--photo-dim);
		transition: filter 0.3s;
	}
	/* frosted glass from the bottom-left corner, thinning out before the building on the right */
	.am-flood {
		--fade: linear-gradient(100deg, #000 0 40%, rgb(0 0 0 / 0.75) 48%, transparent 62%);
		position: absolute;
		inset: 0;
		background:
			linear-gradient(160deg, var(--wash-edge), transparent 40%),
			rgb(var(--wash) / var(--wash-alpha));
		backdrop-filter: blur(22px) saturate(140%);
		-webkit-backdrop-filter: blur(22px) saturate(140%);
		mask-image: var(--fade);
	}
	.am-final {
		position: relative;
		align-self: center;
		display: grid;
		gap: clamp(18px, 2.4vw, 28px);
		width: min(1120px, calc(100% - 2 * var(--gutter, 16px)));
		margin-inline: auto;
		padding-block: 96px 48px;
		color: var(--f-ink);
	}
	.am-eyebrow {
		margin: 0;
		font-family: var(--font-display);
		font-stretch: 75%;
		font-weight: 600;
		font-size: 13px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.am-title {
		display: grid;
		max-width: 11em;
		margin: 0;
		font-family: var(--font-display);
		font-stretch: 75%;
		font-weight: 700;
		font-size: clamp(40px, 5.4vw, 76px);
		line-height: 0.95;
		letter-spacing: -0.01em;
		text-transform: uppercase;
		color: var(--f-ink);
	}
	.am-line {
		display: block;
		overflow: hidden;
		padding-block-end: 0.06em;
	}
	.am-line > span {
		display: inline-block;
	}
	.am-line:nth-child(2):not(.am-last) {
		padding-inline-start: 1.4em;
	}
	.am-last {
		font-size: 1.45em;
		color: var(--f-accent);
	}
	.am-meta {
		display: grid;
		gap: 22px;
		max-width: 560px;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px 28px;
		margin: 0;
	}
	dl div {
		padding-block-start: 10px;
		border-block-start: 1px solid var(--f-line);
	}
	dt {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--f-soft);
	}
	dd {
		margin: 2px 0 0;
		font-size: 15px;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}
	dd a {
		color: inherit;
		text-underline-offset: 3px;
	}
	.am-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.am-btn {
		display: inline-flex;
		align-items: center;
		min-height: 46px;
		padding-inline: 22px;
		border: 1.5px solid var(--f-ink);
		border-radius: 999px;
		color: var(--f-ink);
		font-size: 15px;
		font-weight: 600;
		text-decoration: none;
		transition:
			background-color 0.2s,
			color 0.2s;
	}
	.am-btn:hover {
		background: var(--f-hover);
	}
	.am-btn.primary {
		background: var(--f-ink);
		color: var(--f-on-ink);
	}
	.am-btn.primary:hover {
		opacity: 0.88;
	}
	.am-btn:focus-visible,
	dd a:focus-visible {
		outline: 2px solid var(--f-ink);
		outline-offset: 3px;
	}

	/* phones: the building along the bottom, the sand above it */
	@media (max-width: 760px) {
		.am-ground {
			--px: 50%;
		}
		.am-photo img {
			object-position: 62% 50%;
		}
		.am-flood {
			--fade: linear-gradient(180deg, #000 0 60%, rgb(0 0 0 / 0.7) 68%, transparent 84%);
		}
		.am-final {
			align-self: start;
			padding-block: 84px 40px;
		}
		.am-meta {
			gap: 18px;
		}
		dl {
			gap: 10px 18px;
		}
		dd {
			font-size: 14px;
		}
		.am-cap,
		.am-cap.long {
			top: 16%;
			translate: none;
			max-width: calc(100% - 32px);
		}
		.am-tag {
			font-size: 12px;
			padding: 5px 9px;
		}
	}
	@media (max-width: 420px) {
		dl {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
