import widths from '#lib/content/image-widths.json';

const W: Record<string, number> = widths;

/**
 * A `srcset` for photos that also ship a 480px copy (`name-480.webp`), so a card
 * shown 300px wide never downloads the 1000px original. Undefined for anything
 * without a small copy, which leaves the plain `src` in charge.
 */
export function srcsetFor(src: string): string | undefined {
	const w = W[src];
	return w ? `${src.replace(/\.webp$/, '-480.webp')} 480w, ${src} ${w}w` : undefined;
}
