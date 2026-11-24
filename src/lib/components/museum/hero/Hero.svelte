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
	import { createStageGL } from './stage-gl';

	/** The music under the story. Any track works; the dashboard will supply it. */
	let { scoreSrc = SCORE_SRC }: { scoreSrc?: string } = $props();

	let root: HTMLElement;
	/** The beat and the meter levels are set on these, not on root: a property set on root restyles every letter of the story. */
	let stage: HTMLElement;
	let meterEl: HTMLElement;
	let canvas: HTMLCanvasElement;
	/** The scenes, drawn by WebGL; the <video>s under it only hand it their frames. */
	let scenesCanvas: HTMLCanvasElement;
	let onCanvas = $state(false);
	let copyEl: HTMLElement;
	let film: HTMLVideoElement;
	let nursery: HTMLVideoElement;
	/** The jebena and the cup: fetched a few seconds before its turn, not at page load. */
	let pour: HTMLVideoElement;
	let pourAsked = false;
	let ready = $state(false);
	let time = $state(0);
	let sound = $state(false);
	const current = $derived(CHAPTERS.findLastIndex((c) => time >= c.at - 0.05));

	/**
	 * The chapter rail: one mark for each of the story's resting places (the cherries have none,
	 * the coffee is already falling), named for the chapter it rests in. Set once the story is built.
	 */
	let marks = $state<{ label: string; at: number; rest: number }[]>([]);
	/** Scrolls to a mark's resting place; the story cuts there. Unset when the story doesn't follow the scroll. */
	let jump = $state<(rest: number) => void>();
	const railNow = $derived(marks.findLastIndex((k) => time >= k.at - 0.05));
	/** How far along the rail the story is, 0..1, moving between marks as it plays. */
	const railFill = $derived.by(() => {
		const k = marks.findLastIndex((mk) => time >= mk.rest);
		if (k < 0 || marks.length < 2) return 0;
		const next = marks[k + 1];
		const part = next ? Math.min(1, (time - marks[k].rest) / (next.rest - marks[k].rest)) : 0;
		return (k + part) / (marks.length - 1);
	});

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
		// never past the clip's last frame: a time the clip cannot reach is never arrived at, and
		// the seek was then asked for again on every frame, which showed as a flicker
		if (Number.isFinite(v.duration)) want = Math.max(0, Math.min(want, v.duration - 0.05));
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
	/** Clips the browser won't play on their own (iOS in Low Power Mode): those are always stepped. */
	const stepped = new WeakSet<HTMLVideoElement>();
	const track = (v: HTMLVideoElement, want: number, from: number, to: number) => {
		const t = tl ? tl.time() : 0;
		// a clip that has reached its end is held there: play() on an ended clip starts it over
		const done = Number.isFinite(v.duration) && want >= v.duration - 0.08;
		if (stepped.has(v) || rate <= 0 || t < from || t > to - 0.1 || done) return hold(v, want);
		const speed = Math.round(rate * 4) / 4;
		if (v.playbackRate !== speed) v.playbackRate = speed;
		if (!v.seeking && Math.abs(v.currentTime - want) > 0.25) v.currentTime = want;
		// a pause that lands before play() settles rejects it too (AbortError); only a refusal counts
		if (v.paused)
			void v.play().catch((e: unknown) => {
				if (e instanceof DOMException && e.name === 'NotAllowedError') stepped.add(v);
			});
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
			if (onScreen) liquid?.();
			if (!sound && pulse < 0.002) {
				if (pulse !== 0) {
					pulse = 0;
					stage.style.setProperty('--beat', '0');
				}
				return;
			}
			s.bands(bands);
			for (let k = 0; k < 4; k++) meterEl.style.setProperty(`--b${k}`, bands[k].toFixed(3));
			// a kick is the low band jumping above its own recent level; the average rises fast so a fade-in never reads as a hit
			avg += (bands[0] - avg) * (bands[0] > avg ? 0.18 : 0.04);
			const t = tl ? tl.time() : 0;
			const kick = t > CLEAR ? Math.min(0.45, Math.max(0, (bands[0] - avg) * 4)) : 0;
			pulse = Math.max(kick, pulse * 0.9);
			stage.style.setProperty('--beat', still ? '0' : pulse.toFixed(3));
		};
		gsap.ticker.add(meter);

		// in view, and not behind the museum picture that comes up over the last scene: while that
		// covers the whole screen the films, the canvas and the grain have nobody watching them
		// while the film is on screen the page's glass (menu, floor-plan sign) goes without its
		// blur: frosting a moving picture again on every frame is what made the scroll drag
		// (marked on those few surfaces themselves: a flag on the page root restyles the whole page)
		let glass: HTMLElement[] | undefined;
		const filming = (on: boolean) => {
			glass ??= [
				...document.querySelectorAll<HTMLElement>('header *, nav, nav *, button.sign')
			].filter((el) => getComputedStyle(el).backdropFilter !== 'none');
			for (const el of glass) el.toggleAttribute('data-film', on);
		};
		filming(true);
		let inView = true;
		let covered = false;
		const see = () => {
			const now = inView && !covered;
			if (now === onScreen) return;
			onScreen = now;
			filming(now);
			if (tl) syncMedia(true);
		};
		const io = new IntersectionObserver(([e]) => {
			inView = e.isIntersecting;
			see();
		});
		io.observe(root);
		const onCover = (e: Event) => {
			covered = !!(e as CustomEvent<boolean>).detail;
			see();
		};
		window.addEventListener('kb:hero-covered', onCover);

		// the clips stay out of the HTML's download queue (preload="none") so on a slow line the page's
		// scripts and fonts arrive first; once hydrated, fetch them in story order
		// (one at a time: asked for together, the long growth film took the line from the nursery
		// clip the story opens on, and a phone waited for both)
		nursery.preload = 'auto';
		nursery.load();
		let filmAsked = false;
		const askFilm = () => {
			if (filmAsked || dead) return;
			filmAsked = true;
			film.preload = 'auto';
			film.load();
			prime(film);
		};
		nursery.addEventListener('canplaythrough', askFilm, { once: true });
		const filmLater = setTimeout(askFilm, 4000);
		const clips = [nursery, film, pour];
		clips.forEach((v) => v.addEventListener('seeked', settle));
		// iOS only lets a clip be stepped once it has been started: start each one and stop it at once
		const prime = (v: HTMLVideoElement) =>
			void v
				.play()
				.then(() => v.pause())
				.catch(() => {});
		prime(nursery);
		if (nursery.readyState >= 4) askFilm();
		const gl = createStageGL(scenesCanvas, clips, () => (onCanvas = false));
		onCanvas = !!gl;

		// Where the viewer looks from: the mouse on a desktop, the phone's tilt where the browser
		// shares it without asking. iOS asks first, with a prompt; there the scenes stay straight on.
		const aim: [number, number] = [0, 0];
		const onPointer = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return;
			if (gl) {
				const r = scenesCanvas.getBoundingClientRect();
				gl.pointer[0] = e.clientX - r.left;
				gl.pointer[1] = e.clientY - r.top;
			}
			aim[0] = (e.clientX / innerWidth) * 2 - 1;
			aim[1] = (e.clientY / innerHeight) * 2 - 1;
		};
		/** how the phone is held: tilt is read from there, and it slowly follows */
		let held: [number, number] | undefined;
		const onTilt = (e: DeviceOrientationEvent) => {
			if (e.gamma === null || e.beta === null) return;
			held ??= [e.gamma, e.beta];
			held[0] += (e.gamma - held[0]) * 0.02;
			held[1] += (e.beta - held[1]) * 0.02;
			// a hand is never still: the view only follows a tilt that is meant, or the canvas would
			// be drawn again on every reading, 60 times a second, for a picture nobody sees move
			const x = Math.max(-1, Math.min(1, (e.gamma - held[0]) / 15));
			const y = Math.max(-1, Math.min(1, (e.beta - held[1]) / 15));
			if (Math.abs(x - aim[0]) > 0.05) aim[0] = x;
			if (Math.abs(y - aim[1]) > 0.05) aim[1] = y;
		};
		/** eases the view towards the aim; near things move against it, the headline most of all */
		const look = () => {
			if (!gl || !onScreen) return;
			const v = gl.view;
			let moved = false;
			for (const k of [0, 1]) {
				const d = -aim[k] - v[k];
				if (Math.abs(d) < 0.002) continue;
				v[k] += d * 0.06;
				moved = true;
			}
			if (!moved) return;
			const reach = Math.max(innerWidth, innerHeight) * 0.008 * 1.3;
			copyEl.style.transform = `translate3d(${(v[0] * reach).toFixed(2)}px, ${(v[1] * reach * 0.6).toFixed(2)}px, 0)`;
		};
		if (gl && !still) {
			window.addEventListener('pointermove', onPointer, { passive: true });
			window.addEventListener('deviceorientation', onTilt);
			gsap.ticker.add(look);
		}

		// The story opens on the nursery: it starts as soon as that clip has a frame. Waiting for the
		// long growth film to buffer through (it is several megabytes) kept the whole hero still for
		// seconds; that film goes on loading behind, with its poster standing in until it is there.
		const filmReady = new Promise<void>((res) => {
			if (nursery.readyState >= 2) return res();
			nursery.addEventListener('loadeddata', () => res(), { once: true });
			setTimeout(res, 1200);
		});
		// the headlines are cut into lines as set in their own face, so that is waited for, but not
		// for ever: a font that never arrives must not leave the hero still
		const fontsReady = Promise.race([
			document.fonts.ready,
			new Promise((res) => setTimeout(res, 3000))
		]);

		void Promise.all([fontsReady, filmReady]).then(() => {
			if (dead) return;
			ctx = gsap.context(() => {
				const story = buildHeroTimeline(root, weather, clock, gl);
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
					marks = rests.map((r) => {
						const c = CHAPTERS.findLast((ch) => r >= ch.at - 0.05) ?? CHAPTERS[0];
						return { label: c.label(), at: c.at, rest: r };
					});
					jump = (r) => {
						const p = (r - INTRO) / (end - INTRO);
						window.scrollTo({ top: st.start + p * (st.end - st.start), behavior: 'instant' });
					};
					if (window.scrollY > 8) story.tl.time(target);

					// The story plays to where the scroll wants it, one scene after the other, forwards
					// or back: a little quicker than it was shot a scene away (nobody waits on a phone),
					// hurrying (up to 4x) the further off it is, and easing back as it arrives.
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
						const speed = Math.min(4, Math.max(1.25, Math.abs(gap) / 2.4));
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
			clearTimeout(filmLater);
			nursery.removeEventListener('canplaythrough', askFilm);
			gsap.ticker.remove(meter);
			gsap.ticker.remove(look);
			window.removeEventListener('pointermove', onPointer);
			window.removeEventListener('deviceorientation', onTilt);
			if (drive) gsap.ticker.remove(drive);
			s.destroy();
			score = undefined;
			io.disconnect();
			window.removeEventListener('kb:hero-covered', onCover);
			filming(false);
			clips.forEach((v) => v.removeEventListener('seeked', settle));
			rain.destroy();
			ctx?.revert();
			gl?.destroy();
			tl = undefined;
		};
	});
</script>

<svelte:document onvisibilitychange={() => score?.pauseForHidden(document.hidden)} />

<!-- away: the full-screen film grain repaints every step, so it rests while the hero is out of view -->
<section
	class={['hero', { ready, sound, away: !onScreen, gl: onCanvas }]}
	bind:this={root}
	aria-labelledby="hero-title"
>
	<div class="stage" bind:this={stage}>
		<video
			class="nursery"
			bind:this={nursery}
			muted
			playsinline
			preload="none"
			disablepictureinpicture
			aria-hidden="true"
		>
			<source
				src="/hero/nursery-scroll-sq.mp4"
				type="video/mp4"
				media="(max-aspect-ratio: 20 / 21)"
			/>
			<source src="/hero/nursery-scroll-sm.mp4" type="video/mp4" media="(max-width: 899px)" />
			<source src="/hero/nursery-scroll.mp4" type="video/mp4" />
		</video>
		<video
			class="film"
			bind:this={film}
			muted
			playsinline
			preload="none"
			disablepictureinpicture
			aria-hidden="true"
		>
			<!-- encoded with a keyframe every few frames, so stepping through them on scroll stays smooth;
			     portrait screens get a square cut around the tree instead of a sliver of the wide shot -->
			<source
				src="/hero/growth-scroll-sq.mp4"
				type="video/mp4"
				media="(max-aspect-ratio: 20 / 21)"
			/>
			<source src="/hero/growth-scroll-sm.mp4" type="video/mp4" media="(max-width: 899px)" />
			<source src="/hero/growth-scroll.mp4" type="video/mp4" />
		</video>
		<video
			class="pour"
			bind:this={pour}
			muted
			playsinline
			preload="none"
			disablepictureinpicture
			aria-hidden="true"
		>
			<source src="/hero/cup-scroll-sq.mp4" type="video/mp4" media="(max-aspect-ratio: 20 / 21)" />
			<source src="/hero/cup-scroll-sm.mp4" type="video/mp4" media="(max-width: 899px)" />
			<source src="/hero/cup-scroll.mp4" type="video/mp4" />
		</video>
		<canvas class="scenes" bind:this={scenesCanvas} aria-hidden="true"></canvas>
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

	<div class="copy" bind:this={copyEl}>
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
			<!-- for a visitor who has not come for the film: straight to the halls, past the story -->
			<a class="skip" href="#halls">
				<span class="skip-long">{m.museum_hero_skip()}</span>
				<span class="skip-short" aria-hidden="true">{m.museum_hero_skip_short()}</span>
				<svg viewBox="0 0 12 20" width="9" height="15" aria-hidden="true">
					<path
						d="M6 1v17M1.5 13.5 6 18l4.5-4.5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</a>
			<button
				type="button"
				class="icon sound-btn"
				onclick={toggleSound}
				aria-pressed={sound}
				aria-label={sound ? m.museum_hero_sound_turn_off() : m.museum_hero_sound_turn_on()}
			>
				<span class="meter" bind:this={meterEl} aria-hidden="true">
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
	{#if jump}
		<nav class="rail" aria-label={m.museum_hero_chapters()} style:--fill={railFill}>
			<span class="rail-line" aria-hidden="true"></span>
			{#each marks as mk, i (mk.rest)}
				<button
					type="button"
					class={['mark', { past: i <= railNow, now: i === railNow }]}
					style:--i={i / (marks.length - 1)}
					aria-label={m.museum_hero_chapter({ n: i + 1, label: mk.label })}
					aria-current={i === railNow ? 'step' : undefined}
					onclick={() => jump?.(mk.rest)}
				>
					<span class="tip" aria-hidden="true">{mk.label}</span>
				</button>
			{/each}
		</nav>
	{/if}
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
		/* the clip's first frame, in the page from the first paint: it stands in until the clip
		   (or the canvas) has a frame of its own, so the hero is never an empty dark screen */
		background: 58% 50% / cover no-repeat;
		will-change: transform;
	}
	.nursery {
		background-image: url('/hero/nursery-start.webp');
	}
	.film {
		background-image: url('/hero/film-start.webp');
	}
	.pour {
		background-image: url('/hero/cup-start.webp');
		background-position: 50% 50%;
	}
	/* every scene after the first waits hidden; the timeline's draw() shows each one as it is poured in */
	.film {
		visibility: hidden;
	}
	.pour {
		visibility: hidden;
		object-position: 50% 50%;
	}
	.scenes {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		display: none;
	}
	/* on the canvas: the films only hand it their frames, so they stay in the page unseen. Not
	   before the story is ready, though: until the canvas has drawn, the first poster shows */
	.gl .scenes {
		display: block;
	}
	.hero.gl.ready .film,
	.hero.gl.ready .nursery,
	.hero.gl.ready .pour {
		visibility: visible;
		opacity: 0;
	}
	.liquid {
		position: absolute;
		inset: 0;
		/* its own layer: redrawn every frame of a pour, it must not take its neighbours with it */
		will-change: transform;
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
	/* out of view, or covered: nothing of it is painted or composited */
	.hero.away .stage {
		visibility: hidden;
	}
	/* on the canvas the grain is part of the picture, and the beat's glow only exists with sound */
	.hero.gl .grain,
	.hero:not(.sound) .pulse {
		display: none;
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

	/* the chapter rail, down the right-hand edge: a thread that fills as the story is told */
	.rail {
		--h: min(46vh, 380px);
		position: absolute;
		z-index: 7;
		right: 14px;
		top: 50%;
		width: 44px;
		height: var(--h);
		translate: 0 -50%;
		opacity: 0;
		transition: opacity 0.9s ease 0.4s;
	}
	.ready .rail {
		opacity: 1;
	}
	.rail-line,
	.rail::after {
		content: '';
		position: absolute;
		right: 21px;
		top: 0;
		width: 2px;
		height: 100%;
		border-radius: 1px;
		background: color-mix(in srgb, var(--ink) 30%, transparent);
		box-shadow: 0 0 6px rgb(6 16 11 / 0.35);
		pointer-events: none;
	}
	.rail::after {
		background: var(--ink);
		transform-origin: top;
		scale: 1 var(--fill, 0);
	}
	.mark {
		position: absolute;
		right: 0;
		top: calc(var(--i) * var(--h));
		translate: 0 -50%;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		cursor: pointer;
	}
	/* the dot */
	.mark::before {
		content: '';
		position: absolute;
		z-index: 1;
		right: 18px;
		top: 50%;
		width: 8px;
		height: 8px;
		translate: 0 -50%;
		border-radius: 50%;
		background: var(--color-forest-950);
		box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--ink) 55%, transparent);
		transition:
			scale 0.3s ease,
			background-color 0.3s ease,
			box-shadow 0.3s ease;
	}
	.mark.past::before {
		background: var(--ink);
		box-shadow: inset 0 0 0 1.5px var(--ink);
	}
	.mark.now::before {
		background: var(--color-lime-400);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-lime-400) 28%, transparent);
		scale: 1.25;
	}
	.mark:hover::before {
		scale: 1.4;
	}
	.tip {
		position: absolute;
		right: 40px;
		top: 50%;
		translate: 6px -50%;
		padding: 4px 10px;
		border-radius: 999px;
		background: rgb(6 16 11 / 0.55);
		white-space: nowrap;
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: var(--ink);
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 0.25s ease,
			translate 0.25s ease;
	}
	.mark.now .tip,
	.mark:hover .tip,
	.mark:focus-visible .tip {
		opacity: 1;
		translate: 0 -50%;
	}
	.mark:focus-visible {
		outline: 2px solid var(--color-lime-400);
		outline-offset: -6px;
		border-radius: 50%;
	}
	.controls {
		position: absolute;
		z-index: 7;
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
	.skip {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 44px;
		padding: 0 16px;
		border-radius: 12px;
		background: var(--ink);
		color: var(--color-forest-900);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		transition: background-color 0.2s;
	}
	.skip-short {
		display: none;
	}
	.skip:hover {
		background: var(--color-lime-400);
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
	.skip:focus-visible,
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
		background-position: 40% 50%;
	}
	/* portrait: scene sits low, story on top. A media query (not a JS-measured class),
	   so the first server-rendered paint is already right and nothing shifts on hydration. */
	@media (max-aspect-ratio: 20 / 21) {
		.hero .vignette {
			background:
				linear-gradient(180deg, rgb(6 16 11 / 0.7) 0%, rgb(6 16 11 / 0.28) 40%, transparent 56%),
				linear-gradient(0deg, rgb(6 16 11 / 0.5) 0%, transparent 22%);
		}
		/* the square cut sits whole in the lower part of the screen, under the story, and fades into
		   the dark at its top and bottom; --y is where it sits in the room left over (0 top, 1 bottom) */
		.hero {
			--y: 0.72;
			--top: calc((100% - 100vw) * var(--y));
		}
		.stage {
			background: radial-gradient(
				ellipse 95% 42% at 50% 68%,
				color-mix(in srgb, var(--color-forest-700) 32%, transparent),
				transparent 72%
			);
		}
		.hero .film,
		.hero .nursery,
		.hero .pour {
			object-fit: contain;
			object-position: 50% calc(var(--y) * 100%);
			background: 50% calc(var(--y) * 100%) / 100% auto no-repeat;
			mask-image: linear-gradient(
				transparent var(--top),
				#000 calc(var(--top) + 26vw),
				#000 calc(var(--top) + 84vw),
				transparent calc(var(--top) + 100vw)
			);
		}
		/* the posters, drawn where the clip will be until its first frame arrives */
		.hero .nursery {
			background-image: url('/hero/nursery-start-sq.webp');
		}
		.hero .film {
			background-image: url('/hero/growth-start-sq.webp');
		}
		.hero .pour {
			background-image: url('/hero/cup-start-sq.webp');
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
	/* phones: the floor plan sign sits bottom centre, so the scroll cue and the sound button take
	   the corners of the same row; the rail is shorter and leaves the names to the headline */
	@media (max-width: 720px) {
		.rail {
			--h: min(34vh, 300px);
			right: 4px;
		}
		.tip {
			display: none;
		}
		.controls {
			bottom: calc(max(14px, env(safe-area-inset-bottom)) + 4px);
		}
		.buttons {
			width: 100%;
			justify-content: space-between;
		}
		/* the way past the story takes the left corner, and its arrow does the cue's work */
		.cue {
			display: none;
		}
		/* one word there: the floor plan sign has the middle of the row */
		.skip {
			gap: 8px;
			padding: 0 12px;
		}
		.skip-short {
			display: inline;
		}
		.skip-long {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
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
