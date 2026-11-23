<script lang="ts">
	import { page } from '$app/state';
	import Pouch from '#lib/components/museum/Pouch.svelte';
	import Shelf from '#lib/site/shelf/Shelf.svelte';
	import ShelfCard from '#lib/site/shelf/ShelfCard.svelte';
	import ProductViewer from '#lib/site/shop/ProductViewer.svelte';
	import type { ShelfProduct } from '#lib/site/shop/types.ts';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { money, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';

	let { data } = $props();

	const locale = $derived(getLocale());
	/** `?c=specialty` narrows the shop to one category; links, so it works without script. */
	const current = $derived(
		data.categories.find((c) => c.slug === page.url.searchParams.get('c')) ?? null
	);
	const groups = $derived(
		(current ? [current] : data.categories)
			.map((c) => ({ category: c, products: data.products.filter((p) => p.categoryId === c.id) }))
			.filter((g) => g.products.length)
	);
	const uncategorised = $derived(
		current ? [] : data.products.filter((p) => !data.categories.some((c) => c.id === p.categoryId))
	);

	/** The Kebena bag every coffee is sold in: its printed front. */
	const BAG = '/hero/bag-front.jpg';
	/** A coffee stands on the shelf in its smallest bag. */
	const smallest = (p: ShelfProduct) => {
		const v = p.variants[0];
		return v ? tr(v.size ?? v.name ?? '', locale) : '';
	};

	let viewer = $state<ReturnType<typeof ProductViewer>>();
</script>

<svelte:head>
	<title>{m.site_page_title({ title: m.shop_title() })}</title>
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
			<a href={siteHref('/shop', locale)} aria-current={current ? undefined : 'page'}>
				{m.shop_all()}
			</a>
			{#each data.categories as c (c.id)}
				<a
					href="{siteHref('/shop', locale)}?c={c.slug}"
					aria-current={current?.id === c.id ? 'page' : undefined}
				>
					{tr(c.name, locale)}
				</a>
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

<ProductViewer bind:this={viewer} />

{#snippet grid(products: ShelfProduct[])}
	<Shelf>
		{#each products as p, i (p.slug)}
			{@const notes = tr(p.tastingNotes, locale) || tr(p.summary, locale)}
			<ShelfCard
				href={siteHref(`/shop/${p.slug}`, locale)}
				title={tr(p.name, locale)}
				notes={notes || undefined}
				price={m.shop_from({ price: money(p.from) })}
				tag={p.soldOut ? m.shop_sold_out() : p.roastToOrder ? m.shop_roast_to_order() : undefined}
				tagOut={p.soldOut}
				hint={p.kind === 'coffee' ? m.shop_turn() : m.site_look()}
				turns={p.kind === 'coffee'}
				image={p.kind === 'coffee' ? undefined : p.image}
				art={p.kind === 'coffee' ? bag : undefined}
				beans={p.kind === 'coffee' ? i + 1 : undefined}
				onpick={() => viewer?.show(p)}
			/>
			{#snippet bag()}
				<Pouch src={BAG} weight={smallest(p)} name={tr(p.name, locale)} />
			{/snippet}
		{/each}
	</Shelf>
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
</style>
