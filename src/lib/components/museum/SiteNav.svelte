<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import type { Path } from '$app/types';
	import {
		deLocalizeHref,
		getLocale,
		localizeHref,
		locales,
		setLocale,
		type Locale
	} from '#lib/paraglide/runtime.js';

	const links = [
		{ path: '/', hash: '#halls', label: 'Halls' },
		{ path: '/history', hash: '', label: 'History' },
		{ path: '/kingdoms', hash: '', label: 'Kingdoms' },
		{ path: '/', hash: '#visit', label: 'Visit' }
	] as const;

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

	/** Close when a click lands anywhere outside the picker. */
	const onWindowPointer = (e: PointerEvent) => {
		if (open && !(e.target as Element).closest('.lang')) close();
	};
</script>

<svelte:window onpointerdown={onWindowPointer} />

<header class="nav">
	<a class="brand" href={resolve(localizeHref('/') as Path)} aria-label="Kebena Buna, home">
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
	<nav aria-label="Main">
		<ul>
			{#each links as l (l.label)}
				<li>
					<!-- the path is resolved; only the #hash is appended -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={`${resolve(localizeHref(l.path) as Path)}${l.hash}`}
						aria-current={!l.hash && deLocalizeHref(page.url.pathname) === l.path
							? 'page'
							: undefined}
					>
						{l.label}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
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
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; only the #hash is appended -->
	<a class="order" href={`${resolve(localizeHref('/') as Path)}#collection`}>Order</a>
</header>

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
		background: rgb(13 34 23 / 0.62);
		border: 1px solid rgb(255 255 255 / 0.1);
		backdrop-filter: blur(14px) saturate(1.2);
		-webkit-backdrop-filter: blur(14px) saturate(1.2);
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
	.lang-btn {
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
	nav ul {
		display: flex;
		gap: 4px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	nav a {
		display: block;
		padding: 9px 14px;
		border-radius: 10px;
		color: rgb(246 249 246 / 0.82);
		text-decoration: none;
		font-size: 14px;
		transition:
			background-color 0.2s,
			color 0.2s;
	}
	nav a[aria-current='page'] {
		background: rgb(255 255 255 / 0.1);
		color: #fff;
	}
	nav a:hover {
		background: rgb(255 255 255 / 0.08);
		color: #fff;
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
	@media (max-width: 720px) {
		nav {
			display: none;
		}
		.lang {
			margin-inline-start: auto;
		}
	}
	/* the smallest phones: keep the leaf mark, the language and the order button on one line */
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
