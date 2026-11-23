<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { createRain } from './rain';
	import { buildHeroTimeline, CHAPTERS, FILM, MUSEUM, NURSERY, type Clock } from './timeline';
	import { CLEAR, createScore, SCORE_SRC } from './score';

	/** The music under the story. Any track works; the dashboard will supply it. */
	let { scoreSrc = SCORE_SRC }: { scoreSrc?: string } = $props();

	let root: HTMLElement;
	let canvas: HTMLCanvasElement;
	let film: HTMLVideoElement;
	let nursery: HTMLVideoElement;
	let ready = $state(false);
	let playing = $state(true);
	let time = $state(0);
	let duration = $state(22);
	let sound = $state(false);
	/** The closing still is fetched a few seconds in, not at page load. */
	let museumSrc = $state<string | undefined>(undefined);

	const current = $derived(CHAPTERS.findLastIndex((c) => time >= c.at - 0.05));

	let tl: gsap.core.Timeline | undefined;
	let onScreen = $state(true);
	const clock: Clock = { t: 0, nursery: 0 };
	let weather = { rain: 0 };
	let score: ReturnType<typeof createScore> | undefined;

	/** Keep a <video> on the timeline's clock: play natively while it's on screen and the story runs, seek when it doesn't. */
	const syncVideo = (
		v: HTMLVideoElement | undefined,
		want: number,
		live: boolean,
		running: boolean
	) => {
		if (!v) return;
		if (running && live) {
			if (v.paused) v.play().catch(() => {});
			if (Math.abs(v.currentTime - want) > 0.25) v.currentTime = want;
		} else {
			if (!v.paused) v.pause();
			if (Math.abs(v.currentTime - want) > 0.03) v.currentTime = want;
		}
	};
	const syncFilm = (running: boolean) => {
		const t = tl ? tl.time() : 0;
		syncVideo(
			film,
			clock.t,
			clock.t > 0.01 && clock.t < FILM.length - 0.08 && t < MUSEUM + 1,
			running
		);
		syncVideo(nursery, clock.nursery, t >= NURSERY.start && t < NURSERY.out + 0.5, running);
	};

	/** Film and score both follow the story clock. */
	const syncMedia = (running: boolean, force = false) => {
		syncFilm(running);
		score?.update(tl ? tl.time() : 0, running, weather.rain, force);
	};

	const seek = (at: number) => {
		if (!tl) return;
		tl.seek(at);
		if (playing && onScreen) tl.play();
		syncMedia(playing && onScreen, true);
	};
	const toggle = () => {
		if (!tl) return;
		playing = !playing;
		if (playing) {
			if (tl.progress() === 1) tl.restart();
			else if (onScreen) tl.play();
		} else tl.pause();
		syncMedia(playing && onScreen, true);
	};
	const replay = () => {
		if (!tl) return;
		playing = true;
		score?.rewind();
		tl.restart();
		syncMedia(onScreen, true);
	};
	const toggleSound = () => {
		if (!score) return;
		sound = !sound;
		if (sound) void score.enable();
		else score.disable();
	};

	onMount(() => {
		const { gsap } = setupGsap();
		let ctx: gsap.Context | undefined;
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
			if (!tl) return;
			if (!onScreen) tl.pause();
			else if (playing && tl.progress() < 1) tl.play();
			syncMedia(onScreen && playing && tl.progress() < 1);
		});
		io.observe(root);

		// the clips stay out of the HTML's download queue (preload="none") so on a slow line the page's
		// scripts and fonts arrive first; once hydrated, fetch them in story order
		nursery.preload = 'auto';
		film.preload = 'auto';
		nursery.load();
		film.load();

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
				duration = tl.duration();
				if (import.meta.env.DEV) Object.assign(window, { __heroTl: tl, __heroScore: s });

				tl.eventCallback('onUpdate', () => {
					time = tl!.time();
					// fetch the closing museum still once the story is under way, well before it is shown
					if (!museumSrc && time > MUSEUM - 6) museumSrc = '/hero/museum.webp';
					syncMedia(!tl!.paused());
					if (time < CLEAR) rain.start();
					else rain.stop();
				});
				tl.eventCallback('onComplete', () => {
					playing = false;
					s.release();
				});

				if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
					playing = false;
					tl.progress(1);
				} else if (onScreen) tl.play();
				ready = true;
			}, root);
		});

		return () => {
			dead = true;
			gsap.ticker.remove(meter);
			s.destroy();
			score = undefined;
			io.disconnect();
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
			class="film"
			bind:this={film}
			muted
			playsinline
			preload="none"
			poster="/hero/film-start.webp"
			disablepictureinpicture
			aria-hidden="true"
		>
			<!-- phones get a 960px encode (about 1 MB instead of 6) -->
			<source src="/hero/growth-sm.mp4" type="video/mp4" media="(max-width: 899px)" />
			<source src="/hero/growth.webm" type="video/webm" />
			<source src="/hero/growth.mp4" type="video/mp4" />
		</video>
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
			<source src="/hero/nursery-sm.webm" type="video/webm" media="(max-width: 899px)" />
			<source src="/hero/nursery.webm" type="video/webm" />
			<source src="/hero/nursery.mp4" type="video/mp4" />
		</video>
		<img
			class="ceremony"
			src={museumSrc}
			width="1920"
			height="1078"
			alt=""
			aria-hidden="true"
			decoding="async"
			fetchpriority="low"
		/>
		<canvas class="rain" bind:this={canvas} aria-hidden="true"></canvas>
		<div class="grain" aria-hidden="true"></div>
		<div class="vignette" aria-hidden="true"></div>
		<div class="pulse" aria-hidden="true"></div>
	</div>

	<div class="copy">
		<div class="lines">
			<h1 id="hero-title" class="line line-1">From a single seed to your cup</h1>
			<p class="line line-2" aria-hidden="true">Nine months in the nursery shade</p>
			<p class="line line-3" aria-hidden="true">Planted out, it grows for three years</p>
			<p class="line line-flower" aria-hidden="true">White blossoms after the rain</p>
			<p class="line line-4" aria-hidden="true">Eight months to a ripe red cherry</p>
			<p class="line line-5" aria-hidden="true">Stay for the third cup</p>
		</div>
		<p class="caption">
			<span class="sr-only">Jimma, the birthplace of coffee</span>
			<span class="cap-text" aria-hidden="true">Jimma, the birthplace of coffee</span>
		</p>
		<a class="cta" href="#visit">Visit us</a>
	</div>

	<div class="controls">
		<ol class="chapters" aria-label="Story chapters">
			{#each CHAPTERS as c, i (c.id)}
				{@const next = CHAPTERS[i + 1]?.at ?? duration}
				{@const fill = Math.min(1, Math.max(0, (time - c.at) / (next - c.at)))}
				<li>
					<button
						type="button"
						class={{ active: i === current }}
						aria-current={i === current ? 'step' : undefined}
						aria-label={`Chapter ${i + 1}: ${c.label}`}
						onclick={() => seek(c.at + 0.01)}
					>
						<span class="bar"><span class="fill" style:transform={`scaleX(${fill})`}></span></span>
						<span class="num">{String(i + 1).padStart(2, '0')}</span>
						<span class="label">{c.label}</span>
					</button>
				</li>
			{/each}
		</ol>
		<div class="buttons">
			<button
				type="button"
				class="icon sound-btn"
				onclick={toggleSound}
				aria-pressed={sound}
				aria-label={sound ? 'Turn sound off' : 'Turn sound on'}
			>
				<span class="meter" aria-hidden="true">
					{#each [0, 1, 2, 3] as k (k)}
						<span style:--k={`var(--b${k}, 0)`}></span>
					{/each}
				</span>
				<span class="sound-label">{sound ? 'Sound on' : 'Sound'}</span>
			</button>
			<button
				type="button"
				class="icon"
				onclick={toggle}
				aria-label={playing ? 'Pause the story' : 'Play the story'}
			>
				{#if playing}
					<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
						<rect x="5" y="4" width="3.4" height="12" rx="1" /><rect
							x="11.6"
							y="4"
							width="3.4"
							height="12"
							rx="1"
						/>
					</svg>
				{:else}
					<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
						<path
							d="M6 4.2v11.6a.8.8 0 0 0 1.2.7l9.4-5.8a.8.8 0 0 0 0-1.4L7.2 3.5A.8.8 0 0 0 6 4.2Z"
						/>
					</svg>
				{/if}
			</button>
			<button type="button" class="icon" onclick={replay} aria-label="Replay from the seed">
				<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
					<path
						d="M4 10a6 6 0 1 0 1.8-4.3M4 3.5v3.2h3.2"
						fill="none"
						stroke="currentColor"
						stroke-width="1.7"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	</div>
	<span class="sr-only" aria-live="polite">
		{ready ? `Chapter ${current + 1}: ${CHAPTERS[current].label}` : ''}
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
		opacity: 0;
		transition: opacity 0.9s ease;
	}
	.ready .stage {
		opacity: 1;
	}
	.film,
	.nursery,
	.ceremony {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 58% 50%;
		will-change: transform;
	}
	.ceremony {
		opacity: 0;
		visibility: hidden;
		object-position: 72% 50%;
		transform-origin: 72% 38%;
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
			linear-gradient(90deg, rgb(6 16 11 / 0.55) 0%, rgb(6 16 11 / 0.28) 32%, transparent 55%),
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
		width: min(420px, 31%);
	}
	.lines {
		display: grid;
	}
	.line {
		grid-area: 1 / 1;
		margin: 0;
		font-size: clamp(2.3rem, 3.7vw, 3.6rem);
		line-height: 1.02;
		letter-spacing: -0.035em;
		font-weight: 350;
		color: var(--ink);
		text-wrap: balance;
	}
	.line:not(.line-1) {
		visibility: hidden;
	}
	.caption {
		margin: 22px 0 0;
		font-size: 1.05rem;
		color: var(--ink-soft);
		visibility: hidden;
	}
	.cta {
		display: inline-flex;
		margin-top: 26px;
		padding: 13px 22px;
		border-radius: 12px;
		background: var(--color-forest-900);
		color: var(--color-mist-50);
		text-decoration: none;
		font-size: 15px;
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
		gap: 20px;
	}
	.chapters {
		flex: 1;
		/* one row however many chapters the story has; the current one widens to show its name */
		display: flex;
		gap: 6px;
		min-width: 0;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.chapters button {
		width: 100%;
		display: grid;
		grid-template-columns: auto 1fr;
		column-gap: 8px;
		row-gap: 10px;
		padding: 6px 0;
		border: 0;
		background: none;
		color: var(--ink-soft);
		font: inherit;
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		transition: color 0.3s;
	}
	.chapters li {
		flex: 1 1 0;
		min-width: 0;
		transition: flex-grow 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.chapters li:has(> .active) {
		flex-grow: 3.4;
	}
	.label {
		display: none;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* only the current chapter is named; the rest are numbers */
	@media (min-aspect-ratio: 20.01 / 21) {
		.hero .active .label {
			display: block;
		}
	}
	.chapters button.active {
		color: var(--ink);
	}
	.bar {
		grid-column: 1 / -1;
		height: 2px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--ink) 22%, transparent);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--ink);
		transform-origin: 0 50%;
	}
	.num {
		font-family: var(--font-mono);
		font-size: 11px;
		opacity: 0.8;
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
				linear-gradient(180deg, rgb(6 16 11 / 0.6) 0%, rgb(6 16 11 / 0.2) 34%, transparent 50%),
				linear-gradient(0deg, rgb(6 16 11 / 0.5) 0%, transparent 22%);
		}
		.hero .film {
			object-position: 64% 50%;
		}
		.hero .nursery {
			object-position: 50% 50%;
		}
		/* keep a phone's chapter row quiet: bars only, plus the current number */
		.hero .num {
			display: none;
		}
		.hero .active .num {
			display: block;
		}
		.hero .ceremony {
			object-position: 62% 50%;
			transform-origin: 62% 40%;
		}
		.hero .copy {
			top: 104px;
			translate: none;
			left: 24px;
			right: 24px;
			width: auto;
		}
		.hero .line {
			font-size: clamp(2.2rem, 9vw, 3.2rem);
		}
		.hero .label,
		.hero .sound-label {
			display: none;
		}
		.hero .chapters button {
			grid-template-columns: 1fr;
		}
	}

	/* short landscape screens: phones on their side, small laptop windows, 200% zoom */
	@media (max-height: 560px) and (orientation: landscape) {
		.copy {
			top: 84px;
			translate: none;
			width: min(380px, 44%);
		}
		.line {
			font-size: clamp(1.6rem, 7.2vh, 2.6rem);
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
		.hero .active .label,
		.sound-label {
			display: none;
		}
		.chapters button {
			grid-template-columns: 1fr;
		}
	}
	/* very wide screens: open the column up so the story doesn't sit in a small box */
	@media (min-width: 1800px) {
		.hero {
			--wrap: 1440px;
		}
		.copy {
			width: min(560px, 31%);
		}
		.line {
			font-size: clamp(3.6rem, 3vw, 4.6rem);
		}
		.caption {
			font-size: 1.25rem;
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
		.grain {
			animation: none;
		}
		.stage {
			transition: none;
		}
	}
</style>
