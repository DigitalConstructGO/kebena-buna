<script lang="ts">
	import { onMount, tick } from 'svelte';
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

	type Group = {
		id: string;
		label: string;
		links: { path: string; hash?: string; label: string }[];
	};

	/** Every public page, in the groups the menu shows them in. */
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
	/** The menu numbers its links straight through, across the groups. */
	const offsets = $derived(
		groups.map((_, i) => groups.slice(0, i).reduce((n, g) => n + g.links.length, 0))
	);
	const pad = (n: number) => String(n).padStart(2, '0');

	/** The page's path without its language prefix, for `aria-current`. */
	const bare = $derived(deLocalizeHref(page.url.pathname));
	const isCurrent = (path: string, hash?: string) =>
		!hash && path !== '/' && (bare === path || bare.startsWith(`${path}/`));
	const hrefOf = (path: string, hash = '') => `${localizeHref(path)}${hash}`;

	/** Which half of the house the page belongs to, for the Museum | Coffee switch. */
	const COFFEE = [
		'/shop',
		'/subscriptions',
		'/wholesale',
		'/cart',
		'/checkout',
		'/order',
		'/pay',
		'/track',
		'/trace'
	];
	const side = $derived(
		COFFEE.some((p) => bare === p || bare.startsWith(`${p}/`)) ? 'coffee' : 'museum'
	);

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
	/** A short tag for the closed button, so the bar stays narrow. */
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

	/**
	 * The full-screen menu: a native modal, so the page behind goes inert, focus stays inside and
	 * Esc closes it. Closing marks it `data-closing` first so it fades out in every browser, not only
	 * those that can transition `display` and `overlay`.
	 */
	let sheet = $state<HTMLDialogElement>();
	let sheetOpen = $state(false);
	let closing = $state(false);
	const openSheet = () => {
		open = false;
		sheet?.showModal();
		sheetOpen = true;
	};
	const closeSheet = async () => {
		if (!sheet?.open || closing) return;
		closing = true;
		// let the attribute land first, so its fade-out is among the running animations
		await tick();
		const fades = sheet.getAnimations({ subtree: true });
		await Promise.race([
			Promise.allSettled(fades.map((a) => a.finished)),
			new Promise((r) => setTimeout(r, 600))
		]);
		closing = false;
		sheet.close();
	};
	afterNavigate(() => {
		open = false;
		closing = false;
		sheet?.close();
		tucked = false;
		lastY = window.scrollY;
	});

	/**
	 * Like froservices.com: the bar slides away while you read down the page and comes back the
	 * moment you scroll up. Small jitters (under `STEP` px) are left to add up before they count.
	 */
	const STEP = 6;
	let tucked = $state(false);
	let lastY = 0;
	const onScroll = () => {
		const y = window.scrollY;
		if (Math.abs(y - lastY) < STEP) return;
		tucked = y > lastY && y > 120 && !open;
		lastY = y;
	};

	/** Close the language picker when a click lands anywhere outside it. */
	const onWindowPointer = (e: PointerEvent) => {
		if (open && !(e.target as Element).closest('.lang')) close();
	};
</script>

<svelte:window onpointerdown={onWindowPointer} onscroll={onScroll} />

<header class={['nav', { tucked }]}>
	<div class="lead">
		<a class="brand pill" href={localizeHref('/')} aria-label="Kebena Buna, home">
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
		<a
			class="quick pill"
			href={localizeHref('/visit')}
			aria-current={isCurrent('/visit') ? 'page' : undefined}
		>
			{m.site_nav_visit()}
		</a>
	</div>

	<nav class="switch pill" aria-label={m.site_nav_label()}>
		<a href={localizeHref('/')} aria-current={side === 'museum' ? 'true' : undefined}>
			{m.site_footer_museum()}
		</a>
		<a href={localizeHref('/shop')} aria-current={side === 'coffee' ? 'true' : undefined}>
			{m.site_footer_coffee()}
		</a>
	</nav>

	<div class="actions">
		<div class="lang">
			<button
				type="button"
				class="lang-btn pill"
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
			class="theme pill"
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
		<a class="order" href={localizeHref('/cart')}>
			{m.site_nav_cart()}{#if cartCount}<span
					class="count"
					aria-label={m.site_cart_count({ count: cartCount })}
				>
					{cartCount}
				</span>{/if}
		</a>
		<button
			type="button"
			class="burger pill"
			aria-haspopup="dialog"
			aria-expanded={sheetOpen}
			aria-controls="nav-sheet"
			onclick={openSheet}
		>
			<span class="burger-word">{m.site_nav_menu()}</span>
			<span class="bars" aria-hidden="true"><i></i><i></i></span>
		</button>
	</div>
</header>

<dialog
	class="sheet"
	id="nav-sheet"
	aria-label={m.site_nav_menu()}
	bind:this={sheet}
	data-closing={closing || undefined}
	oncancel={(e) => {
		e.preventDefault();
		void closeSheet();
	}}
	onclose={() => (sheetOpen = false)}
>
	<span class="rings" aria-hidden="true"></span>
	<div class="frame">
		<div class="sheet-top">
			<p class="kicker">{m.site_nav_menu()}</p>
			<button type="button" class="shut" aria-label={m.site_nav_close()} onclick={closeSheet}>
				<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
					<path d="M5 5l10 10M15 5 5 15" />
				</svg>
			</button>
		</div>

		<nav class="links" aria-label={m.site_nav_label()}>
			{#each groups as g, gi (g.id)}
				<section>
					<p class="kicker">{g.label}</p>
					<ol>
						{#each g.links as l, li (l.path + (l.hash ?? ''))}
							<li style:--i={offsets[gi] + li}>
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; only the #hash is appended -->
								<a
									href={hrefOf(l.path, l.hash)}
									aria-current={isCurrent(l.path, l.hash) ? 'page' : undefined}
								>
									<span class="num" aria-hidden="true">{pad(offsets[gi] + li + 1)}</span>
									<span class="word">{l.label}</span>
								</a>
							</li>
						{/each}
					</ol>
				</section>
			{/each}
		</nav>

		<aside class="side">
			<div class="block">
				<p class="kicker">{m.site_footer_help()}</p>
				<ul class="plain">
					<li>
						<a
							href={localizeHref('/contact')}
							aria-current={isCurrent('/contact') ? 'page' : undefined}
						>
							{m.site_nav_contact()}
						</a>
					</li>
					<li>
						<a
							href={localizeHref('/track')}
							aria-current={isCurrent('/track') ? 'page' : undefined}
						>
							{m.site_footer_track()}
						</a>
					</li>
					<li>
						<a href={localizeHref('/cart')}>
							{m.site_nav_cart()}{#if cartCount}&nbsp;({cartCount}){/if}
						</a>
					</li>
				</ul>
			</div>
			<div class="block">
				<p class="kicker" id="sheet-lang">{m.story_language()}</p>
				<div class="chips" role="group" aria-labelledby="sheet-lang">
					{#each locales as l (l)}
						<button
							type="button"
							class={['chip', { on: l === current }]}
							aria-pressed={l === current}
							lang={l}
							onclick={() => choose(l)}
						>
							{NAMES[l]}
						</button>
					{/each}
				</div>
			</div>
			<div class="block">
				<button type="button" class="chip" aria-pressed={dark} onclick={toggleTheme}>
					<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
						<path d="M15.5 12.4A6.5 6.5 0 0 1 7.6 4.5a6.5 6.5 0 1 0 7.9 7.9Z" />
					</svg>
					Dark mode
				</button>
			</div>
		</aside>
	</div>
</dialog>

{#if wayfinder}<Wayfinder />{/if}

<style>
	/* ── The bar: pinned to the top, open across the page; each control is its own glass pill ── */
	.nav {
		position: fixed;
		z-index: 40;
		inset-block-start: 0;
		inset-inline: 0;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 16px;
		width: min(1120px, calc(100% - 32px));
		margin-inline: auto;
		padding-block: 14px;
		/* the bar itself lets clicks through to the page between its pills */
		pointer-events: none;
		color: var(--color-mist-50);
	}
	.nav > * {
		pointer-events: auto;
	}
	/* scrolled away; a keyboard user tabbing into it brings it straight back */
	.nav.tucked:not(:has(:focus-visible)) {
		translate: 0 calc(-100% - 8px);
	}
	@media (prefers-reduced-motion: no-preference) {
		.nav {
			transition: translate 0.4s cubic-bezier(0.22, 1, 0.36, 1);
		}
	}
	.pill {
		/* dense enough that the light labels pass contrast even over a white page */
		background: var(--chrome);
		backdrop-filter: var(--glass-fx);
		-webkit-backdrop-filter: var(--glass-fx);
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 999px;
	}
	.lead {
		display: flex;
		align-items: center;
		gap: 6px;
		justify-self: start;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 9px;
		height: 44px;
		padding-inline: 14px 18px;
		color: var(--color-lime-300);
		text-decoration: none;
		font-size: 17px;
		letter-spacing: -0.01em;
	}
	.brand span {
		color: var(--color-mist-50);
	}
	.quick {
		display: flex;
		align-items: center;
		height: 44px;
		padding-inline: 18px;
		color: rgb(248 231 204 / 0.88);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		transition: color 0.2s;
	}
	.quick:hover,
	.quick[aria-current='page'] {
		color: var(--color-lime-300);
	}
	/* fro's segmented switch: which half of the house you are in */
	.switch {
		display: flex;
		gap: 2px;
		padding: 4px;
	}
	.switch a {
		padding: 8px 18px;
		border-radius: 999px;
		color: rgb(248 231 204 / 0.82);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		transition:
			background-color 0.25s,
			color 0.25s;
	}
	.switch a:hover {
		color: #fff;
		background: rgb(255 255 255 / 0.08);
	}
	.switch a[aria-current='true'] {
		background: var(--color-mist-50);
		color: var(--color-forest-900);
	}
	.actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		justify-self: end;
	}
	.lang {
		position: relative;
	}
	.lang-btn {
		display: flex;
		align-items: center;
		gap: 7px;
		height: 44px;
		padding-inline: 14px;
		color: rgb(248 231 204 / 0.88);
		font: inherit;
		font-size: 14px;
		cursor: pointer;
		transition: color 0.2s;
	}
	.lang-btn:hover,
	.lang-btn[aria-expanded='true'] {
		color: #fff;
	}
	.lang svg path,
	.lang svg circle,
	.theme path,
	.theme circle,
	.shut path,
	.chip path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.theme {
		display: grid;
		place-items: center;
		flex: none;
		width: 44px;
		height: 44px;
		padding: 0;
		color: rgb(248 231 204 / 0.88);
		cursor: pointer;
		transition: color 0.2s;
	}
	.theme:hover {
		color: #fff;
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
		color: rgb(248 231 204 / 0.86);
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
	.order {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		height: 44px;
		white-space: nowrap;
		padding-inline: 18px;
		border-radius: 999px;
		background: var(--color-lime-400);
		color: var(--color-forest-900);
		text-decoration: none;
		font-size: 14px;
		font-weight: 600;
		transition: background-color 0.2s;
	}
	.order:hover {
		background: var(--color-lime-300);
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
	/* "Menu" and a round badge with two bars, as on froservices.com */
	.burger {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 44px;
		padding-inline: 16px 5px;
		color: var(--color-mist-50);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}
	.bars {
		display: grid;
		place-content: center;
		gap: 4px;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--color-mist-50);
		transition: background-color 0.2s;
	}
	.bars i {
		display: block;
		width: 13px;
		height: 1.6px;
		border-radius: 2px;
		background: var(--color-forest-900);
		transition: width 0.25s;
	}
	.burger:hover .bars {
		background: var(--color-lime-300);
	}
	.burger:hover .bars i:last-child {
		width: 8px;
	}
	:is(.lang-btn, .theme, .burger, .switch a, .quick, .brand, .order):focus-visible {
		outline: 2px solid var(--color-lime-300);
		outline-offset: 2px;
	}

	/* ── The full-screen menu ── */
	.sheet {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		overflow-y: auto;
		background: var(--color-forest-950);
		color: var(--color-mist-50);
		opacity: 0;
		transition-property: opacity, display, overlay;
		transition-duration: 0.3s;
		transition-timing-function: ease-out;
		transition-behavior: allow-discrete;
	}
	.sheet:modal {
		overscroll-behavior: contain;
	}
	.sheet::backdrop {
		overflow: hidden;
		overscroll-behavior: contain;
		background: transparent;
	}
	.sheet[open]:not([data-closing]) {
		opacity: 1;

		@starting-style {
			opacity: 0;
		}
	}
	/* faint rings rippling out from the menu button's corner */
	.rings {
		position: fixed;
		inset: 0;
		pointer-events: none;
		background: repeating-radial-gradient(
			circle at calc(100% - max(16px, (100% - 1120px) / 2) - 26px) 36px,
			transparent 0 95px,
			rgb(220 174 60 / 0.1) 95px 96px
		);
		mask-image: radial-gradient(circle at 100% 0, #000, transparent 75%);
	}
	:global(:dir(rtl)) .rings {
		scale: -1 1;
	}
	.frame {
		position: relative;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(28px, 4vw, 56px) clamp(24px, 3vw, 48px);
		align-content: start;
		width: min(1120px, calc(100% - 32px));
		min-height: 100%;
		margin-inline: auto;
		padding-block: 14px 40px;
	}
	.sheet-top {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 44px;
	}
	.kicker {
		margin: 0 0 14px;
		font-family: var(--font-display);
		font-stretch: 75%;
		font-weight: 600;
		font-size: 12px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-lime-400);
	}
	.sheet-top .kicker {
		margin: 0;
	}
	.shut {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		margin-inline-end: -4px;
		border: 1.5px solid var(--color-lime-400);
		border-radius: 50%;
		background: rgb(255 255 255 / 0.04);
		color: var(--color-mist-50);
		cursor: pointer;
		transition:
			background-color 0.2s,
			rotate 0.3s;
	}
	.shut:hover {
		background: rgb(220 174 60 / 0.16);
	}
	.links {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: subgrid;
		row-gap: 32px;
	}
	ol,
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.links ol {
		border-block-start: 1px solid rgb(248 231 204 / 0.12);
	}
	.links li {
		border-block-end: 1px solid rgb(248 231 204 / 0.12);
	}
	.links a {
		display: flex;
		align-items: baseline;
		gap: 14px;
		padding-block: 10px 8px;
		color: var(--color-mist-50);
		text-decoration: none;
	}
	.num {
		flex: none;
		width: 2ch;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.06em;
		font-variant-numeric: tabular-nums;
		color: rgb(248 231 204 / 0.5);
	}
	.word {
		font-family: var(--font-display);
		font-stretch: 75%;
		font-weight: 700;
		font-size: clamp(28px, 3.2vw, 44px);
		line-height: 1;
		letter-spacing: -0.01em;
		text-transform: uppercase;
		transition:
			color 0.2s,
			translate 0.3s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.links a:hover .word,
	.links a:focus-visible .word {
		color: var(--color-lime-300);
		translate: 6px 0;
	}
	.links a:hover .num,
	.links a[aria-current='page'] .num {
		color: var(--color-lime-400);
	}
	.links a[aria-current='page'] .word {
		color: var(--color-lime-400);
	}
	.links a:focus-visible,
	.plain a:focus-visible,
	.chip:focus-visible,
	.shut:focus-visible {
		outline: 2px solid var(--color-lime-300);
		outline-offset: 3px;
	}
	/* the links rise into place one after another as the menu opens */
	@media (prefers-reduced-motion: no-preference) {
		.sheet[open]:not([data-closing]) .links li {
			opacity: 1;
			translate: 0 0;
			transition:
				opacity 0.4s ease-out,
				translate 0.5s cubic-bezier(0.22, 1, 0.36, 1);
			transition-delay: calc(var(--i) * 30ms + 60ms);

			@starting-style {
				opacity: 0;
				translate: 0 14px;
			}
		}
		.shut:hover {
			rotate: 90deg;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet {
			transition-duration: 0.1s;
		}
	}
	.side {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: subgrid;
		align-items: start;
		padding-block-start: 24px;
		border-block-start: 1px solid rgb(248 231 204 / 0.12);
	}
	.plain {
		display: grid;
		gap: 4px;
	}
	.plain a {
		color: var(--color-mist-50);
		font-size: 17px;
		text-decoration: none;
	}
	.plain a:hover,
	.plain a[aria-current='page'] {
		color: var(--color-lime-300);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 8px 14px;
		border: 1px solid rgb(248 231 204 / 0.18);
		border-radius: 999px;
		background: none;
		color: rgb(248 231 204 / 0.86);
		font: inherit;
		font-size: 14px;
		cursor: pointer;
		transition:
			background-color 0.2s,
			border-color 0.2s;
	}
	.chip:hover {
		background: rgb(255 255 255 / 0.06);
	}
	.chip.on,
	.chip[aria-pressed='true'] {
		border-color: var(--color-lime-400);
		color: var(--color-lime-300);
	}
	.side .block:last-child {
		align-self: end;
		justify-self: end;
	}

	@media (min-width: 1800px) {
		.nav,
		.frame {
			width: min(1440px, calc(100% - 32px));
		}
	}
	@media (max-height: 560px) and (orientation: landscape) {
		.nav {
			padding-block: 8px;
		}
	}
	@media (max-width: 1060px) {
		.quick {
			display: none;
		}
	}
	@media (max-width: 900px) {
		.nav {
			grid-template-columns: 1fr auto;
		}
		.switch {
			display: none;
		}
		.frame,
		.links,
		.side {
			grid-template-columns: minmax(0, 1fr);
		}
		.side {
			gap: 24px;
		}
		.side .block:last-child {
			justify-self: start;
		}
	}
	@media (max-width: 640px) {
		.lang,
		.theme {
			display: none;
		}
	}
	/* the smallest phones: the leaf mark, the cart and the menu badge on one line */
	@media (max-width: 400px) {
		.nav {
			width: calc(100% - 24px);
			padding-block: 10px;
		}
		.brand span,
		.burger-word {
			display: none;
		}
		.brand {
			padding-inline: 11px;
		}
		.burger {
			padding-inline: 5px;
		}
		.order {
			padding-inline: 14px;
		}
	}
</style>
