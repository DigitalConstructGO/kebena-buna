<script lang="ts">
	import type { FooterContent } from '#lib/content/museum.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';

	let { content }: { content: FooterContent } = $props();

	// section links (#farms) live on the home page; from /history they must lead back there
	const home = $derived(localizeHref('/'));
	const to = (href: string) => (href.length > 1 && href.startsWith('#') ? home + href : href);
</script>

<footer class="footer">
	<div class="top">
		<div class="brand">
			<p class="name">{content.brand}</p>
			<p class="tagline">{content.tagline}</p>
		</div>
		{#each content.columns as col (col.title)}
			<nav class="col" aria-label={col.title}>
				<p class="title">{col.title}</p>
				<ul>
					{#each col.links as l (l.label)}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- links come from content -->
						<li><a href={to(l.href)}>{l.label}</a></li>
					{/each}
				</ul>
			</nav>
		{/each}
	</div>
	<div class="bottom">
		<p>{content.legal}</p>
		<p>{content.contact}</p>
	</div>
</footer>

<style>
	.footer {
		display: flex;
		flex-direction: column;
		gap: 48px;
		padding: 80px max(24px, calc((100% - 1200px) / 2)) 48px;
		background: var(--paper-tint);
		color: var(--ink);
	}
	.top {
		display: flex;
		flex-wrap: wrap;
		gap: 40px clamp(40px, 5.6vw, 80px);
	}
	.brand {
		flex: 1 1 260px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.name {
		margin: 0;
		font-size: 28px;
		line-height: 36px;
	}
	.tagline {
		margin: 0;
		font-size: 14px;
		line-height: 20px;
		color: var(--ink-soft);
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.title {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 16px;
		letter-spacing: 0.6px;
		text-transform: uppercase;
		color: var(--accent-mark);
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		color: var(--ink);
		font-size: 14px;
		line-height: 20px;
		text-decoration: none;
		transition: color 0.2s;
	}
	a:hover {
		color: var(--accent-mark);
	}
	a:focus-visible {
		outline: 2px solid var(--accent-mark);
		outline-offset: 2px;
		border-radius: 2px;
	}
	.bottom {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px 24px;
		padding-top: 24px;
		border-top: 1px solid var(--line);
		font-size: 12px;
		line-height: 16px;
		letter-spacing: 0.2px;
	}
	.bottom p {
		margin: 0;
	}
	@media (max-width: 600px) {
		.col {
			flex: 1 1 40%;
		}
	}
</style>
