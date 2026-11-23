<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import Wayfinder from './Wayfinder.svelte';
	import {
		deLocalizeHref,
		getLocale,
		localizeHref,
		locales,
		setLocale,
		type Locale
	} from '#lib/paraglide/runtime.js';

	/** On museum pages the floating floor plan (`Wayfinder`) joins the bar; site pages leave it off. */
	let { wayfinder = true }: { wayfinder?: boolean } = $props();

	type Group = { id: string; label: string; links: { path: string; hash?: string; label: string }[] };

	/** Every public page, in the groups the bar shows them in. */
	const groups: Group[] = $derived([
		{
			id: 'museum',
			label: m.site_footer_museum(),
			links: [
				{ path: '/', hash: '#halls', label: m.site_footer_halls() },
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
	const bare = $derived(deLocalizeHref(page.url.pathname));
	const isCurrent = (path: string, hash?: string) =>
		!hash && path !== '/' && (bare === path || bare.startsWith(`${path}/`));
	const groupCurrent = (g: Group) => g.links.some((l) => isCurrent(l.path, l.hash));
	const hrefOf = (path: string, hash = '') => `${localizeHref(path)}${hash}`;

	/** The open group's dropdown, or `mobile` for the small-screen sheet. */
	let openGroup = $state<string | null>(null);
	const toggleGroup = (id: string) => {
		open = false;
		openGroup = openGroup === id ? null : id;
	};
	afterNavigate(() => {
		openGroup = null;
		open = false;
	});

	/**
	 * Bags in the cart. Site pages get the count from their layout; the museum pages are built ahead
	 * as static HTML, so there it is read from the cart's `kb-cart-n` cookie once the page is up.
	 */
	let cookieCount = $state(0);
	onMount(() => {
		cookieCount = Number(/(?:^|;\s*)kb-cart-n=(\d+)/.exec(document.cookie)?.[1] ?? 0);
	});
	const cartCount = $derived(Number(page.data.cartCount ?? cookieCount));

	/** Each language named in itself, so a reader can always find their own. */
	const NAMES: Record<Locale, string> = {
		en: 'English',
		am: 'አማርኛ',
		om: 'Afaan Oromoo',
		ar: 'العربية',
		it: 'Italiano',
		fr: 'Français'
	};
	/** A short tag for the closed button, so the nav stays narrow. */
	const SHORT: Record<Locale, string> = {
		en: 'EN',
		am: 'አማ',
		om: 'OM',
		ar: 'عربي',
		it: 'IT',
		fr: 'FR'
	};
	const current = getLocale();

	let open = $state(false);
	let menu = $state<HTMLElement>();
	let trigger = $state<HTMLButtonElement>();

	const toggle = () => {
		openGroup = null;
		open = !open;
		if (open)
			requestAnimationFrame(() =>
				menu?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
			);
	};
	const close = (refocus = false) => {
		open = false;
		if (refocus) trigger?.focus();
	};
	const choose = (l: Locale) => {
		close();
		if (l !== current) void setLocale(l);
	};
	const onMenuKey = (e: KeyboardEvent) => {
		const items = [...(menu?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
		const i = items.indexOf(document.activeElement as HTMLElement);
		if (e.key === 'Escape') {
			e.preventDefault();
			close(true);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			items[(i + 1) % items.length]?.focus();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			items[(i - 1 + items.length) % items.length]?.focus();
		} else if (e.key === 'Home') {
			e.preventDefault();
			items[0]?.focus();
		} else if (e.key === 'End') {
			e.preventDefault();
			items[items.length - 1]?.focus();
		} else if (e.key === 'Tab') {
			close();
		}
	};
	/** Light or dark: follows the system until the visitor picks one, then remembers it. */
	let dark = $state(false);
	$effect(() => {
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const read = () => {
			const t = document.documentElement.dataset.theme;
			dark = t ? t === 'dark' : mq.matches;
		};
		read();
		mq.addEventListener('change', read);
		return () => mq.removeEventListener('change', read);
	});
	const toggleTheme = () => {
		dark = !dark;
		const t = dark ? 'dark' : 'light';
		document.documentElement.dataset.theme = t;
		try {
			localStorage.setItem('kb-theme', t);
		} catch {
			/* private mode: the choice lasts for this page only */
		}
	};

	/** Close when a click lands anywhere outside the picker, or outside the bar for the page menus. */
	const onWindowPointer = (e: PointerEvent) => {
		if (open && !(e.target as Element).closest('.lang')) close();
		if (openGroup && !(e.target as Element).closest('.nav')) openGroup = null;
	};
</script>

<svelte:window onpointerdown={onWindowPointer} onkeydown={(e) => e.key === 'Escape' && (openGroup = null)} />

<header class="nav">
	<a class="brand" href={localizeHref('/')} aria-label="Kebena Buna, home">
		<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
			<ellipse cx="12" cy="12" rx="7" ry="10" fill="currentColor" transform="rotate(28 12 12)" />
			<path
				d="M9 4 C14 9 10 15 15 20"
				stroke="var(--color-forest-900)"
				stroke-width="1.6"
				fill="none"
			/>
		</svg>
		<span>Kebena</span>
	</a>
	<nav class="wide" aria-label="Main">
		<ul>
			{#each groups as g (g.id)}
				<li class="group">
					<button
						type="button"
						class={['top', { current: groupCurrent(g) }]}
						aria-expanded={openGroup === g.id}
						aria-controls="nav-{g.id}"
						onclick={() => toggleGroup(g.id)}
					>
						{g.label}
						<svg class={['chev', { up: openGroup === g.id }]} viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
							<path d="m3 4.5 3 3 3-3" />
						</svg>
					</button>
					<ul class="gmenu" id="nav-{g.id}" hidden={openGroup !== g.id}>
						{#each g.links as l (l.path + (l.hash ?? ''))}
							<li>
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; only the #hash is appended -->
								<a href={hrefOf(l.path, l.hash)} aria-current={isCurrent(l.path, l.hash) ? 'page' : undefined}>{l.label}</a>
							</li>
						{/each}
					</ul>
				</li>
			{/each}
			<li>
				<a class="top" href={localizeHref('/contact')} aria-current={isCurrent('/contact') ? 'page' : undefined}
					>{m.site_nav_contact()}</a
				>
			</li>
		</ul>
	</nav>
	<div class="lang">
		<button
			type="button"
			class="lang-btn"
			bind:this={trigger}
			aria-haspopup="menu"
			aria-expanded={open}
			aria-label={`${m.story_language()}: ${NAMES[current]}`}
			onclick={toggle}
		>
			<svg class="globe" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
				<circle cx="10" cy="10" r="7.5" /><path
					d="M2.5 10h15M10 2.5c2.2 2.4 2.2 12.6 0 15M10 2.5c-2.2 2.4-2.2 12.6 0 15"
				/>
			</svg>
			<span lang={current}>{SHORT[current]}</span>
			<svg
				class={['chev', { up: open }]}
				viewBox="0 0 12 12"
				width="10"
				height="10"
				aria-hidden="true"
			>
				<path d="m3 4.5 3 3 3-3" />
			</svg>
		</button>
		{#if open}
			<div
				class="menu"
				role="menu"
				aria-label={m.story_language()}
				tabindex="-1"
				bind:this={menu}
				onkeydown={onMenuKey}
			>
				{#each locales as l (l)}
					<button
						type="button"
						role="menuitemradio"
						aria-checked={l === current}
						class={['item', { on: l === current }]}
						tabindex="-1"
						onclick={() => choose(l)}
					>
						<span class="item-name" lang={l}>{NAMES[l]}</span>
						{#if l === current}
							<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
								<path d="m3.5 8.5 3 3 6-7" />
							</svg>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
	<button
		type="button"
		class="theme"
		aria-pressed={dark}
		aria-label="Dark mode"
		onclick={toggleTheme}
	>
		<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
			{#if dark}
				<path d="M15.5 12.4A6.5 6.5 0 0 1 7.6 4.5a6.5 6.5 0 1 0 7.9 7.9Z" />
			{:else}
				<circle cx="10" cy="10" r="3.4" /><path
					d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1"
				/>
			{/if}
		</svg>
	</button>
	<a class="order" href={localizeHref('/cart')}
		>{m.site_nav_cart()}{#if cartCount}<span class="count" aria-label={m.site_cart_count({ count: cartCount })}
				>{cartCount}</span
			>{/if}</a
	>
	<button
		type="button"
		class="burger"
		aria-expanded={openGroup === 'mobile'}
		aria-controls="nav-mobile"
		aria-label={openGroup === 'mobile' ? m.site_nav_close() : m.site_nav_menu()}
		onclick={() => toggleGroup('mobile')}
	>
		<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
			{#if openGroup === 'mobile'}
				<path d="M5 5l10 10M15 5 5 15" />
			{:else}
				<path d="M3 6h14M3 10h14M3 14h14" />
			{/if}
		</svg>
	</button>

	<nav class="sheet" id="nav-mobile" aria-label="Main" hidden={openGroup !== 'mobile'}>
		{#each groups as g (g.id)}
			<section>
				<p class="sheet-title">{g.label}</p>
				<ul>
					{#each g.links as l (l.path + (l.hash ?? ''))}
						<li>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; only the #hash is appended -->
							<a href={hrefOf(l.path, l.hash)} aria-current={isCurrent(l.path, l.hash) ? 'page' : undefined}>{l.label}</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
		<section>
			<p class="sheet-title">{m.site_footer_help()}</p>
			<ul>
				<li><a href={localizeHref('/contact')}>{m.site_nav_contact()}</a></li>
				<li><a href={localizeHref('/track')}>{m.site_footer_track()}</a></li>
			</ul>
		</section>
	</nav>
</header>

{#if wayfinder}<Wayfinder />{/if}

<style>
	.nav {
		position: absolute;
		z-index: 20;
		top: 20px;
		left: 50%;
		translate: -50% 0;
		width: min(1120px, calc(100% - 32px));
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 8px 8px 8px 18px;
		border-radius: 16px;
		/* dense enough that the light labels pass contrast even over a white page */
		background: var(--chrome);
		backdrop-filter: var(--glass-fx);
		-webkit-backdrop-filter: var(--glass-fx);
		border: 1px solid rgb(255 255 255 / 0.1);
		color: var(--color-mist-50);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--color-lime-300);
		text-decoration: none;
		font-size: 17px;
		letter-spacing: -0.01em;
	}
	.brand span {
		color: var(--color-mist-50);
	}
	nav {
		margin-inline-start: auto;
	}
	.lang {
		position: relative;
	}
	/* both top-bar buttons keep their size; a finger gets 44px of height */
	.lang-btn::before,
	.theme::before {
		content: '';
		position: absolute;
		inset: -5px 0;
	}
	.lang-btn {
		position: relative;
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 9px 12px;
		border: 0;
		border-radius: 10px;
		background: none;
		color: rgb(246 249 246 / 0.82);
		font: inherit;
		font-size: 14px;
		cursor: pointer;
		transition:
			background-color 0.2s,
			color 0.2s;
	}
	.lang-btn:hover,
	.lang-btn[aria-expanded='true'] {
		background: rgb(255 255 255 / 0.08);
		color: #fff;
	}
	.lang svg path,
	.lang svg circle {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.theme {
		position: relative;
		flex: none;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		margin-inline-start: -16px;
		border: 0;
		border-radius: 10px;
		background: none;
		color: rgb(246 249 246 / 0.82);
		cursor: pointer;
		transition:
			background-color 0.2s,
			color 0.2s;
	}
	.theme:hover {
		background: rgb(255 255 255 / 0.08);
		color: #fff;
	}
	.theme:focus-visible {
		outline: 2px solid var(--color-lime-300);
		outline-offset: 2px;
	}
	.theme path,
	.theme circle {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.chev {
		transition: rotate 0.2s;
	}
	.chev.up {
		rotate: 180deg;
	}
	.menu {
		position: absolute;
		z-index: 30;
		inset-block-start: calc(100% + 10px);
		inset-inline-end: 0;
		min-width: 200px;
		display: grid;
		gap: 2px;
		padding: 6px;
		border-radius: 14px;
		background: var(--color-forest-900);
		border: 1px solid rgb(255 255 255 / 0.12);
		box-shadow: 0 16px 40px rgb(0 0 0 / 0.35);
		outline: none;
		animation: drop 0.18s ease-out;
	}
	@keyframes drop {
		from {
			opacity: 0;
			translate: 0 -4px;
		}
	}
	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 9px 12px;
		border: 0;
		border-radius: 9px;
		background: none;
		color: rgb(246 249 246 / 0.86);
		font: inherit;
		font-size: 15px;
		text-align: start;
		cursor: pointer;
	}
	.item-name {
		flex: 1;
		text-align: start;
	}
	.item:hover,
	.item:focus-visible {
		background: rgb(255 255 255 / 0.08);
		outline: none;
	}
	.item.on {
		color: var(--color-lime-300);
	}
	.lang-btn:focus-visible {
		outline: 2px solid var(--color-lime-300);
		outline-offset: 2px;
	}
	@media (prefers-reduced-motion: reduce) {
		.menu {
			animation: none;
		}
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	/* wide screens: the page groups as dropdowns */
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
		color: rgb(246 249 246 / 0.82);
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
		background: rgb(255 255 255 / 0.08);
		color: #fff;
	}
	.top.current,
	.top[aria-current='page'] {
		background: rgb(255 255 255 / 0.1);
		color: #fff;
	}
	.top :global(.chev path),
	.burger path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4px;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.gmenu {
		position: absolute;
		inset-block-start: calc(100% + 10px);
		inset-inline-start: 0;
		z-index: 30;
		display: grid;
		gap: 2px;
		min-width: 210px;
		padding: 6px;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 14px;
		background: var(--color-forest-900);
		box-shadow: 0 16px 40px rgb(0 0 0 / 0.35);
		animation: drop 0.18s ease-out;
	}
	.gmenu[hidden],
	.sheet[hidden] {
		display: none;
	}
	.gmenu a,
	.sheet a {
		display: block;
		padding: 9px 12px;
		border-radius: 9px;
		color: rgb(246 249 246 / 0.86);
		font-size: 15px;
		text-decoration: none;
	}
	.gmenu a:hover,
	.sheet a:hover {
		background: rgb(255 255 255 / 0.08);
		color: #fff;
	}
	.gmenu a[aria-current='page'],
	.sheet a[aria-current='page'] {
		color: var(--color-lime-300);
	}
	.count {
		display: inline-grid;
		place-items: center;
		min-width: 20px;
		height: 20px;
		margin-inline-start: 8px;
		padding: 0 6px;
		border-radius: 999px;
		background: var(--color-forest-900);
		color: var(--color-lime-300);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}
	/* small screens: one menu button; the groups open in a sheet under the bar */
	.burger {
		display: none;
		place-items: center;
		flex: none;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: 10px;
		background: none;
		color: rgb(246 249 246 / 0.86);
		cursor: pointer;
	}
	.burger:hover,
	.burger[aria-expanded='true'] {
		background: rgb(255 255 255 / 0.08);
		color: #fff;
	}
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
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 16px;
		background: var(--color-forest-900);
		box-shadow: 0 16px 40px rgb(0 0 0 / 0.35);
	}
	.sheet-title {
		margin: 0 0 6px;
		font-family: var(--font-display);
		font-stretch: 75%;
		font-weight: 500;
		font-size: 12px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-lime-400);
	}
	.sheet ul {
		display: grid;
		gap: 2px;
	}
	.sheet a {
		font-size: 16px;
		padding: 10px 12px;
	}
	.order {
		flex-shrink: 0;
		white-space: nowrap;
		padding: 10px 16px;
		border-radius: 12px;
		background: var(--color-lime-400);
		color: var(--color-forest-900);
		text-decoration: none;
		font-size: 14px;
		transition: background-color 0.2s;
	}
	.order:hover {
		background: var(--color-lime-300);
	}
	a:focus-visible {
		outline: 2px solid var(--color-lime-300);
		outline-offset: 2px;
	}
	@media (min-width: 1800px) {
		.nav {
			width: min(1440px, calc(100% - 32px));
		}
	}
	@media (max-height: 560px) and (orientation: landscape) {
		.nav {
			top: 12px;
			padding-block: 6px;
		}
	}
	@media (min-width: 961px) {
		.sheet {
			display: none !important;
		}
	}
	@media (max-width: 960px) {
		.wide {
			display: none;
		}
		.lang {
			margin-inline-start: auto;
		}
		.burger {
			display: grid;
		}
		.nav {
			gap: 12px;
		}
	}
	/* the smallest phones: keep the leaf mark, the language, the cart and the menu on one line */
	@media (max-width: 380px) {
		.nav {
			gap: 8px;
			padding: 6px 6px 6px 12px;
		}
		.brand span {
			display: none;
		}
		.lang-btn {
			padding: 8px;
		}
		.theme {
			margin-inline-start: -4px;
			width: 32px;
		}
		.order {
			padding: 9px 12px;
		}
	}
</style>
