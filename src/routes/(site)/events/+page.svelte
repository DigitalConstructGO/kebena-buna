<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { money, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';
	import { pictureOf } from '#lib/site/visit/pictures.ts';
	import Shelf from '#lib/site/shelf/Shelf.svelte';
	import ShelfCard from '#lib/site/shelf/ShelfCard.svelte';
	import Sheet from '#lib/site/shelf/Sheet.svelte';

	let { data } = $props();

	type Event = (typeof data.events)[number];
	/** The event picked up off the shelf. */
	let held = $state<Event>();
	let sheet = $state<ReturnType<typeof Sheet>>();
	const pick = (e: Event) => {
		held = e;
		sheet?.show();
	};

	const locale = $derived(getLocale());
	const when = $derived(
		new Intl.DateTimeFormat(locale, {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
			timeZone: 'Africa/Addis_Ababa'
		})
	);
	const day = $derived(
		new Intl.DateTimeFormat(locale, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			timeZone: 'Africa/Addis_Ababa'
		})
	);

	/** Whether a place can be had, as the card's badge and the pop-up say it. */
	const places = (e: Event) =>
		e.visibility === 'members_only'
			? m.events_members_only()
			: !e.open
				? e.left > 0
					? m.events_closed()
					: m.events_full()
				: m.events_places_left({ count: e.left });
	const priceOf = (e: Event) =>
		e.from === 0 ? m.events_free() : e.from !== null ? money(e.from) : undefined;
</script>

<svelte:head><title>{m.site_page_title({ title: m.events_title() })}</title></svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.events_label()}</p>
		<h1 class="title">{m.events_title()}</h1>
		<p class="lede">{m.events_lede()}</p>
	</header>

	<section class="section">
		{#if data.events.length}
			<Shelf>
				{#each data.events as e (e.id)}
					<ShelfCard
						href={siteHref(`/events/${e.slug}`, locale)}
						eyebrow={day.format(new Date(e.startsAt))}
						title={tr(e.title, locale)}
						notes={tr(e.summary, locale) || undefined}
						price={priceOf(e)}
						tag={e.open && e.visibility !== 'members_only' ? undefined : places(e)}
						tagOut={!e.open}
						hint={m.site_look()}
						image={pictureOf(e.image, 'event')}
						onpick={() => pick(e)}
					/>
				{/each}
			</Shelf>
		{:else}
			<p class="notice">{m.events_empty()}</p>
		{/if}
	</section>
</div>

<!-- An event picked up off the shelf: what, when, where, and the way to register. -->
<Sheet
	bind:this={sheet}
	label={held ? tr(held.title, locale) : undefined}
	onclose={() => (held = undefined)}
>
	{#if held}
		<div class="photo">
			<img src={pictureOf(held.image, 'event')} alt="" width="480" height="480" />
		</div>
		<div class="about">
			<p class="pk-label">{m.events_label()}</p>
			<h3>{tr(held.title, locale)}</h3>
			{#if tr(held.summary, locale)}<p class="sub">{tr(held.summary, locale)}</p>{/if}
			<dl>
				<div>
					<dt>{m.events_when()}</dt>
					<dd>{when.format(new Date(held.startsAt))}</dd>
				</div>
				<div>
					<dt>{m.events_where()}</dt>
					<dd>{tr(held.location, locale)}</dd>
				</div>
				<div>
					<dt>{m.events_seats()}</dt>
					<dd>{places(held)}</dd>
				</div>
				{#if priceOf(held)}
					<div>
						<dt>{m.events_tickets()}</dt>
						<dd>{priceOf(held)}</dd>
					</div>
				{/if}
			</dl>
			<a class="go" href={siteHref(`/events/${held.slug}`, locale)}>
				<span>{held.open ? m.events_register() : m.events_details()}</span>
				<svg viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6h11.5M7.5 1l5 5-5 5" /></svg>
			</a>
		</div>
	{/if}
</Sheet>
