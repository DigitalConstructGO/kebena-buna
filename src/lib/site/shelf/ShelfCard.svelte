<!--
	One thing on a `Shelf`, in the design's card (`museum/Bag.svelte`): it stands on the shelf — a bag
	(`art`) or its photo (`image`), leaning side-on until the pointer squares it up — over its name,
	a line or two, a price and a hint. A link to its own page; a plain click calls `onpick` instead,
	so a pop-up can open, while a new tab or a visit without script still goes to the page.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Beans from '#lib/components/museum/Beans.svelte';

	let {
		href,
		title,
		eyebrow,
		notes,
		price,
		tag,
		tagOut = false,
		hint,
		turns = false,
		image,
		art,
		beans,
		onpick
	}: {
		href: string;
		title: string;
		/** A line above the name: an event's date. */
		eyebrow?: string;
		/** A line under the name: tasting notes, a summary, how long it takes. */
		notes?: string;
		price?: string;
		/** A badge over the top of what stands: "Sold out", "Roasted to order", "Full". */
		tag?: string;
		/** The badge says it cannot be had. */
		tagOut?: boolean;
		hint: string;
		/** The hint offers to turn it round (a bag); otherwise it points on. */
		turns?: boolean;
		/** A photo, standing on the shelf as a print. */
		image?: string;
		/** What stands instead of a photo: a coffee's bag. */
		art?: Snippet;
		/** Spill roasted beans round its foot, scattered by this seed. */
		beans?: number;
		onpick?: () => void;
	} = $props();

	const pick = (e: MouseEvent) => {
		if (!onpick || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		onpick();
	};
</script>

<li>
	<a class="card" {href} aria-haspopup={onpick ? 'dialog' : undefined} onclick={pick}>
		<span class="stand">
			<span class="spin">
				<span class="lean">
					{#if art}
						{@render art()}
					{:else if image}
						<img
							class="print"
							src={image}
							alt=""
							loading="lazy"
							decoding="async"
							width="480"
							height="480"
						/>
					{/if}
				</span>
			</span>
			<span class="floor" aria-hidden="true"></span>
			{#if beans}<span class="spill"><Beans seed={beans} /></span>{/if}
			{#if tag}<span class={['tag', { out: tagOut }]}>{tag}</span>{/if}
		</span>
		{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
		<span class="name">{title}</span>
		{#if notes}<span class="notes">{notes}</span>{/if}
		{#if price}<span class="price">{price}</span>{/if}
		<span class="hint">
			{#if turns}
				<svg viewBox="0 0 16 16" aria-hidden="true">
					<path
						d="M2.5 8a5.5 5.5 0 0 1 9.6-3.6M13.5 8a5.5 5.5 0 0 1-9.6 3.6M12.5 1.5v3h-3M3.5 14.5v-3h3"
					/>
				</svg>
			{:else}
				<svg viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6h11.5M7.5 1l5 5-5 5" /></svg>
			{/if}
			{hint}
		</span>
	</a>
</li>

<style>
	li {
		display: grid;
	}
	.card {
		--w: var(--unit);
		display: grid;
		grid-template-rows: 1fr;
		grid-auto-rows: auto;
		justify-items: center;
		align-content: start;
		gap: 6px;
		padding: clamp(14px, 2.4vw, 30px) clamp(10px, 1.4vw, 20px) clamp(14px, 2vw, 24px);
		border: 1px solid var(--hair);
		border-radius: 20px;
		background: var(--card);
		color: inherit;
		text-align: center;
		text-decoration: none;
		overflow: clip;
		transition:
			background-color 0.35s ease,
			border-color 0.35s ease;
	}
	.card:hover {
		background: var(--paper);
		border-color: var(--accent-ink);
	}
	.card:focus-visible {
		outline: 2px solid var(--accent-ink);
		outline-offset: 3px;
	}
	.stand {
		position: relative;
		align-self: end;
		display: grid;
		justify-items: center;
		margin-bottom: 6px;
		padding-bottom: calc(var(--unit) * 0.2);
		perspective: 1200px;
	}
	.spin,
	.lean {
		display: block;
		transform-style: preserve-3d;
	}
	/* at rest it stands a little side-on, so you see it has a side; it squares up under the pointer */
	.lean {
		transform: rotateX(-4deg) rotateY(-24deg);
		transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.card:hover .lean {
		transform: rotateX(-2deg) rotateY(18deg);
	}
	/* a photo stands as a print leaning on the shelf */
	.print {
		display: block;
		width: calc(var(--w) * 1.1);
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 14px;
		box-shadow: 0 18px 30px -18px rgb(25 33 27 / 0.6);
	}
	.floor {
		position: absolute;
		left: 50%;
		bottom: 0;
		width: calc(var(--w) * 1.5);
		height: calc(var(--w) * 0.2);
		margin-left: calc(var(--w) * -0.75);
		border-radius: 50%;
		background: radial-gradient(closest-side, rgb(25 33 27 / 0.42), transparent);
		pointer-events: none;
	}
	/* roasted beans spilled round the foot of a bag */
	.spill {
		position: absolute;
		left: 50%;
		bottom: calc(var(--w) * -0.02);
		width: calc(var(--w) * 1.4);
		margin-left: calc(var(--w) * -0.7);
		pointer-events: none;
	}
	.tag {
		position: absolute;
		inset-block-start: 0;
		inset-inline-start: 50%;
		translate: -50% 0;
		padding: 5px 10px;
		border-radius: 999px;
		background: var(--forest-900);
		color: var(--gold-soft);
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 500;
		font-stretch: 75%;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.tag.out {
		background: var(--cherry);
		color: #fff;
	}
	.eyebrow {
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent-ink);
	}
	.name {
		font-family: var(--font-display);
		font-size: clamp(1.05rem, 2vw, 1.5rem);
		font-weight: 800;
		line-height: 1.05;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.notes {
		color: var(--ink-soft);
		font-size: clamp(0.82rem, 1.2vw, 0.95rem);
		line-height: 1.35;
		text-wrap: balance;
	}
	.price {
		font-size: 1rem;
	}
	.hint {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		margin-top: 4px;
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent-ink);
	}
	.hint svg {
		width: 14px;
		height: 14px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
	}
	@media (prefers-reduced-motion: reduce) {
		.lean,
		.card {
			transition: none;
		}
	}
</style>
