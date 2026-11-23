<!--
	The pop-up of a thing picked up off a `Shelf`: the design's bag viewer (`museum/Bag.svelte`), a
	sheet over the dimmed page. Open it with `show()`; a click outside or on ✕ puts it back.

	Its children lay it out with the design's classes, styled here: `.photo` (a picture), `.about`
	(the text column) holding `.pk-label`, `h3`, `.sub`, a `dl` of facts, `.go` (the way on) and
	`.alt` (a quieter link).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/i18n.ts';

	let { label, onclose, children }: { label?: string; onclose?: () => void; children: Snippet } =
		$props();

	let dialog = $state<HTMLDialogElement>();

	export function show() {
		if (!dialog?.open) dialog?.showModal();
	}
	export function close() {
		dialog?.close();
	}
	const onclick = (e: MouseEvent) => {
		const t = e.target as HTMLElement;
		if (!t.closest('.sheet') || t.closest('.shut')) close();
	};
</script>

<dialog class="viewer" bind:this={dialog} aria-label={label} {onclick} {onclose}>
	<div class="sheet">
		{@render children()}
		<button type="button" class="shut" aria-label={m.shop_put_back()}>
			<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" /></svg>
		</button>
	</div>
</dialog>

<style>
	.viewer {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		overflow: auto;
	}
	.viewer[open] {
		display: grid;
		place-items: center;
	}
	.viewer::backdrop {
		background: rgb(14 19 15 / 0.72);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		animation: dusk 0.35s ease both;
	}
	.sheet {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 8px 40px;
		width: min(92vw, 900px);
		margin: 16px 0;
		padding: clamp(18px, 3vw, 36px);
		border: 1.5px solid var(--accent-ink);
		border-radius: 26px;
		background: var(--paper);
		box-shadow:
			inset 0 0 0 5px var(--paper),
			inset 0 0 0 6px var(--hair),
			0 40px 90px -30px rgb(0 0 0 / 0.8);
		animation: rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(40px) scale(0.94);
		}
	}
	@keyframes dusk {
		from {
			opacity: 0;
		}
	}

	/* a picture, framed like a card on the shelf */
	.sheet :global(.photo) {
		align-self: center;
		overflow: hidden;
		border: 1px solid var(--hair);
		border-radius: 20px;
		background: var(--well);
	}
	.sheet :global(.photo img) {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		object-fit: cover;
	}
	.sheet :global(.about) {
		display: grid;
		align-content: center;
		justify-items: start;
		gap: 12px;
	}
	.sheet :global(.about h3) {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 3.4rem);
		font-weight: 800;
		line-height: 0.95;
		letter-spacing: -0.03em;
	}
	.sheet :global(.sub) {
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.45;
		color: var(--ink-soft);
	}
	.sheet :global(dl) {
		display: grid;
		gap: 0;
		width: 100%;
		margin: 4px 0;
	}
	.sheet :global(dl div) {
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr);
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--hair);
		font-size: 15px;
		line-height: 1.35;
	}
	.sheet :global(dt) {
		color: var(--accent-ink);
	}
	.sheet :global(dd) {
		margin: 0;
	}
	.sheet :global(.go) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		width: 100%;
		min-height: 52px;
		padding: 0 26px;
		border: 0;
		border-radius: 999px;
		background: var(--gold);
		color: var(--bag-deep);
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: 15px;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.3s ease;
	}
	.sheet :global(.go:hover:not(:disabled)) {
		background: var(--gold-soft);
	}
	.sheet :global(.go:disabled) {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.sheet :global(.go svg) {
		width: 14px;
		height: 12px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.sheet :global(.go:hover svg) {
		transform: translateX(4px);
	}
	.sheet :global(.alt) {
		justify-self: center;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		color: var(--ink);
		font-size: 15px;
		text-underline-offset: 4px;
	}
	.shut {
		position: absolute;
		top: 14px;
		right: 14px;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 1px solid var(--hair);
		border-radius: 50%;
		background: var(--paper-tint);
		color: var(--ink);
		cursor: pointer;
	}
	.shut svg {
		width: 14px;
		height: 14px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
	}
	.shut:focus-visible,
	.sheet :global(.alt:focus-visible),
	.sheet :global(.go:focus-visible) {
		outline: 2px solid var(--accent-ink);
		outline-offset: 3px;
	}

	@media (min-width: 760px) {
		.sheet {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: center;
		}
	}
	@media (max-width: 759px) {
		/* the sheet is taller than a phone: the way on stays in reach while it scrolls */
		.sheet :global(.go) {
			position: sticky;
			bottom: 12px;
			z-index: 1;
			box-shadow: 0 10px 24px -10px rgb(0 0 0 / 0.55);
		}
		.sheet :global(.photo) {
			max-width: 320px;
			justify-self: center;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet :global(.go),
		.sheet :global(.go svg) {
			transition: none;
		}
		.sheet,
		.viewer::backdrop {
			animation: none;
		}
	}
</style>
