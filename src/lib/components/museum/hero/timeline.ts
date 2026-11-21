import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

/**
 * The growth film (12 s, one locked-off shot) and where it sits on the story
 * timeline. Inside the film: sprout ≈1 s, young tree ≈4 s, blossoms ≈7 s,
 * ripe cherries ≈9.6 s.
 */
export const FILM = { start: 1.6, length: 12 };
/**
 * After the ripe cherries the story goes straight to the museum: the photo of
 * the cup-shaped building fades in and holds the ending.
 */
export const MUSEUM = 12.4;
/**
 * The nursery clip: the seed sprouts in a black nursery bag. It plays over the
 * storm and fades into the growth film when the young tree is "planted out".
 */
export const NURSERY = { start: 0.4, out: 5.2 };

/**
 * The real order of the work (seedlings ~9 months in nursery bags, ~3 years to
 * the first crop, ~8 months from flower to ripe cherry, picked by hand).
 */
export const CHAPTERS = [
	{ id: 'seed', label: 'Seed', at: 0 },
	{ id: 'nursery', label: 'Nursery', at: 2.6 },
	{ id: 'tree', label: 'Tree', at: 5.4 },
	{ id: 'flower', label: 'Flower', at: 8.4 },
	{ id: 'cherry', label: 'Cherry', at: 10.6 },
	{ id: 'museum', label: 'Museum', at: MUSEUM }
];

type Weather = { rain: number };
export type Clock = { t: number; nursery: number };

/**
 * One paused timeline for the whole hero. `clock.t` is the film's playhead in
 * seconds; the component keeps the <video> element in step with it.
 */
export function buildHeroTimeline(root: HTMLElement, weather: Weather, clock: Clock) {
	const q = gsap.utils.selector(root);
	// blur filters repaint every frame; keep them for desktops, skip them on phones and slow devices
	const rich = window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
	const blur = (px: number) => (rich ? { filter: `blur(${px}px)` } : {});
	const one = (s: string) => q(s)[0] as Element;
	const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
	CHAPTERS.forEach((c) => {
		tl.addLabel(c.id, c.at);
	});

	gsap.set(q('.ceremony'), { autoAlpha: 0 });
	gsap.set(q('.line, .caption, .cta'), { autoAlpha: 0 });

	/* ---------- storm, then the growth film ---------- */
	tl.fromTo(
		q('.film'),
		{ scale: 1.03 },
		{ scale: 1, duration: FILM.start + FILM.length, ease: 'sine.out' },
		0
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
		.to(weather, { rain: 0, duration: 1.6, ease: 'sine.in' }, 2.6);

	/* ---------- planted out: the nursery bag gives way to the young tree in the ground ---------- */
	tl.fromTo(
		q('.nursery'),
		{ autoAlpha: 1, ...blur(0) },
		{ autoAlpha: 0, ...blur(6), duration: 0.5, ease: 'power1.inOut' },
		NURSERY.out
	);

	/* ---------- the cherries dissolve into the museum, which holds the ending ---------- */
	tl.to(q('.film'), { scale: 1.08, ...blur(6), duration: 0.9, ease: 'power2.in' }, MUSEUM - 0.6)
		.fromTo(
			q('.ceremony'),
			{ autoAlpha: 0, scale: 1.08, ...blur(8) },
			{ autoAlpha: 1, scale: 1, ...blur(0), duration: 1.2, ease: 'power2.out' },
			MUSEUM - 0.3
		)
		.set(q('.film'), { autoAlpha: 0 }, MUSEUM + 1)
		.to(q('.ceremony'), { scale: 1.06, duration: 9, ease: 'power1.out' }, MUSEUM + 0.9);

	/* ---------- headlines, each in step with its stage ---------- */
	const split = (sel: string, type: string, aria: 'auto' | 'none' = 'auto') =>
		SplitText.create(one(sel), { type, aria, mask: type.includes('lines') ? 'lines' : undefined });
	const show = (sel: string, at: number, until?: number) => {
		tl.set(q(sel), { autoAlpha: 1 }, at);
		if (until !== undefined) tl.set(q(sel), { autoAlpha: 0 }, until);
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
	tl.from(s2.words, { y: 36, scale: 0.7, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, 2.7).to(
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
	).to(
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
	).to(
		sf.words,
		{ y: -18, autoAlpha: 0, ...blur(8), duration: 0.45, ease: 'power2.in', stagger: 0.04 },
		10.1
	);

	const s4 = split('.line-4', 'words,chars');
	show('.line-4', 10.6, MUSEUM);
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
		MUSEUM - 0.4
	);

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

	return { tl, splits: [s1, s2, s3, sf, s4, s5, sc] };
}
