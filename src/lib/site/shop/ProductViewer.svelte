<!--
	A product picked up off the shop's shelf, in the museum design's bag viewer (`museum/Bag.svelte`):
	a coffee is its bag, to drag round; anything else is its photo. Choose a size and add it to the
	cart from here, on the product's default roast, grind and packaging (what the product page starts
	on); the product page has every other choice. Open it with `show(product)`.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { money, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';
	import Pouch from '#lib/components/museum/Pouch.svelte';
	import Beans from '#lib/components/museum/Beans.svelte';
	import Sheet from '#lib/site/shelf/Sheet.svelte';
	import type { ShelfProduct } from './types.ts';

	/** The Kebena bag every coffee is sold in: its printed front. */
	const BAG = '/hero/bag-front.jpg';

	const locale = $derived(getLocale());

	let held = $state<ShelfProduct>();
	let variantId = $state<number>();
	let sheet = $state<ReturnType<typeof Sheet>>();
	let turn = $state(-28);
	let tip = $state(-6);
	let touched = $state(false);
	let adding = $state(false);
	let added = $state(false);
	let failed = $state<string>();

	const onSale = (v: ShelfProduct['variants'][number]) => v.available === null || v.available > 0;
	const variant = $derived(held?.variants.find((v) => v.id === variantId));
	const sizeOf = (v: ShelfProduct['variants'][number]) => tr(v.size ?? v.name ?? '', locale);
	const notes = $derived.by(() => {
		if (!held) return [];
		const stations = [...new Set(held.origins.map((o) => tr(o, locale)).filter(Boolean))];
		return [
			{ label: m.shop_tasting(), value: tr(held.tastingNotes, locale) },
			{ label: m.shop_roast(), value: held.roast ? tr(held.roast.name, locale) : '' },
			{ label: m.shop_origin(), value: stations.join(', ') }
		].filter((n) => n.value);
	});

	/** The summary, unless it only repeats the tasting notes listed under it (as on the product page). */
	const summary = $derived.by(() => {
		const text = held ? tr(held.summary, locale) : '';
		const bare = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
		return text && held && bare(text) !== bare(tr(held.tastingNotes, locale)) ? text : '';
	});

	export function show(product: ShelfProduct) {
		held = product;
		variantId = (product.variants.find(onSale) ?? product.variants[0])?.id;
		turn = -28;
		tip = -6;
		touched = false;
		added = false;
		failed = undefined;
		sheet?.show();
	}
	const pickSize = (id: number) => {
		variantId = id;
		added = false;
		failed = undefined;
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
</script>

<Sheet
	bind:this={sheet}
	label={held ? tr(held.name, locale) : undefined}
	onclose={() => (held = undefined)}
>
	{#if held}
		{@const name = tr(held.name, locale)}
		{#if held.kind === 'coffee'}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
			<div
				class={['turner', { idle: !touched }]}
				role="img"
				aria-label={m.shop_turn_help({ name })}
				tabindex="0"
				style:--w="clamp(150px, min(30vw, 30vh), 270px)"
				onpointerdown={ondown}
				onpointermove={onmove}
				onpointerup={onup}
				onpointercancel={onup}
				onkeydown={onkey}
			>
				<div class="spin" style:--ry={`${turn}deg`} style:--rx={`${tip}deg`}>
					<Pouch src={BAG} weight={variant ? sizeOf(variant) : ''} {name} eager />
				</div>
				<span class="floor" aria-hidden="true"></span>
				<span class="spill"><Beans seed={7} /></span>
				<p class="drag" aria-hidden="true">{m.shop_drag()}</p>
			</div>
		{:else}
			<div class="photo">
				<img src={held.image} alt="" width="480" height="480" />
			</div>
		{/if}

		<div class="about">
			<p class="pk-label">{held.kind === 'coffee' ? m.shop_brand_coffee() : m.shop_label()}</p>
			<h3>{name}</h3>
			{#if summary}<p class="sub">{summary}</p>{/if}
			{#if notes.length}
				<dl>
					{#each notes as n (n.label)}
						<div>
							<dt>{n.label}</dt>
							<dd>{n.value}</dd>
						</div>
					{/each}
				</dl>
			{/if}
			{#if held.roastToOrder}<p class="sub small">{m.shop_roast_note()}</p>{/if}

			{#if held.variants.length > 1}
				<div
					class="sizes"
					role="group"
					aria-label={held.variants.some((v) => v.size) ? m.shop_size() : m.shop_option()}
				>
					{#each held.variants as v (v.id)}
						<button
							type="button"
							class={{ on: v.id === variantId }}
							aria-pressed={v.id === variantId}
							disabled={!onSale(v)}
							onclick={() => pickSize(v.id)}
						>
							{sizeOf(v)}
						</button>
					{/each}
				</div>
			{/if}

			{#if variant}
				<form
					method="POST"
					action="{siteHref(`/shop/${held.slug}`, locale)}?/add"
					use:enhance={() => {
						adding = true;
						failed = undefined;
						return async ({ result, update }) => {
							if (result.type === 'success') added = true;
							else if (result.type === 'failure')
								failed =
									(result.data as { error?: string } | undefined)?.error ?? m.shop_add_invalid();
							// Stay on the shelf: SvelteKit 3 otherwise follows the post to the product's page.
							await update({ reset: false, navigate: false });
							adding = false;
						};
					}}
				>
					<input type="hidden" name="variantId" value={variant.id} />
					<input type="hidden" name="roastLevelId" value={held.roast?.id ?? ''} />
					<input type="hidden" name="grindId" value={held.grindId ?? ''} />
					<input type="hidden" name="packagingId" value={held.packagingId ?? ''} />
					<input type="hidden" name="quantity" value="1" />
					{#if added}
						<p class="ok" role="status">{m.shop_added({ count: 1 })}</p>
						<a class="go" href={siteHref('/cart', locale)}>
							<span>{m.shop_view_cart()}</span>
							<svg viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6h11.5M7.5 1l5 5-5 5" /></svg>
						</a>
					{:else}
						<button class="go" disabled={adding || !onSale(variant)}>
							<span>
								{onSale(variant) ? `${m.shop_add()} · ${money(variant.price)}` : m.shop_sold_out()}
							</span>
							<svg viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6h11.5M7.5 1l5 5-5 5" /></svg>
						</button>
					{/if}
					{#if failed}<p class="error" role="alert">{failed}</p>{/if}
				</form>
			{/if}
			<a class="alt" href={siteHref(`/shop/${held.slug}`, locale)}>{m.shop_details()}</a>
		</div>
	{/if}
</Sheet>

<style>
	/* The bag in your hands (`museum/Bag.svelte`); the sheet and its text are `shelf/Sheet.svelte`'s. */
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
	.turner:focus-visible,
	.sizes button:focus-visible {
		outline: 2px solid var(--accent-ink);
		outline-offset: 3px;
	}
	.spin {
		display: block;
		transform-style: preserve-3d;
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
	.floor {
		position: absolute;
		left: 50%;
		bottom: 26px;
		width: calc(var(--w) * 1.5);
		height: calc(var(--w) * 0.2);
		margin-left: calc(var(--w) * -0.75);
		border-radius: 50%;
		background: radial-gradient(closest-side, rgb(25 33 27 / 0.42), transparent);
		pointer-events: none;
	}
	.spill {
		position: absolute;
		left: 50%;
		bottom: 18px;
		width: calc(var(--w) * 1.7);
		margin-left: calc(var(--w) * -0.85);
		pointer-events: none;
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
	.sub.small {
		font-size: 14px;
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
	.sizes button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	form {
		display: grid;
		gap: 10px;
		width: 100%;
		margin-top: 4px;
	}
	.ok {
		margin: 0;
		color: var(--ok);
		font-weight: 600;
	}

	@media (min-width: 760px) {
		.turner {
			--w: clamp(200px, 22vw, 290px) !important;
			min-height: 460px;
		}
	}
	@media (max-width: 759px) {
		/* the sheet is taller than a phone: adding to the cart stays in reach while it scrolls */
		form {
			position: sticky;
			bottom: 12px;
			z-index: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.turner.idle .spin {
			animation: none;
		}
	}
</style>
