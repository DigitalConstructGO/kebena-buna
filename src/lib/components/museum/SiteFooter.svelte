<script lang="ts">
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import type { FooterContent } from '#lib/content/museum.js';
	import { m } from '#lib/i18n.ts';

	let { content }: { content: FooterContent } = $props();

	type Link = { label: string; href: string | null };

	/**
	 * A bare "#" has no destination yet, so it shows as plain text. A page of this site (`/shop`,
	 * `/#halls`) is linked in the reader's language.
	 */
	const place = (link: { label: string; href: string }): Link =>
		link.href === '#'
			? { label: link.label, href: null }
			: link.href.startsWith('/')
				? { label: link.label, href: localizeHref(link.href) }
				: link;

	const columns = $derived(
		content.columns
			.map((column) => ({
				title: column.title,
				links: column.links.map(place)
			}))
			.filter((column) => column.links.length > 0)
	);
</script>

<footer class="foot">
	<div class="upper">
		<div class="intro">
			<p class="pk-label">{content.tagline}</p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- same-page anchor -->
			<a class="up" href="#top">
				<svg viewBox="0 0 12 14" aria-hidden="true">
					<path d="M6 13 V1.5 M1 6.5 L6 1.5 L11 6.5" />
				</svg>
				<span>{m.home_footer_back_to_top()}</span>
			</a>
		</div>

		<nav class="cols" aria-label={m.home_footer_nav_label()}>
			{#each columns as column (column.title)}
				<div class="col">
					<h2 class="col-title">{column.title}</h2>
					<ul>
						{#each column.links as link (link.label)}
							<li>
								{#if link.href}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- links come from content -->
									<a href={link.href}>{link.label}</a>
								{:else}
									<span>{link.label}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</nav>
	</div>

	<div class="base">
		<p>{content.legal}</p>
		<p>{content.contact}</p>
	</div>

	<!-- the wordmark is a window: the ring pattern shows through the letters and drifts slowly past.
	     Three flat sheets, so the drift is only a slide: the gold, a sheet of the letters' colour
	     with the rings cut out of it (the one that moves), and the wall with the letters cut out -->
	<div class="mark" aria-hidden="true">
		<div class="behind"><div class="rings"></div></div>
		<svg viewBox="0 0 1000 176" preserveAspectRatio="xMidYMin meet">
			<defs>
				<mask id="foot-word">
					<rect width="1000" height="176" fill="#fff" />
					<text class="word" x="0" y="198" textLength="1000" lengthAdjust="spacingAndGlyphs">
						{content.brand}
					</text>
				</mask>
			</defs>
			<rect class="wall" width="1000" height="176" mask="url(#foot-word)" />
		</svg>
	</div>
	<p class="sr">{content.brand}</p>
</footer>

<style>
	.foot {
		position: relative;
		background: var(--bag-deep);
		color: var(--on-bag);
		padding: clamp(64px, 7vw, 112px) var(--pk-gutter) 0;
		overflow: clip;
	}
	.upper {
		display: grid;
		gap: 44px;
		padding-block-end: clamp(48px, 6vw, 96px);
	}
	.intro {
		display: grid;
		align-content: start;
		justify-items: start;
		gap: 18px;
	}
	.intro .pk-label {
		max-width: 22ch;
		font-size: clamp(15px, 1.5vw, 20px);
		line-height: 1.25;
	}
	.up {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		min-block-size: 44px;
		color: var(--on-bag);
		text-decoration: none;
		font-family: var(--pk-display);
		font-stretch: 75%;
		font-weight: 500;
		font-size: 14px;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.up svg {
		inline-size: 12px;
		block-size: 14px;
		fill: none;
		stroke: var(--gold);
		stroke-width: 1.4;
		transition: transform 0.45s var(--pk-ease);
	}
	.up:hover svg {
		transform: translateY(-4px);
	}

	.cols {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 36px 24px;
	}
	.col-title {
		margin: 0 0 10px;
		padding-block-end: 10px;
		border-block-end: 1px solid var(--hair);
		font-family: var(--pk-display);
		font-stretch: 75%;
		font-weight: 500;
		font-size: 14px;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--gold);
	}
	.col ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.col li > * {
		display: flex;
		align-items: center;
		min-block-size: 44px;
		padding-block: 8px;
		font-size: 17px;
		line-height: 1.25;
	}
	.col a {
		color: var(--on-bag);
		text-decoration: none;
		transition: color 0.3s var(--pk-ease);
	}
	.col a:hover {
		color: var(--gold-soft);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 5px;
	}
	.col span {
		color: var(--on-bag-soft);
	}

	.base {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 6px 32px;
		padding-block: 18px;
		border-block-start: 1px solid var(--hair);
		font-size: 14px;
		color: var(--on-bag-soft);
	}
	.base p {
		margin: 0;
	}

	/* the wordmark, full width, cut by the bottom edge */
	.mark {
		margin-block-start: clamp(20px, 3vw, 48px);
	}
	.mark {
		position: relative;
		overflow: hidden;
	}
	.mark svg {
		position: relative;
		display: block;
		inline-size: 100%;
		block-size: auto;
	}
	.mark text {
		font-family: var(--pk-display);
		font-weight: 800;
		font-stretch: 100%;
		font-size: 262px;
		letter-spacing: 0;
		text-transform: uppercase;
	}
	.word {
		fill: #000;
	}
	/* the wall around the letters, the same as the footer's own */
	.wall {
		fill: var(--bag-deep);
	}
	/* behind the letters: gold, and over it a sheet a shade lighter than the wall with the rings
	   cut out of it. The tile is 52% of the wordmark wide and meets itself at every edge, so the
	   sheet is one tile wider than the wordmark and slides one tile, on the compositor: drawing the
	   rings again on every frame was what made this corner of the page slow */
	/* kept clear of the wall's soft edges, where the sheet would show as a line; the letters stand
	   well inside the sides and the top, and the bottom is cut by the page's own edge */
	.behind {
		position: absolute;
		inset: 6px 6px 0;
		overflow: hidden;
		background: linear-gradient(90deg, var(--gold), var(--gold-soft) 50%, var(--gold));
	}
	.rings {
		position: absolute;
		inset: 0 auto 0 0;
		inline-size: 152%;
		background: color-mix(in srgb, var(--bag) 86%, var(--cream));
		-webkit-mask:
			linear-gradient(#000, #000),
			url('/art/truchet.svg') 0 0 / calc(100% * 52 / 152) auto;
		-webkit-mask-composite: xor;
		mask:
			linear-gradient(#000, #000),
			url('/art/truchet.svg') 0 0 / calc(100% * 52 / 152) auto;
		mask-composite: exclude;
		will-change: transform;
		animation: foot-drift 70s linear infinite;
	}
	@keyframes foot-drift {
		to {
			transform: translateX(calc(-100% * 52 / 152));
		}
	}
	.sr {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (min-width: 700px) {
		.cols {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	@media (min-width: 1100px) {
		.upper {
			grid-template-columns: minmax(0, 0.8fr) minmax(0, 2.2fr);
			gap: clamp(40px, 6vw, 96px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.up svg,
		.col a {
			transition: none;
		}
		.rings {
			animation: none;
		}
	}
</style>
