<script lang="ts">
	import { onMount } from 'svelte';
	import { setupGsap } from '#lib/gsap.js';
	import { whenIdle } from '#lib/reveal.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import Pouch from './Pouch.svelte';
	import Beans from './Beans.svelte';
	import { bagContent, type BagSize } from '#lib/content/bag.js';
	import { m } from '#lib/i18n.ts';

	const content = $derived(bagContent());

	let root: HTMLElement;
	/** The shop, where every bag size of every coffee is on sale. */
	const orderHref = (_id?: string) => localizeHref('/shop');

	/** The bag picked up off the shelf, and how far it has been turned by hand. */
	let held = $state<BagSize>();
	let viewer = $state<HTMLDialogElement>();
	let turn = $state(-28);
	let tip = $state(-6);
	let touched = $state(false);

	const pick = (size: BagSize) => {
		held = size;
		turn = -28;
		tip = -6;
		touched = false;
		if (!viewer?.open) viewer?.showModal();
	};
	const drop = () => viewer?.close();
	const onviewerclick = (e: MouseEvent) => {
		const t = e.target as HTMLElement;
		if (!t.closest('.sheet') || t.closest('.shut, a[href^="#"]')) drop();
	};

	// drag to turn the bag round; the arrow keys do the same
	let from: { x: number; y: number; turn: number; tip: number } | undefined;
	const ondown = (e: PointerEvent) => {
		from = { x: e.clientX, y: e.clientY, turn, tip };
		touched = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	};
	const onmove = (e: PointerEvent) => {
		if (!from) return;
		turn = from.turn + (e.clientX - from.x) * 0.6;
		tip = Math.max(-22, Math.min(22, from.tip - (e.clientY - from.y) * 0.25));
	};
	const onup = () => (from = undefined);
	const onkey = (e: KeyboardEvent) => {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		touched = true;
		turn += e.key === 'ArrowLeft' ? -30 : 30;
	};

	onMount(() =>
		whenIdle(() => {
			const { gsap } = setupGsap();
			const ctx = gsap.context(() => {
				const mm = gsap.matchMedia();
				mm.add('(prefers-reduced-motion: no-preference)', () => {
					// the bags are set down on the shelf one after another, each turning to face you
					gsap.from('.shelf .card', {
						autoAlpha: 0,
						y: 70,
						duration: 0.9,
						ease: 'power3.out',
						stagger: 0.14,
						scrollTrigger: { trigger: '.shelf', start: 'top 82%', once: true }
					});
					gsap.from('.shelf .spin', {
						rotationY: -70,
						duration: 1.3,
						ease: 'power3.out',
						stagger: 0.14,
						scrollTrigger: { trigger: '.shelf', start: 'top 82%', once: true }
					});
				});
			}, root);
			return () => ctx.revert();
		})
	);
</script>

<section class="bagshow" id="bag" bind:this={root} aria-labelledby="bag-title">
	<!-- the bag's own line art, large and faint, as the wall behind the shelf -->
	<svg class="wall" aria-hidden="true">
		<defs>
			<pattern id="bag-wall-tile" width="384" height="96" patternUnits="userSpaceOnUse">
				<path
					d="M14 96V48a34 34 0 0 1 68 0v48M28 96V48a20 20 0 0 1 40 0v48M42 96V50a6 6 0 0 1 12 0v46"
				/>
				<circle cx="144" cy="40" r="22" />
				<circle cx="144" cy="40" r="10" />
				<path d="M100 96l30-30 22 20 18-16 22 26" />
				<path
					d="M240 90C212 66 212 30 240 8c28 22 28 58 0 82ZM240 8v88M240 40l-14-12M240 40l14-12M240 62l-18-14M240 62l18-14"
				/>
				<path d="M300 96V58h72v38M292 60l44-40 44 40M326 96V74h20v22" />
			</pattern>
		</defs>
		<rect width="100%" height="100%" fill="url(#bag-wall-tile)" />
	</svg>

	<header class="head">
		<p class="pk-label">{content.eyebrow}</p>
		<h2 id="bag-title">{content.title}</h2>
		<p class="lede">{content.text}</p>
	</header>

	<ul class="shelf">
		{#each content.sizes as size, i (size.id)}
			<li>
				<button
					type="button"
					class="card"
					style:--w={`calc(var(--unit) * ${size.scale})`}
					aria-label={m.museum_bag_look_at({ weight: size.weight })}
					onclick={() => pick(size)}
				>
					<span class="stand">
						<span class="spin">
							<span class="lean"><Pouch src={content.photo.src} weight={size.weight} /></span>
						</span>
						<span class="floor" aria-hidden="true"></span>
						<span class="spill"><Beans seed={i + 1} /></span>
					</span>
					<span class="weight">{size.weight}</span>
					<span class="name">{size.name}</span>
					<span class="hint">
						<svg viewBox="0 0 16 16" aria-hidden="true">
							<path
								d="M2.5 8a5.5 5.5 0 0 1 9.6-3.6M13.5 8a5.5 5.5 0 0 1-9.6 3.6M12.5 1.5v3h-3M3.5 14.5v-3h3"
							/>
						</svg>
						{m.museum_bag_turn_hint()}
					</span>
				</button>
			</li>
		{/each}
	</ul>

	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved in orderHref -->
	<a class="go" href={orderHref()}>
		<span>{content.order.all}</span>
		<svg viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6h11.5M7.5 1l5 5-5 5" /></svg>
	</a>

	<!-- a bag picked up off the shelf: drag it round, read the label, order it -->
	<dialog
		class="viewer"
		bind:this={viewer}
		aria-label={held ? m.museum_bag_viewer_label({ weight: held.weight }) : undefined}
		onclick={onviewerclick}
		onclose={() => (held = undefined)}
	>
		{#if held}
			<div class="sheet">
				<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
				<div
					class={['turner', { idle: !touched }]}
					role="img"
					aria-label={m.museum_bag_turner_label({ weight: held.weight })}
					tabindex="0"
					style:--w="clamp(150px, min(30vw, 30vh), 270px)"
					onpointerdown={ondown}
					onpointermove={onmove}
					onpointerup={onup}
					onpointercancel={onup}
					onkeydown={onkey}
				>
					<div class="spin" style:--ry={`${turn}deg`} style:--rx={`${tip}deg`}>
						<Pouch src={content.photo.src} weight={held.weight} eager />
					</div>
					<span class="floor" aria-hidden="true"></span>
					<span class="spill"><Beans seed={7} /></span>
					<p class="drag" aria-hidden="true">{m.museum_bag_drag()}</p>
				</div>

				<div class="about">
					<p class="pk-label">{m.museum_bag_brand()}</p>
					<h3 data-no-letter>{held.weight}</h3>
					<p class="sub">{m.museum_bag_sub({ name: held.name, text: held.text })}</p>
					<dl>
						{#each content.notes as n (n.label)}
							<div>
								<dt>{n.label}</dt>
								<dd>{n.value}</dd>
							</div>
						{/each}
					</dl>
					<div class="sizes" role="group" aria-label={m.museum_bag_sizes_label()}>
						{#each content.sizes as size (size.id)}
							<button
								type="button"
								class={{ on: size.id === held.id }}
								aria-pressed={size.id === held.id}
								onclick={() => (held = size)}
							>
								{size.weight}
							</button>
						{/each}
					</div>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved in orderHref -->
					<a class="go" href={orderHref(held.id)}>
						<span>{content.order.label}</span>
						<svg viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6h11.5M7.5 1l5 5-5 5" /></svg>
					</a>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- same-page anchor -->
					<a class="alt" href={content.visit.href}>{content.visit.label}</a>
				</div>

				<button type="button" class="shut" aria-label={m.museum_bag_put_back()}>
					<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" /></svg>
				</button>
			</div>
		{/if}
	</dialog>
</section>

<style>
	.bagshow {
		position: relative;
		display: grid;
		justify-items: center;
		gap: clamp(28px, 4vw, 48px);
		padding: clamp(72px, 9vw, 128px) var(--pk-gutter) clamp(72px, 9vw, 120px);
		background: var(--paper-tint);
		color: var(--ink);
		overflow: clip;
	}
	/* experiment: flowing dots (bookofshapes.com) behind the shelf, in the theme's own ink */
	.bagshow::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--accent-ink);
		opacity: 0.3;
		pointer-events: none;
		-webkit-mask: url('/art/flow-dots.svg') 50% 0 / 620px auto repeat;
		mask: url('/art/flow-dots.svg') 50% 0 / 620px auto repeat;
	}
	.wall {
		display: none;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		fill: none;
		stroke: var(--accent-ink);
		stroke-width: 1;
		opacity: 0.1;
		pointer-events: none;
	}
	.head {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 14px;
		text-align: center;
	}
	.pk-label {
		color: var(--accent-ink);
	}
	h2 {
		margin: 0;
		max-width: 12ch;
		font-family: var(--font-display);
		font-size: clamp(2.6rem, 7.4vw, 6.4rem);
		font-weight: 800;
		line-height: 0.94;
		letter-spacing: -0.02em;
		text-transform: uppercase;
		text-wrap: balance;
	}
	.lede {
		margin: 0;
		max-width: 40ch;
		font-size: clamp(1.05rem, 1.4vw, 1.25rem);
		line-height: 1.5;
		color: var(--ink-soft);
		text-wrap: pretty;
	}

	/* the shelf: one card a size, each holding its bag */
	.shelf {
		--unit: clamp(96px, 15.5vw, 210px);
		position: relative;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-items: stretch;
		gap: clamp(8px, 1.6vw, 22px);
		width: 100%;
		max-width: 1040px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.shelf li {
		display: grid;
	}
	.card {
		display: grid;
		grid-template-rows: 1fr auto auto auto;
		justify-items: center;
		gap: 6px;
		padding: clamp(14px, 2.4vw, 30px) clamp(6px, 1.4vw, 20px) clamp(14px, 2vw, 24px);
		border: 1px solid var(--hair);
		border-radius: 20px;
		background: var(--card);
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition:
			background-color 0.35s ease,
			border-color 0.35s ease;
	}
	.card:hover {
		background: var(--paper);
		border-color: var(--accent-ink);
	}
	.card:focus-visible,
	.turner:focus-visible,
	.sizes button:focus-visible,
	.alt:focus-visible,
	.shut:focus-visible {
		outline: 2px solid var(--accent-ink);
		outline-offset: 3px;
	}
	.stand {
		position: relative;
		align-self: end;
		display: grid;
		justify-items: center;
		padding-bottom: calc(var(--unit) * 0.2);
		perspective: 1200px;
	}
	.spin,
	.lean {
		display: block;
		transform-style: preserve-3d;
	}
	/* at rest each bag stands a little side-on, so you see it has a side; it squares up under the pointer */
	.lean {
		transform: rotateX(-4deg) rotateY(-24deg);
		transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.card:hover .lean {
		transform: rotateX(-2deg) rotateY(18deg);
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
	/* roasted beans spilled round the foot of the bag */
	.spill {
		position: absolute;
		left: 50%;
		bottom: calc(var(--w) * -0.02);
		width: calc(var(--w) * 1.5);
		margin-left: calc(var(--w) * -0.75);
		pointer-events: none;
	}
	.turner .spill {
		bottom: 18px;
		width: calc(var(--w) * 1.7);
		margin-left: calc(var(--w) * -0.85);
	}
	.weight {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 3.4vw, 2.6rem);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.02em;
	}
	.name {
		font-size: clamp(0.82rem, 1.2vw, 1rem);
		line-height: 1.3;
		color: var(--ink-soft);
		text-align: center;
	}
	.hint {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		margin-top: 6px;
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

	.go {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		min-height: 52px;
		padding: 0 26px;
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
		transition: background-color 0.3s ease;
	}
	.go:hover {
		background: var(--gold-soft);
	}
	.go:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}
	.go svg {
		width: 14px;
		height: 12px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.go:hover svg {
		transform: translateX(4px);
	}

	/* ---------- the bag in your hands ---------- */
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
	.turner {
		position: relative;
		display: grid;
		justify-items: center;
		align-content: center;
		padding: 8px 0 44px;
		perspective: 1300px;
		border-radius: 18px;
		cursor: grab;
		touch-action: pan-y;
		user-select: none;
	}
	.turner:active {
		cursor: grabbing;
	}
	.turner .spin {
		transform: none;
	}
	/* until it is touched, the bag turns slowly by itself so both faces are seen */
	.turner.idle .spin {
		animation: show 9s ease-in-out infinite;
	}
	@keyframes show {
		0%,
		100% {
			transform: rotateY(0deg);
		}
		50% {
			transform: rotateY(205deg);
		}
	}
	.turner .floor {
		bottom: 26px;
	}
	.drag {
		position: absolute;
		bottom: 0;
		margin: 0;
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: 12px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.about {
		display: grid;
		align-content: center;
		justify-items: start;
		gap: 12px;
	}
	.about h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2.6rem, 7vw, 4.6rem);
		font-weight: 800;
		line-height: 0.9;
		letter-spacing: -0.03em;
	}
	.sub {
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.45;
		color: var(--ink-soft);
	}
	dl {
		display: grid;
		gap: 0;
		width: 100%;
		margin: 4px 0;
	}
	dl div {
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr);
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--hair);
		font-size: 15px;
		line-height: 1.35;
	}
	dt {
		color: var(--accent-ink);
	}
	dd {
		margin: 0;
	}
	.sizes {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.sizes button {
		min-height: 44px;
		padding: 0 18px;
		border: 1px solid var(--hair);
		border-radius: 999px;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 15px;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}
	.sizes button.on {
		border-color: var(--accent-ink);
		background: var(--gold);
		color: var(--bag-deep);
		font-weight: 600;
	}
	.about .go {
		width: 100%;
		margin-top: 4px;
	}
	.alt {
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

	@media (min-width: 760px) {
		.sheet {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: center;
		}
		.turner {
			--w: clamp(200px, 22vw, 290px) !important;
			min-height: 460px;
		}
	}
	@media (max-width: 759px) {
		/* the sheet is taller than a phone: the way to order stays in reach while it scrolls */
		.about .go {
			position: sticky;
			bottom: 12px;
			z-index: 1;
			box-shadow: 0 10px 24px -10px rgb(0 0 0 / 0.55);
		}
	}
	@media (max-width: 520px) {
		.hint {
			font-size: 0;
			gap: 0;
		}
		/* three narrow cards: the beans stay inside their own card and the name sets smaller */
		.card {
			overflow: clip;
		}
		.spill {
			width: calc(var(--w) * 1.24);
			margin-left: calc(var(--w) * -0.62);
		}
		.name {
			font-size: 0.78rem;
			line-height: 1.25;
			text-wrap: balance;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.lean,
		.go,
		.go svg,
		.card {
			transition: none;
		}
		.sheet,
		.viewer::backdrop,
		.turner.idle .spin {
			animation: none;
		}
	}
</style>
