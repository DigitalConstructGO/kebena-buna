<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { m } from '#lib/i18n.ts';
	import { createRain } from './rain';
	import {
		buildHeroTimeline,
		CHAPTERS,
		FILM,
		INTRO,
		NURSERY,
		POUR,
		PROCESS,
		STEPS,
		type Clock
	} from './timeline';
	import { CLEAR, createScore, SCORE_SRC } from './score';

	/** The music under the story. Any track works; the dashboard will supply it. */
	let { scoreSrc = SCORE_SRC }: { scoreSrc?: string } = $props();

	let root: HTMLElement;
	let canvas: HTMLCanvasElement;
	let film: HTMLVideoElement;
	let nursery: HTMLVideoElement;
	/** The jebena and the cup: fetched a few seconds before its turn, not at page load. */
	let pour: HTMLVideoElement;
	let pourAsked = false;
	let ready = $state(false);
	let time = $state(0);
	let sound = $state(false);
	const current = $derived(CHAPTERS.findLastIndex((c) => time >= c.at - 0.05));

	let tl: gsap.core.Timeline | undefined;
	let onScreen = $state(true);
	const clock: Clock = { t: 0, nursery: 0 };
	let weather = { rain: 0 };
	let score: ReturnType<typeof createScore> | undefined;

	/** How fast the story is running: 1 is its own pace, negative is backwards, 0 is at rest. */
	let rate = 0;

	/**
	 * Hold a <video> on the story's frame. A seek that arrives while the last one is still
	 * decoding waits its turn.
	 */
	const wanted = new WeakMap<HTMLVideoElement, number>();
	const hold = (v: HTMLVideoElement | undefined, want: number) => {
		if (!v) return;
		if (!v.paused) v.pause();
		wanted.set(v, want);
		if (!v.seeking && Math.abs(v.currentTime - want) > 0.02) v.currentTime = want;
	};
	const settle = (e: Event) => {
		const v = e.currentTarget as HTMLVideoElement;
		if (!v.paused) return;
		const want = wanted.get(v);
		if (want !== undefined && Math.abs(v.currentTime - want) > 0.02) v.currentTime = want;
	};
	/**
	 * Keep a clip on the story. Every clip runs at story speed, so while the story runs forwards
	 * the clip simply plays (seeking every frame is what made it stutter) and is only nudged back
	 * if it drifts; backwards or at rest it is stepped.
	 */
	const track = (v: HTMLVideoElement, want: number, from: number, to: number) => {
		const t = tl ? tl.time() : 0;
		if (rate <= 0 || t < from || t > to - 0.1) return hold(v, want);
		const speed = Math.round(rate * 4) / 4;
		if (v.playbackRate !== speed) v.playbackRate = speed;
		if (!v.seeking && Math.abs(v.currentTime - want) > 0.25) v.currentTime = want;
		if (v.paused) void v.play().catch(() => {});
	};
	const syncFilm = () => {
		const t = tl ? tl.time() : 0;
		if (t < PROCESS + 0.8)
			track(film, Math.min(FILM.length - 0.08, clock.t), FILM.start, FILM.start + FILM.length);
		else if (!film.paused) film.pause();
		if (t < NURSERY.out + 0.6) track(nursery, clock.nursery, NURSERY.start, NURSERY.out + 0.5);
		else if (!nursery.paused) nursery.pause();
		if (!pourAsked && t > POUR.start - 6) {
			pourAsked = true;
			pour.preload = 'auto';
			pour.load();
			void pour
				.play()
				.then(() => pour.pause())
				.catch(() => {});
		}
		if (pourAsked && t > POUR.start - 1.2)
			track(
				pour,
				Math.min(POUR.length - 0.08, Math.max(0, t - POUR.start)),
				POUR.start,
				POUR.start + POUR.length
			);
	};

	/** Film and score both follow the story clock; the music plays for as long as the hero is in view. */
	const syncMedia = (force = false) => {
		syncFilm();
		score?.update(tl ? tl.time() : 0, onScreen, weather.rain, force);
	};

	const toggleSound = () => {
		if (!score) return;
		sound = !sound;
		if (sound) void score.enable();
		else score.disable();
	};

	onMount(() => {
		const { gsap, ScrollTrigger } = setupGsap();
		let ctx: gsap.Context | undefined;
		/** Paints the pour transitions; runs on the ticker so the liquid keeps moving while the scroll rests. */
		let liquid: (() => void) | undefined;
		/** Moves the story towards where the scroll wants it; runs on the ticker. */
		let drive: ((time: number, ms: number) => void) | undefined;
		let dead = false;
		const rain = createRain(canvas, () => null);
		weather = rain.state;
		score = createScore(scoreSrc);
		const s = score;

		// meters on the sound button and a soft pulse on the kick
		const bands = [0, 0, 0, 0];
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let avg = 0;
		let pulse = 0;
		const meter = () => {
			liquid?.();
			if (!sound && pulse < 0.002) {
				if (pulse !== 0) {
					pulse = 0;
					root.style.setProperty('--beat', '0');
				}
				return;
			}
			s.bands(bands);
			for (let k = 0; k < 4; k++) root.style.setProperty(`--b${k}`, bands[k].toFixed(3));
			// a kick is the low band jumping above its own recent level; the average rises fast so a fade-in never reads as a hit
			avg += (bands[0] - avg) * (bands[0] > avg ? 0.18 : 0.04);
			const t = tl ? tl.time() : 0;
			const kick = t > CLEAR ? Math.min(0.45, Math.max(0, (bands[0] - avg) * 4)) : 0;
			pulse = Math.max(kick, pulse * 0.9);
			root.style.setProperty('--beat', still ? '0' : pulse.toFixed(3));
		};
		gsap.ticker.add(meter);

		const io = new IntersectionObserver(([e]) => {
			onScreen = e.isIntersecting;
			if (tl) syncMedia(true);
		});
		io.observe(root);

		// the clips stay out of the HTML's download queue (preload="none") so on a slow line the page's
		// scripts and fonts arrive first; once hydrated, fetch them in story order
		nursery.preload = 'auto';
		film.preload = 'auto';
		nursery.load();
		film.load();
		const clips = [nursery, film, pour];
		clips.forEach((v) => v.addEventListener('seeked', settle));
		// iOS only lets a clip be stepped once it has been started: start each one and stop it at once
		const prime = (v: HTMLVideoElement) =>
			void v
				.play()
				.then(() => v.pause())
				.catch(() => {});
		prime(nursery);
		prime(film);

		const filmReady = new Promise<void>((res) => {
			if (film.readyState >= 3) return res();
			film.addEventListener('canplaythrough', () => res(), { once: true });
			setTimeout(res, 4000);
		});

		void Promise.all([document.fonts.ready, filmReady]).then(() => {
			if (dead) return;
			ctx = gsap.context(() => {
				const story = buildHeroTimeline(root, weather, clock);
				tl = story.tl;
				liquid = story.draw;
				if (import.meta.env.DEV) Object.assign(window, { __heroTl: tl, __heroScore: s });

				tl.eventCallback('onUpdate', () => {
					time = tl!.time();
					syncMedia();
					if (time < CLEAR) rain.start();
					else rain.stop();
				});

				const runway = document.querySelector<HTMLElement>('[data-hero-runway]');
				if (still || !runway || !runway.offsetHeight) {
					// less motion asked for, or no runway on this page: show the ending
					tl.progress(1);
				} else {
					// The scroll chooses where the story should be; the story then plays there at its own
					// pace instead of being dragged along at the speed of the wheel. Going down it moves
					// on to the next resting place, going up back to the last one; `SLACK` (story seconds)
					// keeps a twitch of the wheel from starting a scene.
					const { rests } = story;
					const end = story.tl.duration();
					const SLACK = 0.35;
					// opened at the top: the headline rains in by itself; opened further down: start there
					let target = INTRO;
					const aim = (p: number, dir: number) => {
						const at = INTRO + p * (end - INTRO);
						target =
							dir > 0
								? (rests.find((r) => r >= at - SLACK) ?? end)
								: (rests.findLast((r) => r <= at + SLACK) ?? INTRO);
						// out of sight there is nothing to watch: be there already
						if (!onScreen) story.tl.time(target);
					};
					const st = ScrollTrigger.create({
						trigger: runway,
						start: 'top bottom',
						end: 'bottom bottom',
						onUpdate: (self) => aim(self.progress, self.direction),
						onRefresh: (self) => aim(self.progress, 1)
					});
					aim(st.progress, 1);
					if (window.scrollY > 8) story.tl.time(target);

					// a scene plays at its own pace; when the scroll has run several scenes ahead the
					// story hurries to catch up, easing back to its own pace as it arrives
					drive = (_: number, ms: number) => {
						const now = story.tl.time();
						const gap = target - now;
						if (Math.abs(gap) < 0.001) {
							if (rate !== 0) {
								rate = 0;
								syncMedia();
							}
							return;
						}
						const speed = Math.min(5, Math.max(1, Math.abs(gap) / 3));
						const step = Math.min(Math.abs(gap), (speed * Math.min(ms, 100)) / 1000);
						rate = Math.sign(gap) * speed;
						story.tl.time(now + Math.sign(gap) * step);
					};
					gsap.ticker.add(drive);
				}
				ready = true;
			}, root);
		});

		return () => {
			dead = true;
			gsap.ticker.remove(meter);
			if (drive) gsap.ticker.remove(drive);
			s.destroy();
			score = undefined;
			io.disconnect();
			clips.forEach((v) => v.removeEventListener('seeked', settle));
			rain.destroy();
			ctx?.revert();
			tl = undefined;
		};
	});
</script>

<svelte:document onvisibilitychange={() => score?.pauseForHidden(document.hidden)} />

<!-- away: the full-screen film grain repaints every step, so it rests while the hero is out of view -->
<section
	class={['hero', { ready, sound, away: !onScreen }]}
	bind:this={root}
	aria-labelledby="hero-title"
>
	<div class="stage">
		<video
			class="nursery"
			bind:this={nursery}
			muted
			playsinline
			preload="none"
			poster="/hero/nursery-start.webp"
			disablepictureinpicture
			aria-hidden="true"
		>
			<source src="/hero/nursery-scroll-sm.mp4" type="video/mp4" media="(max-width: 899px)" />
			<source src="/hero/nursery-scroll.mp4" type="video/mp4" />
		</video>
		<video
			class="film"
			bind:this={film}
			muted
			playsinline
			preload="none"
			poster="/hero/film-start.webp"
			disablepictureinpicture
			aria-hidden="true"
		>
			<!-- encoded with a keyframe every few frames, so stepping through them on scroll stays smooth -->
			<source src="/hero/growth-scroll-sm.mp4" type="video/mp4" media="(max-width: 899px)" />
			<source src="/hero/growth-scroll.mp4" type="video/mp4" />
		</video>
		<video
			class="pour"
			bind:this={pour}
			muted
			playsinline
			preload="none"
			poster="/hero/cup-start.webp"
			disablepictureinpicture
			aria-hidden="true"
		>
			<source src="/hero/cup-scroll-sm.mp4" type="video/mp4" media="(max-width: 899px)" />
			<source src="/hero/cup-scroll.mp4" type="video/mp4" />
		</video>
		<!-- the liquid of the pour transitions, drawn each frame by the timeline's draw() -->
		<svg class="liquid" aria-hidden="true">
			<g class="lq-band">
				<path class="edge" />
				<path class="body" />
				<path class="core" />
				<path class="glint" />
			</g>
			<g class="lq-fall">
				<path class="edge" />
				<path class="body" />
				<path class="core" />
				<path class="glint" />
			</g>
			<!-- the bead at the front of the thread, in units of its half-width -->
			<g class="lq-head">
				<ellipse class="edge" rx="1.5" ry="1.14" />
				<ellipse class="body" cx="0.05" cy="0.08" rx="1.2" ry="0.84" />
				<ellipse class="core" cx="0.1" cy="0.2" rx="0.86" ry="0.52" />
				<ellipse class="glint" cx="-0.25" rx="0.6" ry="0.2" />
			</g>
		</svg>
		<canvas class="rain" bind:this={canvas} aria-hidden="true"></canvas>
		<div class="grain" aria-hidden="true"></div>
		<div class="vignette" aria-hidden="true"></div>
		<div class="pulse" aria-hidden="true"></div>
	</div>

	<div class="copy">
		<div class="lines">
			<h1 id="hero-title" class="line line-1" data-letter="borrow">{m.museum_hero_title()}</h1>
			<p class="line line-2" data-letter="borrow" aria-hidden="true">
				{m.museum_hero_line_nursery()}
			</p>
			<p class="line line-3" data-letter="borrow" aria-hidden="true">
				{m.museum_hero_line_tree()}
			</p>
			<p class="line line-flower" data-letter="borrow" aria-hidden="true">
				{m.museum_hero_line_flower()}
			</p>
			<p class="line line-4" data-letter="borrow" aria-hidden="true">
				{m.museum_hero_line_cherry()}
			</p>
			{#each STEPS as s (s.id)}
				<p class={['line', `line-${s.id}`]} data-letter="borrow" aria-hidden="true">{s.line()}</p>
			{/each}
			<p class="line line-5" data-letter="borrow" aria-hidden="true">{m.museum_hero_line_cup()}</p>
		</div>
		<p class="caption">
			<span class="sr-only">{m.museum_hero_caption()}</span>
			<span class="cap-text" aria-hidden="true">{m.museum_hero_caption()}</span>
		</p>
		<a class="cta" href="#visit">{m.museum_hero_cta()}</a>
	</div>

	<div class="controls">
		<div class="buttons">
			<button
				type="button"
				class="icon sound-btn"
				onclick={toggleSound}
				aria-pressed={sound}
				aria-label={sound ? m.museum_hero_sound_turn_off() : m.museum_hero_sound_turn_on()}
			>
				<span class="meter" aria-hidden="true">
					{#each [0, 1, 2, 3] as k (k)}
						<span style:--k={`var(--b${k}, 0)`}></span>
					{/each}
				</span>
				<span class="sound-label">{sound ? m.museum_hero_sound_on() : m.museum_hero_sound()}</span>
			</button>
			<span class={['cue', { gone: time > INTRO + 0.5 }]} aria-hidden="true">
				{m.museum_hero_scroll()}
				<svg viewBox="0 0 12 20" width="10" height="16">
					<path
						d="M6 1v17M1.5 13.5 6 18l4.5-4.5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</span>
		</div>
	</div>
	<span class="sr-only" aria-live="polite">
		{ready ? m.museum_hero_chapter({ n: current + 1, label: CHAPTERS[current].label() }) : ''}
	</span>
</section>

<style>
	.hero {
		--ink: #f4f8f3;
		--ink-soft: rgb(234 243 236 / 0.78);
		position: relative;
		--wrap: 1120px;
		height: 100svh;
		min-height: 360px;
		overflow: hidden;
		isolation: isolate;
		background: var(--color-forest-950);
		color: var(--ink);
	}
	.stage {
		position: absolute;
		inset: 0;
		/* the scenes tip back and forward in depth when one pours into the next */
		perspective: 1400px;
		opacity: 0;
		transition: opacity 0.9s ease;
	}
	.ready .stage {
		opacity: 1;
	}
	.film,
	.nursery,
	.pour {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 58% 50%;
		will-change: transform;
	}
	/* every scene after the first waits hidden; the timeline's draw() shows each one as it is poured in */
	.film {
		visibility: hidden;
	}
	.pour {
		visibility: hidden;
		object-position: 50% 50%;
	}
	.liquid {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		visibility: hidden;
		pointer-events: none;
	}
	.lq-head {
		opacity: 0;
	}
	.stage {
		scale: calc(1 + var(--beat, 0) * 0.006);
	}
	.pulse {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: #f3e3c4;
		mix-blend-mode: soft-light;
		opacity: calc(var(--beat, 0) * 0.22);
	}
	.rain {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.grain {
		position: absolute;
		inset: -8%;
		pointer-events: none;
		opacity: 0.045;
		mix-blend-mode: overlay;
		background: url('/hero/grain.png') 0 0 / 128px 128px;
		will-change: transform;
		animation: grain 0.9s steps(4) infinite;
	}
	.hero.away .grain {
		animation-play-state: paused;
	}
	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		/* legibility scrim behind the headline column, plus a soft floor for the controls */
		background:
			linear-gradient(90deg, rgb(6 16 11 / 0.66) 0%, rgb(6 16 11 / 0.36) 38%, transparent 62%),
			linear-gradient(0deg, rgb(6 16 11 / 0.45) 0%, transparent 22%);
	}
	@keyframes grain {
		0% {
			transform: translate(0, 0);
		}
		25% {
			transform: translate(-5%, 3%);
		}
		50% {
			transform: translate(3%, -5%);
		}
		75% {
			transform: translate(-2%, -3%);
		}
	}

	.copy {
		position: absolute;
		z-index: 5;
		left: max(32px, calc((100% - var(--wrap)) / 2));
		top: 50%;
		translate: 0 -46%;
		width: min(500px, 35%);
	}
	.lines {
		display: grid;
	}
	.line {
		grid-area: 1 / 1;
		margin: 0;
		font-size: clamp(2.8rem, 4.9vw, 5.2rem);
		line-height: 0.98;
		letter-spacing: -0.04em;
		font-weight: 520;
		color: var(--ink);
		text-wrap: balance;
		/* a soft shadow keeps the words off the bright frames of the film */
		text-shadow:
			0 1px 2px rgb(6 16 11 / 0.35),
			0 4px 28px rgb(6 16 11 / 0.45);
	}
	.line:not(.line-1) {
		visibility: hidden;
	}
	.caption {
		margin: 26px 0 0;
		font-size: 1.25rem;
		font-weight: 450;
		color: var(--ink-soft);
		text-shadow: 0 1px 12px rgb(6 16 11 / 0.5);
		visibility: hidden;
	}
	.cta {
		display: inline-flex;
		margin-top: 30px;
		padding: 15px 26px;
		border-radius: 12px;
		background: var(--color-forest-900);
		color: var(--color-mist-50);
		text-decoration: none;
		font-size: 16px;
		visibility: hidden;
		transition: background-color 0.2s;
	}
	.cta:hover {
		background: var(--color-forest-700);
	}

	.controls {
		position: absolute;
		z-index: 6;
		left: 50%;
		bottom: 24px;
		translate: -50% 0;
		width: min(var(--wrap), calc(100% - 32px));
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		gap: 20px;
	}
	.buttons {
		display: flex;
		gap: 8px;
	}
	.icon {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 12px;
		background: color-mix(in srgb, var(--ink) 14%, transparent);
		color: var(--ink);
		fill: currentColor;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.icon:hover {
		background: color-mix(in srgb, var(--ink) 24%, transparent);
	}
	.cue {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 6px;
		font-size: 13px;
		color: var(--ink-soft);
		transition: opacity 0.4s;
	}
	.cue.gone {
		opacity: 0;
	}
	.cue svg {
		animation: nudge 1.6s ease-in-out infinite;
	}
	@keyframes nudge {
		50% {
			transform: translateY(4px);
		}
	}
	.sound-btn {
		width: auto;
		display: flex;
		gap: 10px;
		padding: 0 16px 0 14px;
		font: inherit;
		font-size: 13px;
	}
	.sound-btn[aria-pressed='true'] {
		background: var(--color-lime-400);
		color: var(--color-forest-900);
	}
	.meter {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 16px;
	}
	.meter span {
		width: 3px;
		height: 16px;
		border-radius: 2px;
		background: currentColor;
		transform-origin: 50% 50%;
		scale: 1 calc(0.18 + var(--k) * 0.95);
	}
	.hero:not(.sound) .meter span:nth-child(odd) {
		scale: 1 0.3;
	}
	.hero:not(.sound) .meter span:nth-child(even) {
		scale: 1 0.55;
	}
	button:focus-visible,
	.cta:focus-visible {
		outline: 2px solid var(--color-lime-400);
		outline-offset: 3px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.nursery {
		/* the cutaway bag sits mid-frame; keep it just right of the headline */
		object-position: 40% 50%;
	}
	/* portrait: scene sits low, story on top. A media query (not a JS-measured class),
	   so the first server-rendered paint is already right and nothing shifts on hydration. */
	@media (max-aspect-ratio: 20 / 21) {
		.hero .vignette {
			background:
				linear-gradient(180deg, rgb(6 16 11 / 0.7) 0%, rgb(6 16 11 / 0.28) 40%, transparent 56%),
				linear-gradient(0deg, rgb(6 16 11 / 0.5) 0%, transparent 22%);
		}
		.hero .film {
			object-position: 64% 50%;
		}
		.hero .nursery {
			object-position: 50% 50%;
		}
		.hero .copy {
			top: 104px;
			translate: none;
			left: 24px;
			right: 24px;
			width: auto;
		}
		.hero .line {
			font-size: clamp(2.6rem, 11vw, 4rem);
		}
		.hero .sound-label {
			display: none;
		}
	}

	/* short landscape screens: phones on their side, small laptop windows, 200% zoom */
	@media (max-height: 560px) and (orientation: landscape) {
		.copy {
			top: 84px;
			translate: none;
			width: min(480px, 50%);
		}
		.line {
			font-size: clamp(1.9rem, 8.6vh, 3.1rem);
		}
		.caption {
			margin-top: 12px;
			font-size: 0.95rem;
		}
		.cta {
			margin-top: 14px;
			padding: 10px 18px;
		}
		.controls {
			bottom: 12px;
		}
		.sound-label {
			display: none;
		}
	}
	/* very wide screens: open the column up so the story doesn't sit in a small box */
	@media (min-width: 1800px) {
		.hero {
			--wrap: 1440px;
		}
		.copy {
			width: min(700px, 35%);
		}
		.line {
			font-size: clamp(5.2rem, 4vw, 6.4rem);
		}
		.caption {
			font-size: 1.45rem;
		}
	}

	/* phones: the grain holds still; a full-screen layer moving every frame is not worth the battery */
	@media (max-width: 899px), (pointer: coarse) {
		.grain {
			animation: none;
			will-change: auto;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cue {
			display: none;
		}
		.grain {
			animation: none;
		}
		.stage {
			transition: none;
		}
	}
</style>
