<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';

	let { data } = $props();

	const locale = $derived(getLocale());
	const day = $derived(
		new Intl.DateTimeFormat(locale, {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'Africa/Addis_Ababa'
		})
	);
	/** The list's address for another page, keeping the category. */
	const pageHref = (n: number) => {
		const q = [
			data.category ? `c=${encodeURIComponent(data.category.slug)}` : '',
			n > 1 ? `page=${n}` : ''
		].filter(Boolean);
		return `${siteHref('/journal', locale)}${q.length ? `?${q.join('&')}` : ''}`;
	};
</script>

<svelte:head>
	<title>{m.site_page_title({ title: m.journal_title() })}</title>
	<meta name="description" content={m.journal_lede()} />
</svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.journal_label()}</p>
		<h1 class="title">{m.journal_title()}</h1>
		<p class="lede">{m.journal_lede()}</p>
	</header>

	{#if data.categories.length > 1}
		<nav class="section chips" aria-label={m.shop_categories()}>
			<a href={siteHref('/journal', locale)} aria-current={data.category ? undefined : 'page'}>
				{m.journal_all()}
			</a>
			{#each data.categories as c (c.id)}
				<a
					href="{siteHref('/journal', locale)}?c={c.slug}"
					aria-current={data.category?.id === c.id ? 'page' : undefined}
				>
					{tr(c.name, locale)}
				</a>
			{/each}
		</nav>
	{/if}

	{#if data.posts.length}
		<ul class="section posts">
			{#each data.posts as p (p.slug)}
				<li>
					<a class="card post" href={siteHref(`/journal/${p.slug}`, locale)}>
						{#if p.cover}<img src={p.cover} alt="" loading="lazy" decoding="async" />{/if}
						<span class="meta label">
							{#if p.category}{tr(p.category, locale)} ·
							{/if}{#if p.publishedAt}{day.format(new Date(p.publishedAt))}{/if}
						</span>
						<span class="name">{tr(p.title, locale)}</span>
						{#if p.excerpt && tr(p.excerpt, locale)}
							<span class="muted excerpt">{tr(p.excerpt, locale)}</span>
						{/if}
						{#if p.minutes}<span class="muted small">
								{m.journal_minutes({ minutes: p.minutes })}
							</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
		{#if data.pages > 1}
			<nav
				class="section pager"
				aria-label={m.journal_page({ page: data.page, pages: data.pages })}
			>
				{#if data.page > 1}<a class="link" href={pageHref(data.page - 1)}>
						← {m.journal_newer()}
					</a>{/if}
				<span class="muted">{m.journal_page({ page: data.page, pages: data.pages })}</span>
				{#if data.page < data.pages}<a class="link" href={pageHref(data.page + 1)}>
						{m.journal_older()} →
					</a>{/if}
			</nav>
		{/if}
	{:else}
		<p class="section notice">{m.journal_empty()}</p>
	{/if}
</div>

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
	.posts {
		display: grid;
		gap: 18px;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
		padding: 0;
		list-style: none;
	}
	.post {
		display: grid;
		gap: 10px;
		align-content: start;
		height: 100%;
		color: var(--ink);
		text-decoration: none;
		transition: background-color 0.2s;
	}
	.post:hover {
		background: var(--card-solid);
	}
	.post img {
		width: 100%;
		aspect-ratio: 3 / 2;
		object-fit: cover;
		border-radius: 14px;
	}
	.name {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 700;
		line-height: 1.15;
	}
	.excerpt {
		font-size: 15px;
		line-height: 1.5;
	}
	.small {
		font-size: 13px;
	}
	.pager {
		display: flex;
		gap: 18px;
		align-items: center;
		justify-content: center;
	}
</style>
