<script lang="ts">
	import { page } from '$app/state';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import '#lib/site/museum.css';

	const missing = $derived(page.status === 404);
	const title = $derived(missing ? m.site_error_title_404() : m.site_error_title());
</script>

<svelte:head>
	<title>{m.site_page_title({ title })}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<!-- Any error, on any page: unknown addresses never reach a group's layout, so this is the one. -->
<div class="museum">
	<main>
		<p class="code">{page.status}</p>
		<h1>{title}</h1>
		<p>{missing ? m.site_error_text_404() : m.site_error_text()}</p>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={localizeHref('/')}>{m.site_error_home()}</a>
	</main>
</div>

<style>
	.museum {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		background: var(--paper);
		color: var(--ink);
		font-family: var(--font-sans);
	}
	main {
		max-width: 32rem;
		padding: 2rem 1rem;
		text-align: center;
	}
	.code {
		font-family: var(--font-mono);
		color: var(--accent-ink);
		letter-spacing: 0.1em;
	}
	h1 {
		margin: 0.5rem 0 1rem;
		font-family: var(--font-display);
		font-size: clamp(2rem, 6vw, 3rem);
		line-height: 1.1;
		color: var(--ink-strong);
	}
	a {
		display: inline-block;
		margin-top: 1.5rem;
		padding: 0.75rem 1.25rem;
		border-radius: 999px;
		background: var(--color-forest-900);
		color: var(--color-mist-50);
		text-decoration: none;
	}
</style>
