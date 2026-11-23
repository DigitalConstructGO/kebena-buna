import { setupGsap } from '#lib/gsap.js';

/**
 * Run `setup` once the main thread is idle after load, so below-the-fold sections never
 * compete with the first paint. Returns a cleanup that cancels or reverts it.
 */
export function whenIdle(setup: () => (() => void) | void) {
	let undo: (() => void) | void;
	let dead = false;
	const run = () => {
		if (!dead) undo = setup();
	};
	const ric = 'requestIdleCallback' in window;
	const id = ric ? window.requestIdleCallback(run, { timeout: 2000 }) : window.setTimeout(run, 300);
	return () => {
		dead = true;
		if (ric) window.cancelIdleCallback(id);
		else window.clearTimeout(id);
		undo?.();
	};
}

/**
 * Fade-and-rise every `[data-reveal]` element inside `root` as it scrolls into view.
 * One batched ScrollTrigger per section (cheap), plays once, transform/opacity only.
 * Returns the cleanup for onMount.
 */
export function reveal(root: HTMLElement, extra?: (gsap: ReturnType<typeof setupGsap>) => void) {
	return whenIdle(() => setupReveal(root, extra));
}

function setupReveal(root: HTMLElement, extra?: (gsap: ReturnType<typeof setupGsap>) => void) {
	const tools = setupGsap();
	const { gsap, ScrollTrigger } = tools;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const ctx = gsap.context(() => {
		const items = gsap.utils.toArray<HTMLElement>('[data-reveal]', root);
		if (items.length) {
			gsap.set(items, { autoAlpha: 0, y: 28 });
			ScrollTrigger.batch(items, {
				start: 'top 88%',
				once: true,
				onEnter: (batch) =>
					gsap.to(batch, {
						autoAlpha: 1,
						y: 0,
						duration: 0.8,
						ease: 'power3.out',
						stagger: 0.08,
						overwrite: true
					})
			});
		}
		extra?.(tools);
	}, root);
	return () => ctx.revert();
}
