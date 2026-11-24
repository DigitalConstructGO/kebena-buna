<script lang="ts">
	import { page } from '$app/state';
	import { deLocalizeHref, localizeHref } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';

	/**
	 * Phone navigation as museum wayfinding: a "you are here" sign at the bottom of the screen
	 * names the room you are standing in; tapping it unfolds the floor plan as one route from the
	 * entrance to the exit, with the other wings beside it.
	 */
	/** `hall`: the number its own heading gives it ("Hall 02 · The farms"); rooms that are not a hall take none. */
	type Room = { id: string; name: string; note: string; interlude?: boolean; hall?: number };
	const ROOMS: Room[] = $derived([
		{
			id: 'entrance',
			name: m.museum_wayfinder_room_entrance_name(),
			note: m.museum_wayfinder_room_entrance_note(),
			hall: 0
		},
		{
			id: 'halls',
			name: m.museum_wayfinder_room_halls_name(),
			note: m.museum_wayfinder_room_halls_note()
		},
		// between the halls, not one of them: it takes no number
		{
			id: 'journey',
			name: m.museum_wayfinder_room_journey_name(),
			note: m.museum_wayfinder_room_journey_note(),
			interlude: true
		},
		{
			id: 'farms',
			name: m.museum_wayfinder_room_farms_name(),
			note: m.museum_wayfinder_room_farms_note(),
			hall: 2
		},
		{
			id: 'collection',
			name: m.museum_wayfinder_room_collection_name(),
			note: m.museum_wayfinder_room_collection_note(),
			hall: 3
		},
		{
			id: 'origins',
			name: m.museum_wayfinder_room_origins_name(),
			note: m.museum_wayfinder_room_origins_note(),
			hall: 3
		},
		{
			id: 'people',
			name: m.museum_wayfinder_room_people_name(),
			note: m.museum_wayfinder_room_people_note(),
			hall: 4
		},
		{
			id: 'archive',
			name: m.museum_wayfinder_room_archive_name(),
			note: m.museum_wayfinder_room_archive_note()
		},
		{
			id: 'visit',
			name: m.museum_wayfinder_room_visit_name(),
			note: m.museum_wayfinder_room_visit_note()
		}
	]);
	const WINGS = $derived([
		{
			path: '/history',
			name: m.site_nav_history(),
			note: m.museum_wayfinder_wing_history_note()
		},
		{
			path: '/kingdoms',
			name: m.site_footer_kingdoms(),
			note: m.museum_wayfinder_wing_kingdoms_note()
		}
	]);

	const here = $derived(deLocalizeHref(page.url.pathname));
	const onHome = $derived(here === '/');
	const home = $derived(localizeHref('/'));
	const wingHref = (path: string) => localizeHref(path);
	const pad = (n: number) => String(n).padStart(2, '0');
	/** Hall numbers as the sections' own headings give them, so the sign and the page agree; null for a room that is not a hall. */
	const NUMS = $derived(ROOMS.map((r) => (r.hall === undefined ? null : pad(r.hall))));

	/** Index of the room in view on the home page; -1 while the opening story plays. */
	let current = $state(-1);
	// true only above the entrance, while the opening story plays
	let above = $state(true);
	/** How far through the museum the reader is, 0 to 1, for the ring on the sign. */
	let travelled = $state(0);
	let sheet = $state<HTMLDialogElement>();
	let trigger = $state<HTMLButtonElement>();

	const wing = $derived(WINGS.find((w) => w.path === here));
	const label = $derived(
		wing
			? { num: m.museum_wayfinder_wing(), name: wing.name }
			: current >= 0
				? {
						num: NUMS[current] ?? (ROOMS[current].interlude ? m.museum_wayfinder_interlude() : ''),
						name: ROOMS[current].name
					}
				: { num: m.museum_wayfinder_start(), name: m.museum_wayfinder_explore() }
	);

	$effect(() => {
		if (!onHome) return;
		const rooms = ROOMS.map((r) => document.getElementById(r.id)).filter(
			(el): el is HTMLElement => !!el
		);
		// a room counts as "here" once it crosses the middle band of the screen
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting) continue;
					current = ROOMS.findIndex((r) => r.id === e.target.id);
				}
			},
			{ rootMargin: '-45% 0px -50% 0px' }
		);
		rooms.forEach((el) => io.observe(el));
		const first = rooms[0];
		const measure = () => {
			const max = document.documentElement.scrollHeight - innerHeight;
			travelled = max > 0 ? Math.min(1, scrollY / max) : 0;
			// above the entrance the story is still playing: no room yet
			above = !!first && first.getBoundingClientRect().top > innerHeight * 0.5;
			if (above) current = -1;
			// at the very end the footer holds the middle band, so the last room never crosses it
			else if (max > 0 && scrollY >= max - 2)
				current = ROOMS.findIndex((r) => r.id === rooms.at(-1)?.id);
		};
		let queued = false;
		const onScroll = () => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(() => {
				queued = false;
				measure();
			});
		};
		measure();
		addEventListener('scroll', onScroll, { passive: true });
		return () => {
			io.disconnect();
			removeEventListener('scroll', onScroll);
		};
	});

	/** True once the footer's wordmark has come up to where the sign sits: the sign steps aside for it. */
	let atFoot = $state(false);
	$effect(() => {
		void here;
		const mark = document.querySelector('footer .mark');
		if (!mark) return;
		const io = new IntersectionObserver(([e]) => (atFoot = e.isIntersecting), {
			rootMargin: '0px 0px -8px 0px'
		});
		io.observe(mark);
		return () => {
			io.disconnect();
			atFoot = false;
		};
	});

	const open = () => sheet?.showModal();
	const close = () => sheet?.close();
	/** A tap on the dimmed page around the sheet closes it. */
	const onSheetClick = (e: MouseEvent) => {
		if (e.target === sheet) close();
	};
</script>

<div class="wayfinder">
	<div class={['dock', { compact: onHome && above, away: atFoot }]}>
		<button
			type="button"
			class={['sign', { compact: onHome && above }]}
			bind:this={trigger}
			aria-label={onHome && current < 0 ? m.museum_wayfinder_floor_plan() : undefined}
			aria-haspopup="dialog"
			onclick={open}
			style:--travelled={onHome ? travelled : 1}
		>
			<span class="ring" aria-hidden="true"></span>
			<span class="where">
				{#if label.num}<span class="num">{label.num}</span>{/if}
				<span class="name">{label.name}</span>
			</span>
			<span class="hint">{m.museum_wayfinder_floor_plan()}</span>
			<svg class="up" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
				<path d="m3 7.5 3-3 3 3" />
			</svg>
		</button>
	</div>

	<dialog
		class="sheet"
		bind:this={sheet}
		aria-labelledby="wayfinder-title"
		onclick={onSheetClick}
		onclose={() => trigger?.focus()}
	>
		<div class="panel">
			<span class="grip" aria-hidden="true"></span>
			<header class="top">
				<div>
					<p class="eyebrow">{m.museum_wayfinder_floor_plan()}</p>
					<h2 id="wayfinder-title">{m.museum_wayfinder_title()}</h2>
				</div>
				<button type="button" class="close" aria-label={m.museum_wayfinder_close()} onclick={close}>
					<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
						<path d="M4 4l8 8M12 4l-8 8" />
					</svg>
				</button>
			</header>

			<nav aria-label={m.museum_wayfinder_rooms()}>
				<ol class="route">
					{#each ROOMS as r, i (r.id)}
						{@const isHere = onHome && i === current}
						<li class={['stop', { here: isHere, past: onHome && i < current }]}>
							<!-- eslint-disable svelte/no-navigation-without-resolve -- the path is resolved; only the #hash is appended -->
							<a
								href={`${home}#${r.id}`}
								aria-current={isHere ? 'location' : undefined}
								onclick={close}
							>
								<span class="dot" aria-hidden="true"></span>
								{#if NUMS[i]}
									<span class="num">{NUMS[i]}</span>
								{:else}
									<span class="num" aria-hidden="true">–</span>
								{/if}
								<span class="text">
									<span class="name">
										{r.name}{#if r.interlude}<span class="sr-only">
												{m.museum_wayfinder_interlude_sr()}
											</span>{/if}
									</span>
									<span class="note">{isHere ? m.museum_wayfinder_here() : r.note}</span>
								</span>
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</li>
					{/each}
				</ol>
			</nav>

			<nav class="wings" aria-label={m.museum_wayfinder_other_wings()}>
				<p class="eyebrow">{m.museum_wayfinder_other_wings()}</p>
				<ul>
					{#each WINGS as w (w.path)}
						<li>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved through wingHref -->
							<a
								href={wingHref(w.path)}
								class={{ here: here === w.path }}
								aria-current={here === w.path ? 'page' : undefined}
								onclick={close}
							>
								<span class="name">{w.name}</span>
								<span class="note">{here === w.path ? m.museum_wayfinder_here() : w.note}</span>
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>
	</dialog>
</div>

<style>
	/* phones only: wider screens keep the links in the top bar */
	.wayfinder {
		display: none;
	}
	@media (max-width: 720px) {
		.wayfinder {
			display: block;
		}
	}
	.dock {
		position: fixed;
		z-index: 30;
		inset-inline: 0;
		bottom: max(14px, env(safe-area-inset-bottom));
		width: fit-content;
		max-width: calc(100vw - 32px);
		margin-inline: auto;
		display: flex;
		align-items: stretch;
		gap: 8px;
		transition:
			translate 0.4s cubic-bezier(0.2, 0.8, 0.2, 1),
			opacity 0.3s,
			visibility 0.3s;
	}
	/* at the end of the page the wordmark closes the museum on its own */
	.dock.away {
		translate: 0 140%;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
	}
	.sign {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		min-height: 52px;
		padding: 8px 16px 8px 10px;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 16px;
		background: var(--chrome);
		backdrop-filter: var(--glass-fx);
		-webkit-backdrop-filter: var(--glass-fx);
		color: var(--color-mist-50);
		font: inherit;
		text-decoration: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: scale 0.2s;
	}
	.sign:active {
		scale: 0.97;
	}
	.sign:focus-visible {
		outline: 2px solid var(--color-lime-300);
		outline-offset: 3px;
	}
	/* how far through the museum: a ring that fills as you walk */
	.ring {
		flex: none;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background:
			radial-gradient(closest-side, rgb(13 34 23) 72%, transparent 74%),
			conic-gradient(
				var(--color-lime-300) calc(var(--travelled) * 1turn),
				rgb(255 255 255 / 0.14) 0
			);
		position: relative;
	}
	.ring::after {
		content: '';
		position: absolute;
		inset: 11px;
		border-radius: 50%;
		background: var(--color-lime-300);
	}
	.where {
		display: grid;
		min-width: 0;
		text-align: start;
		line-height: 1.2;
	}
	.where .num {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-lime-300);
	}
	.where .name {
		font-size: 15px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.hint {
		margin-inline-start: 6px;
		padding-inline-start: 12px;
		border-inline-start: 1px solid rgb(255 255 255 / 0.16);
		font-size: 13px;
		color: rgb(246 249 246 / 0.82);
		white-space: nowrap;
	}
	.up {
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	/* over the opening story: only the ring and the label, between the hero's own controls */
	.sign.compact .where {
		display: none;
	}
	.sign.compact .hint {
		display: block;
		margin: 0;
		padding: 0;
		border: 0;
	}
	@media (max-width: 360px) {
		.hint {
			display: none;
		}
	}

	/* the floor plan: a sheet that rises from the sign */
	.sheet {
		margin: auto auto 0;
		width: 100%;
		max-width: 560px;
		max-height: min(86svh, 760px);
		padding: 0;
		border: 0;
		border-radius: 24px 24px 0 0;
		background: var(--glass-strong);
		backdrop-filter: var(--glass-fx);
		-webkit-backdrop-filter: var(--glass-fx);
		color: var(--ink);
		overflow: auto;
		overscroll-behavior: contain;
		translate: 0 0;
		opacity: 1;
		transition:
			translate 0.36s cubic-bezier(0.2, 0.8, 0.2, 1),
			opacity 0.2s,
			overlay 0.36s allow-discrete,
			display 0.36s allow-discrete;
	}
	.sheet:not([open]) {
		translate: 0 100%;
		opacity: 0;
	}
	@starting-style {
		.sheet[open] {
			translate: 0 100%;
			opacity: 0;
		}
	}
	.sheet::backdrop {
		background: rgb(6 16 11 / 0.5);
		opacity: 1;
		transition:
			opacity 0.3s,
			overlay 0.36s allow-discrete,
			display 0.36s allow-discrete;
	}
	.sheet:not([open])::backdrop {
		opacity: 0;
	}
	@starting-style {
		.sheet[open]::backdrop {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet,
		.sheet::backdrop {
			transition: none;
		}
	}
	.panel {
		padding: 10px 20px max(24px, env(safe-area-inset-bottom));
	}
	.grip {
		display: block;
		width: 40px;
		height: 4px;
		margin: 0 auto 14px;
		border-radius: 4px;
		background: var(--line);
	}
	.top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 18px;
	}
	.eyebrow {
		margin: 0 0 4px;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent-mark);
	}
	h2 {
		margin: 0;
		font-size: 26px;
		font-weight: 300;
		line-height: 1.15;
	}
	.close {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 12px;
		background: var(--paper-tint);
		color: var(--ink);
		cursor: pointer;
	}
	.close path {
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}

	/* one route through the rooms, like the pour: a line with a stop at each room */
	.route {
		position: relative;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.route::before {
		content: '';
		position: absolute;
		inset-block: 22px;
		inset-inline-start: 11px;
		width: 2px;
		background: var(--line);
	}
	.stop a {
		position: relative;
		display: grid;
		grid-template-columns: 24px 28px minmax(0, 1fr);
		align-items: center;
		gap: 10px;
		min-height: 52px;
		padding: 6px 0;
		color: inherit;
		text-decoration: none;
		border-radius: 12px;
	}
	.stop a:focus-visible {
		outline: 2px solid var(--accent-mark);
		outline-offset: 2px;
	}
	.dot {
		justify-self: center;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--paper);
		border: 2px solid var(--line);
		position: relative;
		z-index: 1;
	}
	.stop.past .dot {
		background: var(--accent-mark);
		border-color: var(--accent-mark);
	}
	.stop.here .dot {
		width: 20px;
		height: 20px;
		background: var(--accent-mark);
		border-color: var(--paper);
		box-shadow: 0 0 0 2px var(--accent-mark);
	}
	.num {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-soft);
	}
	.text {
		display: grid;
		min-width: 0;
	}
	.name {
		font-size: 17px;
		line-height: 1.3;
	}
	.note {
		font-size: 13px;
		color: var(--ink-soft);
	}
	.stop.here .note,
	.wings a.here .note {
		color: var(--accent-mark);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.wings {
		margin-top: 22px;
		padding-top: 18px;
		border-top: 1px solid var(--line);
	}
	.wings ul {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
	}
	.wings a {
		display: grid;
		gap: 2px;
		min-height: 72px;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--paper-tint);
		color: inherit;
		text-decoration: none;
	}
	.wings a.here {
		background: var(--accent-wash);
	}
	.wings a:focus-visible {
		outline: 2px solid var(--accent-mark);
		outline-offset: 2px;
	}
</style>
