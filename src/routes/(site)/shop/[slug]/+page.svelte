<script lang="ts">
	import { enhance } from '$app/forms';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { money, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';

	let { data, form } = $props();

	const locale = $derived(getLocale());
	const p = $derived(data.product);

	const firstOnSale = (list: typeof data.variants) => list.find((v) => v.available === null || v.available > 0) ?? list[0];
	const defaultOf = <T extends { id: number; isDefault: boolean }>(list: T[]) => (list.find((o) => o.isDefault) ?? list[0])?.id ?? null;

	// Choices start from the product's defaults, and start over on another product's page.
	let variantId = $derived(firstOnSale(data.variants).id);
	let roastLevelId = $derived(defaultOf(data.roasts));
	let grindId = $derived(defaultOf(data.grinds));
	let packagingId = $derived(defaultOf(data.packs));
	/** Back to one bag whenever the size changes, so it never asks for more than are on hand. */
	let quantity = $derived.by(() => {
		void variantId;
		return 1;
	});
	let shown = $derived.by(() => {
		void data.product.id;
		return 0;
	});
	let adding = $state(false);

	const variant = $derived(data.variants.find((v) => v.id === variantId) ?? data.variants[0]);
	const pack = $derived(data.packs.find((k) => k.id === packagingId));
	const unit = $derived(variant.price + (pack?.surcharge ?? 0));
	const maxQty = $derived(variant.available === null ? 50 : Math.min(50, variant.available));
	const soldOut = $derived(variant.available !== null && variant.available <= 0);
	const pictures = $derived(data.images.length ? data.images : [{ src: p.picture, alt: null }]);
	const sizeName = (v: (typeof data.variants)[number]) => tr(v.name ?? v.size ?? '', locale);
	/** The summary, unless it only repeats the tasting notes shown above it. */
	const summary = $derived.by(() => {
		const text = p.summary ? tr(p.summary, locale) : '';
		const notes = p.tastingNotes ? tr(p.tastingNotes, locale) : '';
		const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
		return text && bare(text) !== bare(notes) ? text : '';
	});
</script>

<svelte:head>
	<!-- An SEO title is written whole (it names the brand); otherwise the product's name. -->
	<title>{(p.seoTitle && tr(p.seoTitle, locale)) || `${tr(p.name, locale)} · Kebena`}</title>
	{#if p.seoDescription || p.summary}
		<meta name="description" content={tr(p.seoDescription ?? p.summary ?? '', locale)} />
	{/if}
</svelte:head>

<div class="page">
	<div class="wrap">
		<a class="back label" href={siteHref('/shop', locale)}>← {m.shop_back()}</a>
	</div>

	<div class="section split detail">
		<div class="gallery">
			<img class="main" src={pictures[shown].src} alt={tr(pictures[shown].alt ?? p.name, locale)} width="900" height="900" />
			{#if pictures.length > 1}
				<div class="thumbs">
					{#each pictures as pic, i (pic.src)}
						<button type="button" class:on={i === shown} onclick={() => (shown = i)} aria-label={m.shop_picture({ n: i + 1 })}>
							<img src={pic.src} alt="" loading="lazy" width="120" height="120" />
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="buy">
			<header class="intro">
				{#if p.category}<p class="label">{tr(p.category, locale)}</p>{/if}
				<h1 class="name">{tr(p.name, locale)}</h1>
				{#if p.tastingNotes && tr(p.tastingNotes, locale)}<p class="notes">{tr(p.tastingNotes, locale)}</p>{/if}
				{#if summary}<p class="lede">{summary}</p>{/if}
			</header>

			<form
				method="POST"
				action="?/add"
				class="form"
				use:enhance={() => {
					adding = true;
					return async ({ update }) => {
						await update({ reset: false });
						adding = false;
					};
				}}
			>
				<fieldset>
					<legend>{data.variants.some((v) => v.size) ? m.shop_size() : m.shop_option()}</legend>
					<div class="opts">
						{#each data.variants as v (v.id)}
							<label class="opt">
								<input type="radio" name="variantId" value={v.id} bind:group={variantId} disabled={v.available !== null && v.available <= 0} />
								<span class="big">{sizeName(v)}</span>
								<span class="small">
									{money(v.price)}
									{#if v.compareAtPrice && v.compareAtPrice > v.price}<s>{money(v.compareAtPrice)}</s>{/if}
								</span>
								{#if v.available !== null && v.available <= 0}<span class="small">{m.shop_sold_out()}</span>{/if}
							</label>
						{/each}
					</div>
				</fieldset>

				{#if data.roasts.length}
					<fieldset>
						<legend>{m.shop_roast()}</legend>
						<div class="opts">
							{#each data.roasts as r (r.id)}
								<label class="opt">
									<input type="radio" name="roastLevelId" value={r.id} bind:group={roastLevelId} />
									<span class="mid">{tr(r.name, locale)}</span>
									{#if r.description && tr(r.description, locale)}<span class="small">{tr(r.description, locale)}</span>{/if}
								</label>
							{/each}
						</div>
					</fieldset>
				{/if}

				{#if data.grinds.length}
					<fieldset>
						<legend>{m.shop_grind()}</legend>
						<div class="opts">
							{#each data.grinds as g (g.id)}
								<label class="opt">
									<input type="radio" name="grindId" value={g.id} bind:group={grindId} />
									<span class="mid">{tr(g.name, locale)}</span>
								</label>
							{/each}
						</div>
					</fieldset>
				{/if}

				{#if data.packs.length > 1}
					<fieldset>
						<legend>{m.shop_packaging()}</legend>
						<div class="opts">
							{#each data.packs as k (k.id)}
								<label class="opt">
									<input type="radio" name="packagingId" value={k.id} bind:group={packagingId} />
									<span class="mid">{tr(k.name, locale)}</span>
									<span class="small">{k.surcharge > 0 ? `+ ${money(k.surcharge)}` : m.shop_included()}</span>
								</label>
							{/each}
						</div>
					</fieldset>
				{:else if packagingId}
					<input type="hidden" name="packagingId" value={packagingId} />
				{/if}

				<fieldset>
					<legend>{m.shop_quantity()}</legend>
					<div class="count">
						<button type="button" aria-label={m.shop_fewer()} disabled={quantity <= 1} onclick={() => quantity--}>−</button>
						<output aria-live="polite">{quantity}</output>
						<button type="button" aria-label={m.shop_more()} disabled={quantity >= maxQty} onclick={() => quantity++}>+</button>
					</div>
					<input type="hidden" name="quantity" value={quantity} />
				</fieldset>

				<div class="send">
					<p class="sum">
						<span class="price">{money(unit * quantity)}</span>
						{#if quantity > 1}<span class="muted"> · {m.shop_each({ price: money(unit) })}</span>{/if}
					</p>
					{#if p.roastToOrder}
						<p class="hint">{m.shop_roast_note()}</p>
					{:else if variant.available !== null && variant.available > 0 && variant.available <= 5}
						<p class="hint">{m.shop_only_left({ count: variant.available })}</p>
					{/if}
					<button class="btn" disabled={soldOut || adding}>{soldOut ? m.shop_sold_out() : m.shop_add()}</button>
					{#if form?.added}
						<p class="notice ok" role="status">
							{m.shop_added({ count: form.added })}
							<a class="link" href={siteHref('/cart', locale)}>{m.shop_view_cart()}</a>
						</p>
					{:else if form?.error}
						<p class="notice bad" role="alert">{form.error}</p>
					{/if}
				</div>
			</form>
		</div>
	</div>

	{#if (p.description && tr(p.description, locale)) || (p.originStory && tr(p.originStory, locale)) || data.origins.length}
		<div class="section story">
			{#if p.description && tr(p.description, locale)}
				<section>
					<h2 class="section-title">{m.shop_about()}</h2>
					<!-- Sanitised when saved in the dashboard (`sanitizeRichHtml`). -->
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<div class="rich">{@html tr(p.description, locale)}</div>
				</section>
			{/if}
			{#if (p.originStory && tr(p.originStory, locale)) || data.origins.length}
				<section>
					<h2 class="section-title">{m.shop_origin()}</h2>
					{#if p.originStory && tr(p.originStory, locale)}<p class="muted">{tr(p.originStory, locale)}</p>{/if}
					{#if data.origins.length}
						<ul class="origins">
							{#each data.origins as o, i (i)}
								<li>
									<span>{tr(o.station ?? '', locale)}</span>
									{#if o.lot}<span class="muted num">{o.lot}</span>{/if}
									{#if o.share}<span class="muted num">{o.share}%</span>{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</div>

<style>
	.back {
		display: inline-flex;
		min-height: 44px;
		align-items: center;
		color: var(--ink);
		text-decoration: none;
	}
	.detail {
		margin-top: 16px;
	}
	@media (width >= 860px) {
		.detail {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
		.gallery {
			position: sticky;
			top: 104px;
		}
	}
	.gallery {
		display: grid;
		gap: 12px;
		align-content: start;
	}
	.main {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border: 1px solid var(--hair);
		border-radius: 24px;
		background: var(--well);
	}
	.thumbs {
		display: flex;
		gap: 10px;
		overflow-x: auto;
	}
	.thumbs button {
		flex: none;
		width: 72px;
		height: 72px;
		padding: 0;
		overflow: hidden;
		border: 2px solid transparent;
		border-radius: 12px;
		background: none;
		cursor: pointer;
	}
	.thumbs button.on {
		border-color: var(--accent-ink);
	}
	.thumbs img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.buy {
		display: grid;
		gap: 28px;
		align-content: start;
	}
	.intro {
		display: grid;
		gap: 12px;
	}
	.name {
		font-size: clamp(2.2rem, 5vw, 3.6rem);
		font-weight: 800;
		line-height: 0.98;
		text-transform: uppercase;
	}
	.notes {
		margin: 0;
		color: var(--accent-ink);
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 600;
	}
	.intro .lede {
		max-width: none;
	}
	.opt s {
		margin-inline-start: 6px;
		opacity: 0.7;
	}
	.send {
		display: grid;
		gap: 14px;
		padding-top: 24px;
		border-top: 1px solid var(--hair);
	}
	.sum {
		margin: 0;
		font-size: 1.05rem;
	}
	.sum .price {
		font-size: 1.8rem;
	}
	.send .hint {
		margin: 0;
	}
	.story {
		display: grid;
		gap: clamp(28px, 5vw, 72px);
	}
	@media (width >= 860px) {
		.story {
			grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
		}
	}
	.rich :global(p) {
		margin: 0 0 1em;
		max-width: 65ch;
	}
	.origins {
		display: grid;
		gap: 0;
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
	}
	.origins li {
		display: flex;
		gap: 12px;
		justify-content: space-between;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
	}
</style>
