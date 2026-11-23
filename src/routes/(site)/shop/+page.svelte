<script lang="ts">
	import { page } from '$app/state';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { money, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';

	let { data } = $props();

	const locale = $derived(getLocale());
	/** `?c=specialty` narrows the shop to one category; links, so it works without script. */
	const current = $derived(data.categories.find((c) => c.slug === page.url.searchParams.get('c')) ?? null);
	const groups = $derived(
		(current ? [current] : data.categories)
			.map((c) => ({ category: c, products: data.products.filter((p) => p.categoryId === c.id) }))
			.filter((g) => g.products.length)
	);
	const uncategorised = $derived(current ? [] : data.products.filter((p) => !data.categories.some((c) => c.id === p.categoryId)));
</script>

<svelte:head>
	<title>{m.shop_title()} · Kebena</title>
	<meta name="description" content={m.shop_lede()} />
</svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.shop_label()}</p>
		<h1 class="title">{m.shop_title()}</h1>
		<p class="lede">{m.shop_lede()}</p>
	</header>

	{#if data.categories.length > 1}
		<nav class="section chips" aria-label={m.shop_categories()}>
			<a href={siteHref('/shop', locale)} aria-current={current ? undefined : 'page'}>{m.shop_all()}</a>
			{#each data.categories as c (c.id)}
				<a href="{siteHref('/shop', locale)}?c={c.slug}" aria-current={current?.id === c.id ? 'page' : undefined}>{tr(c.name, locale)}</a>
			{/each}
		</nav>
	{/if}

	{#each groups as g (g.category.id)}
		<section class="section" aria-labelledby="cat-{g.category.slug}">
			<h2 class="section-title" id="cat-{g.category.slug}">{tr(g.category.name, locale)}</h2>
			{#if g.category.description && tr(g.category.description, locale)}
				<p class="muted cat-lede">{tr(g.category.description, locale)}</p>
			{/if}
			{@render grid(g.products)}
		</section>
	{/each}
	{#if uncategorised.length}
		<section class="section">{@render grid(uncategorised)}</section>
	{/if}
	{#if !data.products.length}
		<p class="section notice">{m.shop_empty()}</p>
	{/if}
</div>

{#snippet grid(products: typeof data.products)}
	<ul class="grid">
		{#each products as p (p.slug)}
			<li>
				<a class="product" href={siteHref(`/shop/${p.slug}`, locale)}>
					<span class="pic">
						<img src={p.image} alt="" loading="lazy" decoding="async" width="480" height="480" />
						{#if p.soldOut}
							<span class="tag out">{m.shop_sold_out()}</span>
						{:else if p.roastToOrder}
							<span class="tag">{m.shop_roast_to_order()}</span>
						{/if}
					</span>
					<span class="body">
						<span class="name">{tr(p.name, locale)}</span>
						{#if p.tastingNotes && tr(p.tastingNotes, locale)}
							<span class="notes">{tr(p.tastingNotes, locale)}</span>
						{:else if p.summary && tr(p.summary, locale)}
							<span class="notes">{tr(p.summary, locale)}</span>
						{/if}
						<span class="from price">{m.shop_from({ price: money(p.from) })}</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chips a {
		padding: 9px 16px;
		border: 1px solid var(--hair);
		border-radius: 999px;
		color: var(--ink);
		font-size: 14px;
		text-decoration: none;
		transition: background-color 0.2s;
	}
	.chips a:hover {
		background: var(--card);
	}
	.chips a[aria-current='page'] {
		border-color: var(--accent-ink);
		background: color-mix(in srgb, var(--gold) 22%, transparent);
	}
	.cat-lede {
		max-width: 60ch;
		margin: -8px 0 18px;
	}
	.grid {
		display: grid;
		gap: 18px;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.product {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100%;
		overflow: hidden;
		border: 1px solid var(--hair);
		border-radius: 20px;
		background: var(--card);
		color: var(--ink);
		text-decoration: none;
		transition:
			border-color 0.25s,
			transform 0.35s var(--ease);
	}
	.product:hover {
		border-color: var(--accent-ink);
		transform: translateY(-3px);
	}
	.pic {
		position: relative;
		display: block;
		aspect-ratio: 1;
		background: var(--well);
	}
	.pic img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.tag {
		position: absolute;
		inset-block-start: 12px;
		inset-inline-start: 12px;
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
	}
	.tag.out {
		background: var(--cherry);
		color: #fff;
	}
	.body {
		display: grid;
		gap: 6px;
		align-content: start;
		padding: 16px 18px 20px;
	}
	.name {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.15;
	}
	.notes {
		color: var(--ink-soft);
		font-size: 14px;
		line-height: 1.4;
	}
	.from {
		margin-top: 6px;
		font-size: 1rem;
	}
</style>
