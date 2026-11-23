<script lang="ts">
	import { onMount } from 'svelte';
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

	/* the rings drift through the wordmark, unless the visitor asked for stillness */
	let moving = $state(false);
	onMount(() => {
		moving = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	});

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

	<!-- the wordmark is a window: the ring pattern shows through the letters and drifts slowly past -->
	<div class="mark" aria-hidden="true">
		<svg viewBox="0 0 1000 176" preserveAspectRatio="xMidYMin meet">
			<defs>
				<mask id="foot-word">
					<text class="word" x="0" y="198" textLength="1000" lengthAdjust="spacingAndGlyphs">
						{content.brand}
					</text>
				</mask>
				<!-- the tiles meet at every edge, so the 520-unit square repeats without a seam -->
				<pattern id="foot-tile" width="520" height="520" patternUnits="userSpaceOnUse">
					<image href="/art/truchet.svg" width="520" height="520" />
					{#if moving}
						<animateTransform
							attributeName="patternTransform"
							type="translate"
							from="0 0"
							to="-520 0"
							dur="70s"
							repeatCount="indefinite"
						/>
					{/if}
				</pattern>
				<mask id="foot-rings" style="mask-type: alpha">
					<rect width="1000" height="176" fill="url(#foot-tile)" />
				</mask>
				<linearGradient id="foot-shade" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stop-color="var(--gold)" />
					<stop offset="0.5" stop-color="var(--gold-soft)" />
					<stop offset="1" stop-color="var(--gold)" />
				</linearGradient>
			</defs>
			<g mask="url(#foot-word)">
				<rect class="body" width="1000" height="176" />
				<rect class="lines" width="1000" height="176" mask="url(#foot-rings)" />
			</g>
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
	.mark svg {
		display: block;
		inline-size: 100%;
		block-size: auto;
		overflow: hidden;
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
		fill: #fff;
	}
	/* the letters: a shade lighter than the wall, ruled with gold rings, edged with a hairline */
	.body {
		fill: color-mix(in srgb, var(--bag) 86%, var(--cream));
	}
	.lines {
		fill: url(#foot-shade);
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
	}
</style>
