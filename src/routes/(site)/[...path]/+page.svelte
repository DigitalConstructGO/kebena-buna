<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';

	let { data } = $props();

	const locale = $derived(getLocale());
	const p = $derived(data.page);
	const description = $derived(tr(p.seoDescription, locale));
</script>

<svelte:head>
	<title>{tr(p.seoTitle, locale) || m.site_page_title({ title: tr(p.title, locale) })}</title>
	{#if description}<meta name="description" content={description} />{/if}
</svelte:head>

<div class="page">
	<header class="head">
		{#if p.parent}
			<a class="label back" href={siteHref(p.parent.href, locale)}>
				← {tr(p.parent.title, locale)}
			</a>
		{/if}
		<h1 class="title">{tr(p.title, locale)}</h1>
	</header>

	{#if p.hero}
		<div class="section"><img class="hero-pic" src={p.hero} alt="" decoding="async" /></div>
	{/if}

	<article class="section article">
		<!-- Sanitised twice: when saved, and again by `bodyIn` on the way here. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="rich">{@html p.html}</div>
	</article>

	{#if p.children.length}
		<nav class="section article" aria-labelledby="in-section">
			<h2 class="section-title" id="in-section">{m.cms_in_section()}</h2>
			<ul class="cards">
				{#each p.children as c (c.href)}
					<li><a class="card more" href={siteHref(c.href, locale)}>{tr(c.title, locale)} →</a></li>
				{/each}
			</ul>
		</nav>
	{/if}
</div>

<style>
	.back {
		text-decoration: none;
	}
	.cards {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.more {
		display: block;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 700;
		text-decoration: none;
	}
	.more:hover {
		background: var(--card-solid);
	}
</style>
