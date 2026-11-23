<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { money, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';
	import { pictureOf } from '#lib/site/visit/pictures.ts';

	let { data } = $props();

	const locale = $derived(getLocale());

	const fromPrice = (prices: { price: number }[]) => (prices.length ? Math.min(...prices.map((p) => p.price)) : null);
	const basis = (pricing: string) =>
		pricing === 'per_booking' ? m.exp_per_booking() : pricing === 'ticket_plus' ? m.exp_ticket_plus() : m.exp_per_person();
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
			<ul class="cards list">
				{#each data.experiences as x (x.id)}
					{@const from = fromPrice(x.prices)}
					<li class="card item">
						<img src={pictureOf(x.image, x.kind)} alt="" loading="lazy" decoding="async" />
						<div class="body">
							<h2>{tr(x.name, locale)}</h2>
							<p class="muted meta">
								{m.exp_duration({ minutes: x.durationMin })} ·
								{x.maxParty ? m.exp_party({ min: x.minParty, max: x.maxParty }) : m.exp_party_min({ min: x.minParty })}
							</p>
							{#if x.description}<p class="desc">{tr(x.description, locale)}</p>{/if}
							<p class="price-line">
								{#if x.pricing === 'quote'}
									{m.exp_quote()}
								{:else if x.pricing === 'free' || from === 0}
									{m.exp_free()}
								{:else if from !== null}
									<span class="price">{money(from)}</span> <span class="muted">{basis(x.pricing)}</span>
								{/if}
							</p>
							<a class="btn small" href={siteHref(`/experiences/${x.slug}`, locale)}>{m.exp_book()}</a>
						</div>
					</li>
				{/each}
			</ul>
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

<style>
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
	}
	.item {
		display: grid;
		grid-template-rows: auto 1fr;
		padding: 0;
		overflow: hidden;
	}
	.item img {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
	}
	.body {
		display: grid;
		gap: 10px;
		align-content: start;
		padding: clamp(18px, 2.4vw, 24px);
	}
	.body h2 {
		font-size: 1.4rem;
		font-weight: 700;
	}
	.body p {
		margin: 0;
	}
	.meta {
		font-size: 14px;
	}
	.desc {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.btn {
		justify-self: start;
	}
</style>
