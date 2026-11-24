<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';

	let { data } = $props();

	const locale = $derived(getLocale());
	const p = $derived(data.post);
	const day = $derived(
		new Intl.DateTimeFormat(locale, {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'Africa/Addis_Ababa'
		})
	);
	const description = $derived(tr(p.seoDescription, locale) || tr(p.excerpt, locale));
</script>

<svelte:head>
	<title>{tr(p.seoTitle, locale) || m.site_page_title({ title: tr(p.title, locale) })}</title>
	{#if description}<meta name="description" content={description} />{/if}
	{#if p.cover}<meta property="og:image" content={p.cover} />{/if}
</svelte:head>

<div class="page">
	<header class="head article">
		<a class="label back" href={siteHref('/journal', locale)}>← {m.journal_back()}</a>
		<h1 class="title post-title">{tr(p.title, locale)}</h1>
		<p class="muted meta">
			{#if p.category}<a href="{siteHref('/journal', locale)}?c={p.category.slug}">
					{tr(p.category.name, locale)}
				</a> ·
			{/if}{#if p.publishedAt}<time datetime={new Date(p.publishedAt).toISOString()}>
					{day.format(new Date(p.publishedAt))}
				</time>{/if}{#if p.author}
				· {m.journal_by({ name: p.author })}{/if}{#if p.minutes}
				· {m.journal_minutes({ minutes: p.minutes })}{/if}
		</p>
	</header>

	{#if p.cover}
		<div class="section"><img class="hero-pic" src={p.cover} alt="" decoding="async" /></div>
	{/if}

	<article class="section article">
		<!-- Sanitised twice: when saved, and again by `bodyIn` on the way here. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="rich">{@html p.html}</div>
	</article>

	{#if p.related.length}
		<section class="section" aria-labelledby="more">
			<h2 class="section-title" id="more">{m.journal_more()}</h2>
			<ul class="cards related">
				{#each p.related as r (r.slug)}
					<li>
						<a class="card more" href={siteHref(`/journal/${r.slug}`, locale)}>
							{#if r.cover}<img src={r.cover} alt="" loading="lazy" decoding="async" />{/if}
							<span>{tr(r.title, locale)}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.back {
		text-decoration: none;
	}
	.post-title {
		font-size: clamp(2.2rem, 5vw, 3.8rem);
	}
	.meta a {
		color: inherit;
	}
	.related {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.more {
		display: grid;
		gap: 10px;
		height: 100%;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 700;
		text-decoration: none;
	}
	.more:hover {
		background: var(--card-solid);
	}
	.more img {
		width: 100%;
		aspect-ratio: 3 / 2;
		object-fit: cover;
		border-radius: 12px;
	}
</style>
