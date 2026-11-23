<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { getLocale, locales, type Locale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { siteHref, switchLocale } from './locale.ts';

	const LANG_NATIVE: Record<Locale, string> = {
		en: 'English',
		am: 'አማርኛ',
		om: 'Afaan Oromoo',
		ar: 'العربية',
		it: 'Italiano',
		fr: 'Français'
	};
	const LANG_SHORT: Record<Locale, string> = {
		en: 'EN',
		am: 'አማ',
		om: 'OM',
		ar: 'عربي',
		it: 'IT',
		fr: 'FR'
	};

	type Link = { path: string; label: string };
	type Group = { id: string; label: string; links: Link[] };

	const locale = $derived(getLocale());
	/** Bags in the cart (`(site)/+layout.server.ts`); absent on the design's own pages. */
	const cartCount = $derived(Number(page.data.cartCount ?? 0));

	/** Every public page, in the groups the header shows them in. */
	const groups: Group[] = $derived([
		{
			id: 'museum',
			label: m.site_footer_museum(),
			links: [
				{ path: '/#halls', label: m.site_footer_halls() },
				{ path: '/history', label: m.site_nav_history() },
				{ path: '/kingdoms', label: m.site_footer_kingdoms() },
				{ path: '/events', label: m.site_footer_events() }
			]
		},
		{
			id: 'visit',
			label: m.site_nav_visit(),
			links: [
				{ path: '/visit', label: m.site_footer_tickets() },
				{ path: '/experiences', label: m.site_nav_experiences() },
				{ path: '/groups', label: m.site_footer_groups() },
				{ path: '/membership', label: m.site_footer_membership() }
			]
		},
		{
			id: 'coffee',
			label: m.site_footer_coffee(),
			links: [
				{ path: '/shop', label: m.site_nav_shop() },
				{ path: '/subscriptions', label: m.site_footer_subscriptions() },
				{ path: '/wholesale', label: m.site_footer_wholesale() }
			]
		}
	]);

	/** The page's path without its language prefix, for `aria-current`. */
	const bare = $derived(switchLocale(page.url.pathname, 'en'));
	const isCurrent = (path: string) => !path.includes('#') && (bare === path || bare.startsWith(`${path}/`));
	const groupCurrent = (g: Group) => g.links.some((l) => isCurrent(l.path));

	/** The open dropdown: a group's id, `lang`, `mobile` for the small-screen menu, or none. */
	let open = $state<string | null>(null);
	let dark = $state(false);
	let header = $state<HTMLElement>();

	const toggle = (id: string) => (open = open === id ? null : id);

	// The theme is the page's, set before paint from `kb-theme`; read it once the page is up.
	onMount(() => {
		dark = document.documentElement.dataset.theme === 'dark';
	});

	// Any navigation closes whatever was open.
	afterNavigate(() => {
		open = null;
	});

	function toggleTheme() {
		dark = !dark;
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
		try {
			localStorage.setItem('kb-theme', dark ? 'dark' : 'light');
		} catch {
			// storage can be blocked; the choice then lasts for this page only
		}
	}

	/** A click outside the header closes its menus. */
	function onWindowClick(e: MouseEvent) {
		if (open && header && !header.contains(e.target as Node)) open = null;
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (open = null)} onclick={onWindowClick} />

<header class="nav" bind:this={header}>
	<a class="brand" href={siteHref('/', locale)} aria-label={m.site_home_label()}>
		<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
			<ellipse cx="12" cy="12" rx="7" ry="10" fill="currentColor" transform="rotate(28 12 12)" />
			<path d="M9 4 C14 9 10 15 15 20" stroke="var(--forest-900)" stroke-width="1.6" fill="none" />
		</svg>
		<span>Kebena</span>
	</a>

	<nav class="wide" aria-label={m.site_nav_label()}>
		<ul>
			{#each groups as g (g.id)}
				<li class="group">
					<button
						type="button"
						class="top"
						class:current={groupCurrent(g)}
						aria-expanded={open === g.id}
						aria-controls="nav-{g.id}"
						onclick={() => toggle(g.id)}
					>
						{g.label}
						<svg class="chev" class:up={open === g.id} viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
							<path d="m3 4.5 3 3 3-3" />
						</svg>
					</button>
					<ul class="menu" id="nav-{g.id}" hidden={open !== g.id}>
						{#each g.links as link (link.path)}
							<li>
								<a href={siteHref(link.path, locale)} aria-current={isCurrent(link.path) ? 'page' : undefined}>{link.label}</a>
							</li>
						{/each}
					</ul>
				</li>
			{/each}
			<li>
				<a class="top" href={siteHref('/contact', locale)} aria-current={isCurrent('/contact') ? 'page' : undefined}
					>{m.site_nav_contact()}</a
				>
			</li>
		</ul>
	</nav>

	<div class="lang">
		<button
			type="button"
			class="icon-btn"
			aria-expanded={open === 'lang'}
			aria-controls="nav-lang"
			aria-label={m.site_language_label({ language: LANG_NATIVE[locale] })}
			onclick={() => toggle('lang')}
		>
			<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
				<circle cx="10" cy="10" r="7.5" />
				<path d="M2.5 10h15M10 2.5c2.2 2.4 2.2 12.6 0 15M10 2.5c-2.2 2.4-2.2 12.6 0 15" />
			</svg>
			<span lang={locale}>{LANG_SHORT[locale]}</span>
		</button>
		<ul class="menu end" id="nav-lang" hidden={open !== 'lang'}>
			{#each locales as l (l)}
				<li>
					<a
						href={switchLocale(page.url.pathname, l) + page.url.search}
						hreflang={l}
						lang={l}
						aria-current={l === locale ? 'true' : undefined}
						data-sveltekit-reload
					>
						{LANG_NATIVE[l]}
					</a>
				</li>
			{/each}
		</ul>
	</div>
	<button type="button" class="icon-btn theme" aria-pressed={dark} aria-label={m.site_dark_mode()} onclick={toggleTheme}>
		<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
			{#if dark}
				<path d="M15.5 12.5A6 6 0 0 1 7.5 4.5a6 6 0 1 0 8 8Z" />
			{:else}
				<circle cx="10" cy="10" r="3.4" />
				<path
					d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1"
				/>
			{/if}
		</svg>
	</button>
	<a class="cart" href={siteHref('/cart', locale)}
		>{m.site_nav_cart()}{#if cartCount}<span class="count" aria-label={m.site_cart_count({ count: cartCount })}
				>{cartCount}</span
			>{/if}</a
	>
	<button
		type="button"
		class="icon-btn burger"
		aria-expanded={open === 'mobile'}
		aria-controls="nav-mobile"
		aria-label={open === 'mobile' ? m.site_nav_close() : m.site_nav_menu()}
		onclick={() => toggle('mobile')}
	>
		<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
			{#if open === 'mobile'}
				<path d="M5 5l10 10M15 5 5 15" />
			{:else}
				<path d="M3 6h14M3 10h14M3 14h14" />
			{/if}
		</svg>
	</button>

	<nav class="sheet" id="nav-mobile" aria-label={m.site_nav_label()} hidden={open !== 'mobile'}>
		{#each groups as g (g.id)}
			<section>
				<p class="sheet-title">{g.label}</p>
				<ul>
					{#each g.links as link (link.path)}
						<li>
							<a href={siteHref(link.path, locale)} aria-current={isCurrent(link.path) ? 'page' : undefined}>{link.label}</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
		<section>
			<p class="sheet-title">{m.site_footer_help()}</p>
			<ul>
				<li>
					<a href={siteHref('/contact', locale)} aria-current={isCurrent('/contact') ? 'page' : undefined}>{m.site_nav_contact()}</a>
				</li>
				<li>
					<a href={siteHref('/track', locale)} aria-current={isCurrent('/track') ? 'page' : undefined}>{m.site_footer_track()}</a>
				</li>
			</ul>
		</section>
	</nav>
</header>

<style>
	.nav {
		position: absolute;
		top: 20px;
		left: 50%;
		translate: -50%;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 24px;
		width: min(1120px, 100% - 32px);
		padding: 8px 8px 8px 18px;
		border: 1px solid #ffffff1a;
		border-radius: 16px;
		background: var(--chrome);
		-webkit-backdrop-filter: var(--glass-fx);
		backdrop-filter: var(--glass-fx);
		color: var(--mist-50);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--gold-soft);
		font-size: 17px;
		letter-spacing: -0.01em;
		text-decoration: none;
	}
	.brand span {
		color: var(--mist-50);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* ── Wide screens: the groups as dropdowns ──────────────────────────────────────────────── */
	.wide {
		margin-inline-start: auto;
	}
	.wide > ul {
		display: flex;
		gap: 4px;
	}
	.group {
		position: relative;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 9px 14px;
		border: 0;
		border-radius: 10px;
		background: none;
		color: #f6f9f6d1;
		font: inherit;
		font-size: 14px;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color 0.2s,
			color 0.2s;
	}
	.top:hover,
	.top[aria-expanded='true'] {
		color: #fff;
		background: #ffffff14;
	}
	.top.current,
	.top[aria-current='page'] {
		color: #fff;
		background: #ffffff1a;
	}
	.chev {
		transition: rotate 0.2s;
	}
	.chev.up {
		rotate: 180deg;
	}
	.chev path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4px;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.menu {
		position: absolute;
		inset-block-start: calc(100% + 10px);
		inset-inline-start: 0;
		z-index: 30;
		display: grid;
		gap: 2px;
		min-width: 210px;
		padding: 6px;
		border: 1px solid #ffffff1f;
		border-radius: 14px;
		background: var(--forest-900);
		box-shadow: 0 16px 40px #00000059;
	}
	.menu.end {
		inset-inline-start: auto;
		inset-inline-end: 0;
	}
	.menu[hidden],
	.sheet[hidden] {
		display: none;
	}
	.menu a {
		display: block;
		padding: 9px 12px;
		border-radius: 9px;
		color: #f6f9f6db;
		font-size: 15px;
		text-decoration: none;
	}
	.menu a:hover {
		background: #ffffff14;
		color: #fff;
	}
	.menu a[aria-current='page'],
	.menu a[aria-current='true'] {
		color: var(--gold-soft);
	}

	/* ── Controls ───────────────────────────────────────────────────────────────────────────── */
	.lang {
		position: relative;
	}
	.icon-btn {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 9px 12px;
		border: 0;
		border-radius: 10px;
		background: none;
		color: #f6f9f6d1;
		font: inherit;
		font-size: 14px;
		cursor: pointer;
		transition:
			background-color 0.2s,
			color 0.2s;
	}
	.icon-btn:hover,
	.icon-btn[aria-expanded='true'] {
		color: #fff;
		background: #ffffff14;
	}
	.icon-btn :global(path),
	.icon-btn :global(circle) {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4px;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.theme {
		width: 36px;
		height: 36px;
		padding: 0;
		justify-content: center;
		margin-inline-start: -16px;
	}
	.burger {
		display: none;
		width: 40px;
		height: 40px;
		padding: 0;
		justify-content: center;
	}
	.cart {
		flex-shrink: 0;
		padding: 10px 16px;
		border-radius: 12px;
		background: var(--gold);
		color: var(--forest-900);
		font-size: 14px;
		white-space: nowrap;
		text-decoration: none;
		transition: background-color 0.2s;
	}
	.cart:hover {
		background: var(--gold-soft);
	}
	.count {
		display: inline-grid;
		place-items: center;
		min-width: 20px;
		height: 20px;
		margin-inline-start: 8px;
		padding: 0 6px;
		border-radius: 999px;
		background: var(--forest-900);
		color: var(--gold-soft);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	/* ── Small screens: one menu button, the groups in a sheet under the bar ────────────────── */
	.sheet {
		position: absolute;
		inset-block-start: calc(100% + 10px);
		inset-inline: 0;
		z-index: 30;
		display: grid;
		gap: 18px;
		max-height: calc(100dvh - 110px);
		overflow-y: auto;
		padding: 18px;
		border: 1px solid #ffffff1f;
		border-radius: 16px;
		background: var(--forest-900);
		box-shadow: 0 16px 40px #00000059;
	}
	.sheet-title {
		margin: 0 0 6px;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 500;
		font-stretch: 75%;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--gold);
	}
	.sheet ul {
		display: grid;
		gap: 2px;
	}
	.sheet a {
		display: block;
		padding: 10px 12px;
		border-radius: 10px;
		color: #f6f9f6e6;
		font-size: 16px;
		text-decoration: none;
	}
	.sheet a:hover {
		background: #ffffff14;
	}
	.sheet a[aria-current='page'] {
		color: var(--gold-soft);
		background: #ffffff0f;
	}
	@media (width > 960px) {
		.sheet {
			display: none !important;
		}
	}
	@media (width <= 960px) {
		.nav {
			top: 12px;
			gap: 8px;
			padding: 6px 6px 6px 12px;
		}
		.wide {
			display: none;
		}
		.lang {
			margin-inline-start: auto;
		}
		.burger {
			display: flex;
		}
		.icon-btn {
			padding: 8px;
		}
		.theme {
			margin-inline-start: -4px;
		}
		.cart {
			padding: 9px 12px;
		}
	}
	@media (width <= 420px) {
		.brand span {
			display: none;
		}
	}
</style>
