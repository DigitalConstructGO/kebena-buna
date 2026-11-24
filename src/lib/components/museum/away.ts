import type { Attachment } from 'svelte/attachments';

/**
 * Marks the element `data-away` while it is off screen, so a CSS loop inside it can stop there
 * (`[data-away] … { animation-play-state: paused }`), or a heavy picture stop being drawn at all. A loop nobody can see still has the browser
 * make a frame for it, and re-sort the whole page's layers, many times a second: on a phone that
 * kept the main thread half busy at the foot of the page.
 */
export const awayWhenHidden: Attachment<Element> = (node) => {
	// a little ahead of the screen, so whatever comes back is drawn before it shows
	const io = new IntersectionObserver(
		([e]) => node.toggleAttribute('data-away', !e.isIntersecting),
		{ rootMargin: '25% 0px' }
	);
	io.observe(node);
	return () => io.disconnect();
};
