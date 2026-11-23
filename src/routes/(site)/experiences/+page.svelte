<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { money, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';
	import { pictureOf } from '#lib/site/visit/pictures.ts';
	import Shelf from '#lib/site/shelf/Shelf.svelte';
	import ShelfCard from '#lib/site/shelf/ShelfCard.svelte';
	import Sheet from '#lib/site/shelf/Sheet.svelte';

	let { data } = $props();

	type Experience = (typeof data.experiences)[number];
	/** The experience picked up off the shelf. */
	let held = $state<Experience>();
	let sheet = $state<ReturnType<typeof Sheet>>();
	const pick = (x: Experience) => {
		held = x;
		sheet?.show();
	};

	const locale = $derived(getLocale());

	const fromPrice = (prices: { price: number }[]) => (prices.length ? Math.min(...prices.map((p) => p.price)) : null);
	const basis = (pricing: string) =>
		pricing === 'per_booking' ? m.exp_per_booking() : pricing === 'ticket_plus' ? m.exp_ticket_plus() : m.exp_per_person();
	const party = (x: Experience) => (x.maxParty ? m.exp_party({ min: x.minParty, max: x.maxParty }) : m.exp_party_min({ min: x.minParty }));
	/** "ETB 300.00 per person", "Free" or "Price on request". */
	const priceOf = (x: Experience) => {
		const from = fromPrice(x.prices);
		if (x.pricing === 'quote') return m.exp_quote();
		if (x.pricing === 'free' || from === 0) return m.exp_free();
		return from === null ? undefined : `${money(from)} ${basis(x.pricing)}`;
	};
	const languageName = $derived(new Intl.DisplayNames([locale], { type: 'language' }));
	const languages = (x: Experience) => (x.languages ?? []).map((code) => languageName.of(code) ?? code).join(', ');
</script>

<svelte:head><title>{m.exp_title()} · Kebena</title></svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.exp_label()}</p>
		<h1 class="title">{m.exp_title()}</h1>
		<p class="lede">{m.exp_lede()}</p>
	</header>

	<section class="section">
		{#if data.experiences.length}
			<Shelf>
				{#each data.experiences as x (x.id)}
					<ShelfCard
						href={siteHref(`/experiences/${x.slug}`, locale)}
						title={tr(x.name, locale)}
						notes={`${m.exp_duration({ minutes: x.durationMin })} · ${party(x)}`}
						price={priceOf(x)}
						hint={m.site_look()}
						image={pictureOf(x.image, x.kind)}
						onpick={() => pick(x)}
					/>
				{/each}
			</Shelf>
		{:else}
			<p class="notice">{m.exp_empty()}</p>
		{/if}
	</section>

	<section class="section">
		<p class="notice">
			{m.exp_groups_note()}
			<a class="link" href={siteHref('/groups', locale)}>{m.exp_groups_link()}</a>
		</p>
	</section>
</div>

<!-- An experience picked up off the shelf: what it is, how long, for how many, and the way to book. -->
<Sheet bind:this={sheet} label={held ? tr(held.name, locale) : undefined} onclose={() => (held = undefined)}>
	{#if held}
		<div class="photo"><img src={pictureOf(held.image, held.kind)} alt="" width="480" height="480" /></div>
		<div class="about">
			<p class="pk-label">{m.exp_label()}</p>
			<h3>{tr(held.name, locale)}</h3>
			{#if tr(held.description, locale)}<p class="sub">{tr(held.description, locale)}</p>{/if}
			<dl>
				<div>
					<dt>{m.exp_how_long()}</dt>
					<dd>{m.exp_duration({ minutes: held.durationMin })}</dd>
				</div>
				<div>
					<dt>{m.exp_party_size()}</dt>
					<dd>{party(held)}</dd>
				</div>
				{#if priceOf(held)}
					<div>
						<dt>{m.exp_prices()}</dt>
						<dd>{priceOf(held)}</dd>
					</div>
				{/if}
				{#if languages(held)}
					<div>
						<dt>{m.exp_language()}</dt>
						<dd>{languages(held)}</dd>
					</div>
				{/if}
			</dl>
			<a class="go" href={siteHref(`/experiences/${held.slug}`, locale)}>
				<span>{m.exp_book()}</span>
				<svg viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6h11.5M7.5 1l5 5-5 5" /></svg>
			</a>
		</div>
	{/if}
</Sheet>
