import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { m } from '#lib/i18n.ts';
import { TONES, type Look, type StageGL, type Tone } from './stage-gl';

/**
 * The growth film (12 s, one locked-off shot) and where it sits on the story
 * timeline. Inside the film: sprout ≈1 s, young tree ≈4 s, blossoms ≈7 s,
 * ripe cherries ≈9.6 s.
 */
export const FILM = { start: 1.6, length: 12 };
/** Where the growth film hands over to the pour. */
export const PROCESS = 12.2;
/**
 * After the ripe cherries the story goes to the cup in one clip: the jebena on the coals is
 * lifted and poured into the museum's tulip cup. It plays at the speed it was shot.
 */
export const POUR = { start: PROCESS, length: 5 };
/**
 * The two moments in that clip, each with its line. The cup comes into frame about 2.4 s in.
 * `label` and `line` are messages, like the chapter labels below.
 */
export const STEPS = [
	{
		id: 'jebena',
		label: m.museum_hero_chapter_jebena,
		at: PROCESS,
		line: m.museum_hero_line_jebena
	},
	{ id: 'cup', label: m.museum_hero_chapter_cup, at: PROCESS + 2.4, line: m.museum_hero_line_pour }
];
/** Where the pour ends: the last frame of the cup holds, and the closing line is written over it. */
export const MUSEUM = POUR.start + POUR.length;
/**
 * The headline rains in by itself when the page opens; from here on the story follows the scroll.
 */
export const INTRO = 2;
/**
 * The nursery clip: the seed sprouts in a black nursery bag. It plays over the
 * storm and fades into the growth film when the young tree is "planted out".
 */
export const NURSERY = { start: 0.4, out: 5.2 };

/**
 * The real order of the work (seedlings ~9 months in nursery bags, ~3 years to
 * the first crop, ~8 months from flower to ripe cherry, picked by hand). `label` is a message:
 * call it while rendering, so it is read in the visitor's language.
 */
export const CHAPTERS = [
	{ id: 'seed', label: m.museum_hero_chapter_seed, at: 0 },
	{ id: 'nursery', label: m.museum_hero_chapter_nursery, at: 2.6 },
	{ id: 'tree', label: m.museum_hero_chapter_tree, at: 5.4 },
	{ id: 'flower', label: m.museum_hero_chapter_flower, at: 8.4 },
	{ id: 'cherry', label: m.museum_hero_chapter_cherry, at: 10.6 },
	...STEPS.map(({ id, label, at }) => ({ id, label, at })),
	{ id: 'stay', label: m.museum_hero_line_cup, at: MUSEUM }
];

type Weather = { rain: number };
export type Clock = { t: number; nursery: number };

/**
 * One paused timeline for the whole hero. `clock.t` is the film's playhead in
 * seconds; the component keeps the <video> element in step with it. With `gl` the scenes are
 * drawn on its canvas; without it (or once it is lost) the <video>s are clipped in the page.
 */
export function buildHeroTimeline(
	root: HTMLElement,
	weather: Weather,
	clock: Clock,
	gl?: StageGL | null
) {
	const q = gsap.utils.selector(root);
	// blur filters repaint every frame; keep them for desktops, skip them on phones and slow devices
	const rich = window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
	const blur = (px: number) => (rich ? { filter: `blur(${px}px)` } : {});
	const one = (s: string) => q(s)[0] as Element;
	const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
	CHAPTERS.forEach((c) => {
		tl.addLabel(c.id, c.at);
	});

	const tall = window.matchMedia('(max-aspect-ratio: 20 / 21)').matches;
	/** Rain on the lens, drawn by the canvas (0..1). */
	const lens = { v: 0 };
	/** Steam off the cup at the end, drawn by the canvas (0..1). */
	const steam = { v: 0 };
	gsap.set(q('.line, .caption, .cta'), { autoAlpha: 0 });

	/* ---------- storm, then the growth film ---------- */
	tl.to(
		q('.film'),
		{ scale: 1.03, duration: PROCESS - NURSERY.out - 1.3, ease: 'sine.inOut' },
		NURSERY.out + 0.8
	)
		.to(clock, { t: FILM.length - 0.04, duration: FILM.length, ease: 'none' }, FILM.start)
		.fromTo(
			clock,
			{ nursery: 0 },
			{
				nursery: NURSERY.out + 0.5 - NURSERY.start,
				duration: NURSERY.out + 0.5 - NURSERY.start,
				ease: 'none'
			},
			NURSERY.start
		)
		.to(weather, { rain: 1, duration: 0.6, ease: 'none' }, 0.1)
		.to(weather, { rain: 0, duration: 1.6, ease: 'sine.in' }, 2.6)
		// the storm beads on the lens a little after it starts, and dries a little after it stops
		.to(lens, { v: 1, duration: 1.4, ease: 'sine.out' }, 0.3)
		.to(lens, { v: 0, duration: 1.6, ease: 'sine.in' }, 3.3);

	/* ---------- the pour: how one scene becomes the next ----------
	   A thread of liquid falls the height of the frame and the next scene rises out of it like a
	   cup filling: its top edge is a moving surface with the liquid itself riding on it. The liquid
	   is drawn the way the Journey section draws its stream: nested ribbons, amber where it is
	   thin, dark in the core, one glint on the lit side. Everything comes from plain numbers
	   (`fills`), so it runs the same forwards and backwards under the scroll. */
	const scenes = ['.nursery', '.film', '.pour'].map((sel) => one(sel) as HTMLElement);
	const svg = one('.liquid') as SVGSVGElement;
	const LAYERS = [
		{ cls: 'edge', w: 1, o: 0, inset: 0 },
		{ cls: 'body', w: 0.78, o: -0.1, inset: 0.16 },
		{ cls: 'core', w: 0.5, o: -0.2, inset: 0.38 },
		{ cls: 'glint', w: 0.15, o: 0.5, inset: 0.05 }
	] as const;
	const bandP = LAYERS.map((L) => svg.querySelector<SVGPathElement>(`.lq-band .${L.cls}`)!);
	const fallP = LAYERS.map((L) => svg.querySelector<SVGPathElement>(`.lq-fall .${L.cls}`)!);
	const head = svg.querySelector<SVGGElement>('.lq-head')!;
	// fills[k] is the pour that brings in scenes[k + 1]
	type Fill = {
		level: number;
		phase: number;
		amp: number;
		drop: number;
		thin: number;
		x: number;
		tone: Tone;
	};
	const fills: Fill[] = [0, 1].map(() => ({
		level: 0,
		phase: 0,
		amp: 0,
		drop: 0,
		thin: 1,
		x: 50,
		tone: 'coffee'
	}));
	const N = 48;
	// the swell is a share of the frame's height: a tall phone screen needs less of it
	const swell = tall ? 0.45 : 1;
	/**
	 * The part of the frame the scenes fill, in % of its height: all of it, except on a portrait
	 * screen, where the square cut sits low with the dark above it (see the component's --y).
	 * The liquid fills that part only, so it never sweeps on through the dark over the headline.
	 */
	let rise = { top: 0, bottom: 100 };
	/** Height of the surface at x (both in % of the frame). Level 0 is below the scene, 1 above it. */
	const surfaceY = (x: number, level: number, phase: number, amp: number, x0: number) =>
		rise.bottom +
		amp -
		level * (rise.bottom - rise.top + 2 * amp) +
		amp * Math.sin(phase + x * 0.085) +
		amp * 0.45 * Math.sin(phase * 1.7 + x * 0.21) +
		// rings running out from where the thread lands
		amp * 0.55 * Math.sin((x - x0) * 0.55 - phase * 2.6) * Math.exp(-Math.abs(x - x0) / 9);
	const leadOf = (level: number) => Math.min(1, level + 0.09 * Math.sin(Math.PI * level));
	const clipOf = (f: Fill, ph: number) => {
		let pts = '';
		for (let i = 0; i <= N; i++) {
			const x = (i / N) * 100;
			pts += `${x.toFixed(2)}% ${surfaceY(x, f.level, ph, f.amp, f.x).toFixed(2)}%,`;
		}
		return `polygon(${pts}100% 101%,0% 101%)`;
	};
	const cut = (el: HTMLElement, on: boolean, clip: string) => {
		const vis = on ? 'visible' : 'hidden';
		if (el.style.visibility !== vis) el.style.visibility = vis;
		if (on && el.style.clipPath !== clip) el.style.clipPath = clip;
	};
	const fmt = (v: number) => (Math.round(v * 10) / 10).toString();
	let lastSig = '';
	let wet = false;
	let toneNow: Tone | undefined;
	let box = '';

	/** The scenes' tilt and scale as the timeline has tweened them, read for the canvas. */
	const looks: Look[] = scenes.map(() => ({ tilt: 0, scale: 1 }));
	const readLooks = () => {
		scenes.forEach((el, k) => {
			// straight from GSAP's own record of the element: asking through getProperty can read
			// the computed style, which forces a style pass on every frame
			const c = (el as HTMLElement & { _gsap?: { rotationX?: string; scaleX?: number } })._gsap;
			looks[k].tilt = c ? parseFloat(c.rotationX ?? '0') || 0 : 0;
			looks[k].scale = c?.scaleX ?? 1;
		});
		return looks;
	};
	/** On the canvas, or (no WebGL, or its context lost) clipped in the page. */
	let onCanvas = !!gl;

	// (the frame the drawing fills, not the drawing: that is narrowed to the thread, see below)
	const frame = svg.parentElement!;
	const size = { w: frame.clientWidth, h: frame.clientHeight };
	const sized = new ResizeObserver(() => {
		size.w = frame.clientWidth;
		size.h = frame.clientHeight;
	});
	sized.observe(frame);
	let slimBox = '';
	/**
	 * Paint the scenes, the band of liquid on the surface and the falling thread. Runs every
	 * frame; in the page it is idle unless a pour is under way. The canvas is asked every frame,
	 * since a film's new frame is a change too, and skips the work itself when nothing changed.
	 */
	const draw = () => {
		if (onCanvas && !gl?.ok) {
			onCanvas = false;
			lastSig = '';
		}
		const act = fills.findIndex(
			(f) => (f.drop > 0 && f.thin > 0.001 && f.level < 1) || (f.level > 0 && f.level < 1)
		);
		const sig = fills.map((f) => f.level.toFixed(4)).join();
		if (!onCanvas && act < 0 && sig === lastSig && !wet) return;
		lastSig = sig;
		const t = performance.now() / 1000;
		// sizes come from the observer below: reading clientWidth here forced a layout every frame
		const W = size.w;
		const H = size.h;
		if (!W || !H) return;
		if (box !== `${W} ${H}`) {
			box = `${W} ${H}`;
			slimBox = '';
			const y = parseFloat(getComputedStyle(root).getPropertyValue('--y'));
			const top = (H - W) * y;
			rise =
				Number.isFinite(y) && H > W
					? { top: (top / H) * 100, bottom: ((top + W) / H) * 100 }
					: { top: 0, bottom: 100 };
		}

		if (onCanvas) {
			// the fills run in order: every full one has brought its scene in, the next may be pouring
			const a = fills.filter((f) => f.level >= 1).length;
			const f = fills[a] as Fill | undefined;
			gl!.render(
				a,
				f && f.level > 0
					? {
							level: f.level,
							lead: leadOf(f.level),
							phase: f.phase + t * 0.9,
							amp: f.amp,
							x: f.x,
							tone: f.tone,
							rise
						}
					: null,
				readLooks(),
				{ lens: lens.v, steam: steam.v }
			);
		} else
			scenes.forEach((el, k) => {
				const into = k ? fills[k - 1] : undefined;
				const next = fills[k];
				const on = (!into || into.level > 0) && (!next || next.level < 1);
				cut(el, on, into && into.level < 1 ? clipOf(into, into.phase + t * 0.9) : 'none');
			});

		if (act < 0) {
			if (wet) svg.style.visibility = 'hidden';
			wet = false;
			return;
		}
		const f = fills[act];
		if (toneNow !== f.tone) {
			toneNow = f.tone;
			const c = TONES[f.tone];
			LAYERS.forEach((L, li) => {
				fallP[li].setAttribute('fill', c[L.cls]);
				bandP[li].setAttribute('fill', c[L.cls]);
				head.querySelector(`.${L.cls}`)!.setAttribute('fill', c[L.cls]);
			});
			svg.style.opacity = String(c.alpha);
		}
		svg.style.visibility = 'visible';
		wet = true;

		const ph = f.phase + t * 0.9;
		const fx = (W * f.x) / 100;
		// On the canvas only the thread is drawn here, so the drawing is a strip around it: as a
		// full-screen layer it was painted whole on every frame, the slowest thing in a pour.
		const vb = onCanvas ? `${Math.round(fx) - 48} 0 96 ${H}` : `0 0 ${W} ${H}`;
		if (vb !== slimBox) {
			slimBox = vb;
			svg.setAttribute('viewBox', vb);
			svg.style.left = onCanvas ? `${Math.round(fx) - 48}px` : '';
			svg.style.width = onCanvas ? '96px' : '';
		}
		let landing = ((H * rise.bottom) / 100) * f.drop;

		/* the band: liquid riding on the rising surface, thick where the frame is half full */
		if (f.level > 0 && onCanvas) {
			// the canvas draws it; the thread lands on its top
			const b = (surfaceY(f.x, f.level, ph, f.amp, f.x) / 100) * H;
			const a = Math.min(
				b - 1,
				(surfaceY(f.x, leadOf(f.level), ph + 1.4, f.amp * 1.25, f.x) / 100) * H
			);
			landing = Math.min(landing, a + (b - a) * 0.2);
			if (bandP[0].getAttribute('d')) bandP.forEach((el) => el.setAttribute('d', ''));
		} else if (f.level > 0) {
			const lead = leadOf(f.level);
			const top: number[] = [];
			const th: number[] = [];
			for (let i = 0; i <= N; i++) {
				const x = (i / N) * 100;
				const b = (surfaceY(x, f.level, ph, f.amp, f.x) / 100) * H;
				const a = Math.min(b - 1, (surfaceY(x, lead, ph + 1.4, f.amp * 1.25, f.x) / 100) * H);
				top.push(a);
				th.push(b - a);
			}
			LAYERS.forEach((L, li) => {
				let d = '';
				let back = '';
				for (let i = 0; i <= N; i++) {
					const x = fmt((i / N) * W);
					if (L.cls === 'glint') {
						// a broken line of light just under the top edge
						const k = Math.max(0, 0.3 + Math.sin(i * 0.55 + ph * 1.3) * Math.sin(i * 0.17 + 1));
						d += `${i ? ' ' : 'M'}${x} ${fmt(top[i] + th[i] * 0.05)}`;
						back = ` ${x} ${fmt(top[i] + th[i] * (0.05 + 0.07 * Math.min(1, k)))}` + back;
					} else {
						// each layer starts a little deeper: light at the surface, dark towards the scene it rests on
						d += `${i ? ' ' : 'M'}${x} ${fmt(top[i] + th[i] * L.inset)}`;
						back = ` ${x} ${fmt(top[i] + th[i] + 1)}` + back;
					}
				}
				bandP[li].setAttribute('d', d + back + 'Z');
			});
			const at = Math.min(N, Math.max(0, Math.round((f.x / 100) * N)));
			landing = Math.min(landing, top[at] + th[at] * 0.2);
		} else bandP.forEach((el) => el.setAttribute('d', ''));

		/* the thread: it speeds up and thins as it falls, and beads towards the end */
		const fh = landing;
		const fw = Math.min(12, Math.max(5, W * 0.0065)) * f.thin;
		if (fh > 2 && fw > 0.2) {
			const m = Math.max(8, Math.ceil(fh / 5));
			LAYERS.forEach((L, li) => {
				let l = '';
				let r = '';
				for (let j = 0; j <= m; j++) {
					const d = (fh * j) / m;
					const u = d / fh;
					let w = fw * Math.pow(90 / (90 + d), 0.3);
					const bead = 0.2 * Math.max(0, Math.min(1, (u - 0.35) / 0.65)) ** 2;
					w *= 1 + bead * Math.sin(((d - t * 90) / (14 + d * 0.04)) * Math.PI * 2);
					const sway = 1.4 * u * u * Math.sin(t * 1.7 + d * 0.02);
					let o = L.o * w * 0.6;
					let h = L.w * w;
					if (L.cls === 'glint') {
						const k = Math.max(
							0,
							0.25 + Math.sin(d / 41 + 2) * Math.sin(d / 157 + t) + 0.3 * Math.sin(d / 13)
						);
						o = (L.o + 0.12 * Math.sin(d / 67)) * w * 0.6;
						h *= Math.min(1, k);
					}
					const x = fx + sway;
					l += `${j ? ' ' : 'M'}${fmt(x - (o - h))} ${fmt(d)}`;
					r = ` ${fmt(x - (o + h))} ${fmt(d)}` + r;
				}
				fallP[li].setAttribute('d', l + r + 'Z');
			});
			// the bead at the front, while the thread is still on its way down
			const tip = fw * Math.pow(90 / (90 + fh), 0.3);
			head.setAttribute(
				'transform',
				`translate(${fmt(fx)} ${fmt(fh)}) rotate(90) scale(${tip.toFixed(2)})`
			);
			head.style.opacity = f.level <= 0 && f.drop < 0.98 ? '1' : '0';
		} else {
			fallP.forEach((el) => el.setAttribute('d', ''));
			head.style.opacity = '0';
		}
	};

	const pourInto = (at: number, k: number, x: number, tone: Tone) => {
		const f = fills[k];
		f.x = x;
		f.tone = tone;
		const late = { immediateRender: false };
		tl.fromTo(f, { drop: 0 }, { drop: 1, duration: 0.5, ease: 'power2.in', ...late }, at - 0.95)
			.fromTo(
				f,
				{ level: 0, phase: 0, amp: 4.5 * swell },
				{
					level: 1,
					phase: 7,
					amp: 1.2 * swell,
					duration: 1.5,
					ease: 'sine.inOut',
					...late
				},
				at - 0.55
			)
			.fromTo(f, { thin: 1 }, { thin: 0, duration: 0.6, ease: 'sine.in', ...late }, at + 0.1)
			// the scene being covered grows a little as it tips back, so the frame's edges never show
			.to(scenes[k], { rotationX: 4, scale: 1.09, duration: 1.4, ease: 'sine.inOut' }, at - 0.55)
			.fromTo(
				scenes[k + 1],
				{ rotationX: -5, scale: 1.08 },
				{ rotationX: 0, scale: 1, duration: 1.6, ease: 'sine.out', ...late },
				at - 0.55
			);
	};

	// planted out: the rain that fed the seedling runs down, and the young tree in the ground rises out of it
	pourInto(NURSERY.out, 0, tall ? 50 : 62, 'water');
	// the cherries become coffee: it pours, and the jebena on the coals rises out of it
	pourInto(PROCESS, 1, tall ? 50 : 60, 'coffee');
	// the story ends in the cup: the last frame of the pour holds, drifting in a little
	tl.to(q('.pour'), { scale: 1.05, duration: 3.2, ease: 'power1.out' }, MUSEUM + 0.3)
		// and keeps steaming while it is looked at
		.to(steam, { v: 1, duration: 2.4, ease: 'sine.inOut' }, MUSEUM - 0.6);

	/* ---------- headlines, each in step with its stage ---------- */
	const split = (sel: string, type: string, aria: 'auto' | 'none' = 'auto') =>
		SplitText.create(one(sel), { type, aria, mask: type.includes('lines') ? 'lines' : undefined });
	const show = (sel: string, at: number, until?: number) => {
		tl.set(q(sel), { autoAlpha: 1 }, at);
		if (until !== undefined) tl.set(q(sel), { autoAlpha: 0 }, until);
	};

	/**
	 * The story's resting places: a line fully written and no scene mid-pour. The scroll picks one
	 * and the story plays to it at its own pace, so nothing is left frozen half-blurred when the
	 * scroll stops. Read from the tween just added, so a longer translation rests a little later.
	 */
	const rests = [INTRO];
	const rest = (before: number) => {
		const last = tl.recent() as gsap.core.Tween;
		rests.push(Math.min(last.endTime() + 0.15, before - 0.1));
	};

	const s1 = split('.line-1', 'words,chars');
	show('.line-1', 0.4, 2.7);
	tl.from(
		s1.chars,
		{
			y: -70,
			autoAlpha: 0,
			...blur(6),
			duration: 0.7,
			ease: 'power2.in',
			stagger: { amount: 0.8, from: 'random' }
		},
		0.4
	).to(
		s1.words,
		{ y: -24, autoAlpha: 0, ...blur(10), duration: 0.4, ease: 'power2.in', stagger: 0.05 },
		2.25
	);

	const s2 = split('.line-2', 'words,lines');
	show('.line-2', 2.7, 5.4);
	tl.from(s2.words, { y: 36, scale: 0.7, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, 2.7);
	rest(4.85);
	tl.to(
		s2.lines,
		{ autoAlpha: 0, ...blur(12), duration: 0.5, ease: 'power2.in', stagger: 0.05 },
		4.85
	);

	const s3 = split('.line-3', 'words');
	show('.line-3', 5.4, 8.4);
	tl.from(
		s3.words,
		{
			scale: 0.4,
			autoAlpha: 0,
			...blur(8),
			duration: 0.9,
			stagger: { each: 0.12, from: 'center' }
		},
		5.4
	);
	rest(7.9);
	tl.to(
		s3.words,
		{
			autoAlpha: 0,
			...blur(10),
			duration: 0.45,
			ease: 'power2.in',
			stagger: { each: 0.05, from: 'random' }
		},
		7.9
	);

	// blossoms open: words drift up like petals
	const sf = split('.line-flower', 'words');
	show('.line-flower', 8.4, 10.6);
	tl.from(
		sf.words,
		{ y: 22, autoAlpha: 0, ...blur(8), duration: 0.8, ease: 'power3.out', stagger: 0.09 },
		8.4
	);
	rest(10.1);
	tl.to(
		sf.words,
		{ y: -18, autoAlpha: 0, ...blur(8), duration: 0.45, ease: 'power2.in', stagger: 0.04 },
		10.1
	);

	// no rest on the cherries: the coffee is already falling, so they run on into the jebena
	const s4 = split('.line-4', 'words,chars');
	show('.line-4', 10.6, PROCESS);
	tl.from(
		s4.chars,
		{
			scale: 0,
			autoAlpha: 0,
			duration: 0.4,
			ease: 'back.out(2.2)',
			stagger: { amount: 0.5, from: 'random' }
		},
		10.6
	).to(
		s4.chars,
		{
			y: 40,
			autoAlpha: 0,
			...blur(6),
			duration: 0.35,
			ease: 'power2.in',
			stagger: { amount: 0.2, from: 'random' }
		},
		PROCESS - 0.4
	);

	// the pour: one short line a moment, up from below and away upwards
	const work = STEPS.map((s, i) => {
		const sel = `.line-${s.id}`;
		const until = STEPS[i + 1]?.at ?? MUSEUM;
		const sp = split(sel, 'words');
		show(sel, s.at + 0.1, until);
		tl.from(
			sp.words,
			{ y: 26, autoAlpha: 0, ...blur(8), duration: 0.6, ease: 'power3.out', stagger: 0.07 },
			s.at + 0.1
		);
		rest(until - 0.45);
		tl.to(
			sp.words,
			{ y: -16, autoAlpha: 0, ...blur(8), duration: 0.35, ease: 'power2.in', stagger: 0.03 },
			until - 0.45
		);
		return sp;
	});

	const s5 = split('.line-5', 'words');
	const museumAt = MUSEUM + 0.6;
	show('.line-5', museumAt);
	tl.from(s5.words, { y: 28, autoAlpha: 0, ...blur(10), duration: 0.9, stagger: 0.1 }, museumAt);

	// the readable copy sits beside it in .sr-only, so this one needs no label
	const sc = split('.caption .cap-text', 'words,chars', 'none'); // words keep the typewriter from breaking mid-word
	show('.caption', museumAt + 0.9);
	tl.from(sc.chars, { autoAlpha: 0, duration: 0.01, stagger: 0.035, ease: 'none' }, museumAt + 0.9);

	tl.fromTo(
		q('.cta'),
		{ autoAlpha: 0, y: 12 },
		{ autoAlpha: 1, y: 0, duration: 0.5 },
		museumAt + 2.4
	);

	rests.push(tl.duration());
	draw();
	return { tl, draw, rests, splits: [s1, s2, s3, sf, s4, ...work, s5, sc] };
}
