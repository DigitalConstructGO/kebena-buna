import { setupGsap } from '#lib/gsap.js';
import { whenIdle } from '#lib/reveal.js';

type Gsap = ReturnType<typeof setupGsap>['gsap'];

/** Headings that are left alone: marked ones, the hero's (it has its own entrance) and the map scene's. */
const SKIP = '[data-no-letter], #hero, .am';
/** Past this many letters a heading is lettered word by word, or it would take too long to read. */
const LONG = 90;

const spread = (n: number) => Math.min(0.6, n * 0.022);

/**
 * Letter text in the way a sign is painted: each letter is drawn as an outline, left to right,
 * then filled in. The letters carry `--line` and `--fill` (0 to 1), which `.kb-ch` draws from.
 */
export function write(gsap: Gsap, bits: Element[]) {
	const stagger = { amount: spread(bits.length) };
	return gsap
		.timeline()
		.fromTo(
			bits,
			{ '--line': 0, '--fill': 0 },
			{ '--line': 1, duration: 0.35, stagger, ease: 'power1.out', overwrite: true }
		)
		.to(bits, { '--fill': 1, duration: 0.4, stagger, ease: 'power1.inOut' }, 0.22)
		.to(bits, { '--line': 0, duration: 0.3, stagger, ease: 'none' }, 0.42);
}

/**
 * Text that answers the pointer for as long as it stays: `empty` takes the letters back to
 * outlines, left to right, and `fill` paints them in again. Either can cut in on the other
 * midway, so the letters follow the pointer in and out without a jump.
 */
export function hold(gsap: Gsap, bits: () => Element[]) {
	let tl: gsap.core.Timeline | undefined;
	let out = false;
	return {
		get out() {
			return out;
		},
		empty() {
			const all = bits();
			if (out || !all.length) return;
			out = true;
			tl?.kill();
			const stagger = { amount: spread(all.length) * 0.6 };
			tl = gsap
				.timeline()
				.to(all, { '--line': 1, duration: 0.3, stagger, ease: 'power2.out' })
				.to(all, { '--fill': 0, duration: 0.4, stagger, ease: 'power2.out' }, 0);
		},
		fill() {
			if (!out) return;
			out = false;
			tl?.kill();
			const all = bits();
			const stagger = { amount: spread(all.length) * 0.6 };
			tl = gsap
				.timeline()
				.to(all, { '--fill': 1, duration: 0.5, stagger, ease: 'power2.inOut' })
				.to(all, { '--line': 0, duration: 0.4, stagger, ease: 'power1.in' }, 0.2);
		},
		kill() {
			tl?.kill();
		},
		/** Let go without painting anything: whoever owns the letters sets them from here. */
		reset() {
			tl?.kill();
			out = false;
		}
	};
}
type Hold = ReturnType<typeof hold>;

/**
 * Every heading inside `root` is lettered in as it scrolls into view, and goes back to outlines
 * while the pointer is over it. Headings already on screen at the start are left as they are. Call `scan` after
 * the page under `root` changes; `destroy` puts every heading back as it was.
 */
export function lettering(root: HTMLElement) {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
		return { scan() {}, destroy() {} };

	const { gsap, SplitText } = setupGsap();
	const canHover = window.matchMedia('(hover: hover)').matches;
	// Arabic letters join, so there the unit is the word
	const joined = /^ar\b/.test(document.documentElement.lang);

	type State = {
		bits?: Element[];
		split?: { revert(): void };
		waiting: boolean;
		entry?: gsap.core.Timeline;
		hover?: Hold;
	};
	const states = new Map<Element, State>();

	const bitsOf = (el: Element, s: State) => {
		if (!s.bits) {
			const byWord = joined || (el.textContent ?? '').length > LONG;
			const split = SplitText.create(el, {
				type: byWord ? 'words' : 'words,chars',
				[byWord ? 'wordsClass' : 'charsClass']: 'kb-ch'
			});
			s.split = split;
			s.bits = byWord ? split.words : split.chars;
		}
		return s.bits;
	};
	/** Coming up from below the screen: split it and blank it before anyone can see it. */
	const near = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				const s = states.get(e.target);
				if (!s || !e.isIntersecting) continue;
				near.unobserve(e.target);
				// on screen already: no entrance, it would blink out and back
				if (e.boundingClientRect.top < window.innerHeight * 0.9) continue;
				gsap.set(bitsOf(e.target, s), { '--line': 0, '--fill': 0 });
				s.waiting = true;
				seen.observe(e.target);
			}
		},
		{ rootMargin: '0px 0px 35% 0px' }
	);
	const seen = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				const s = states.get(e.target);
				if (!s || !e.isIntersecting) continue;
				seen.unobserve(e.target);
				s.waiting = false;
				s.entry = write(gsap, s.bits!);
			}
		},
		{ rootMargin: '0px 0px -10% 0px' }
	);

	const onOver = (e: Event) => {
		const el = e.currentTarget as Element;
		const s = states.get(el);
		if (!s || s.waiting) return;
		// the pointer has the last word: an arrival still playing is cut short
		s.entry?.kill();
		s.hover ??= hold(gsap, () => bitsOf(el, s));
		s.hover.empty();
	};
	const onLeave = (e: Event) => states.get(e.currentTarget as Element)?.hover?.fill();

	/*
	 * Display type that is not a heading is marked `data-letter`: it goes to outlines under the
	 * pointer, and nothing more. It may sit under a layer that takes no pointer events (the doors) or be split
	 * already by a timeline of its own (the hero's lines), so the pointer is checked against its box
	 * and whatever letters or words are there get used. Marks that share a value play together: the
	 * doors carry the museum's name twice, half on each.
	 */
	const signs = new Set<HTMLElement>();
	const held = new Map<string, Hold[]>();
	const keyOf = (el: HTMLElement) => {
		const name = el.dataset.letter;
		return name && name !== 'borrow' ? name : `#${[...signs].indexOf(el)}`;
	};
	const own = new Map<Element, { revert(): void }>();
	const lettersIn = (el: HTMLElement) => {
		let leaves = [...el.querySelectorAll('*')].filter((n) => !n.children.length);
		// the hero's lines are split by the film's own timeline: before it has, leave them be
		if (!leaves.length && el.dataset.letter === 'borrow') return [];
		if (!leaves.length) {
			const split = SplitText.create(el, {
				type: joined ? 'words' : 'words,chars',
				aria: 'none'
			});
			own.set(el, split);
			leaves = joined ? split.words : split.chars;
		}
		for (const n of leaves) n.classList.add('kb-ch');
		return leaves;
	};
	let px = -1;
	let py = -1;
	let tick = 0;
	const check = () => {
		tick = 0;
		const hit = new Set<string>();
		for (const el of signs) {
			if (!el.isConnected) {
				signs.delete(el);
				continue;
			}
			const r = el.getBoundingClientRect();
			if (px < r.left || px > r.right || py < r.top || py > r.bottom) continue;
			if (!el.checkVisibility({ visibilityProperty: true })) continue;
			hit.add(keyOf(el));
		}
		for (const key of hit) {
			if (!held.has(key))
				held.set(
					key,
					[...signs].filter((el) => keyOf(el) === key).map((el) => hold(gsap, () => lettersIn(el)))
				);
			for (const h of held.get(key)!) h.empty();
		}
		for (const [key, list] of held) if (!hit.has(key)) for (const h of list) h.fill();
	};
	const onMove = (e: PointerEvent) => {
		if (e.pointerType === 'touch') return;
		px = e.clientX;
		py = e.clientY;
		tick ||= requestAnimationFrame(check);
	};
	// the page can slide out from under a pointer that is holding still
	const onScroll = () => {
		if (px >= 0 && held.size) tick ||= requestAnimationFrame(check);
	};
	if (canHover) {
		window.addEventListener('pointermove', onMove, { passive: true });
		window.addEventListener('scroll', onScroll, { passive: true });
	}

	/*
	 * Everything else that holds words (the header, labels, paragraphs, links) answers the pointer
	 * as one piece: the whole run goes to outline and fills again. Nothing is split, so text the
	 * page keeps rewriting (the cart count, the language, the open menu) is never disturbed.
	 */
	const plain = new WeakMap<Element, Hold>();
	const lit = new Set<Element>();
	const holdsWords = (el: Element) =>
		[...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
	/** Fill every run the pointer is no longer inside. */
	const settle = (now: Element | null) => {
		for (const el of lit) {
			if (now && el.contains(now)) continue;
			plain.get(el)?.fill();
			lit.delete(el);
		}
	};
	const onAny = (e: PointerEvent) => {
		if (e.pointerType === 'touch') return;
		const el = e.target as Element | null;
		settle(el);
		if (!el || el === root || !(el instanceof HTMLElement)) return;
		// letters and marked type have their own way in (the map scene letters its own words as it
		// scrolls); form fields are left alone
		if (el.closest('.kb-ch, .am-ch, [data-letter], [data-no-letter], input, textarea, select'))
			return;
		if (states.has(el) || [...states.keys()].some((h) => h.contains(el))) return;
		if (!holdsWords(el)) return;
		el.classList.add('kb-run');
		let h = plain.get(el);
		if (!h) plain.set(el, (h = hold(gsap, () => [el])));
		h.empty();
		lit.add(el);
	};
	const onGone = (e: PointerEvent) => settle(e.relatedTarget as Element | null);
	if (canHover) {
		root.addEventListener('pointerover', onAny, { passive: true });
		root.addEventListener('pointerout', onGone, { passive: true });
		// out of the window altogether
		document.documentElement.addEventListener('pointerleave', onGone, { passive: true });
	}

	const scan = () => {
		for (const el of root.querySelectorAll<HTMLElement>('[data-letter]')) signs.add(el);
		for (const el of root.querySelectorAll('h1, h2, h3')) {
			if (states.has(el) || el.closest(SKIP) || el.matches('[data-letter]')) continue;
			if (!el.textContent?.trim()) continue;
			states.set(el, { waiting: false });
			near.observe(el);
			if (canHover) {
				el.addEventListener('pointerenter', onOver);
				el.addEventListener('pointerleave', onLeave);
			}
		}
		// headings of a page that has gone
		for (const el of states.keys()) if (!el.isConnected) states.delete(el);
	};
	const cancelFirst = whenIdle(scan);

	return {
		scan,
		destroy() {
			cancelFirst();
			near.disconnect();
			seen.disconnect();
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('scroll', onScroll);
			root.removeEventListener('pointerover', onAny);
			root.removeEventListener('pointerout', onGone);
			document.documentElement.removeEventListener('pointerleave', onGone);
			cancelAnimationFrame(tick);
			for (const list of held.values()) for (const h of list) h.kill();
			for (const el of lit) plain.get(el)?.kill();
			lit.clear();
			for (const [el, split] of own) if (el.isConnected) split.revert();
			signs.clear();
			for (const [el, s] of states) {
				el.removeEventListener('pointerenter', onOver);
				el.removeEventListener('pointerleave', onLeave);
				s.hover?.kill();
				if (s.bits) gsap.killTweensOf(s.bits);
				if (el.isConnected) s.split?.revert();
			}
			states.clear();
		}
	};
}
