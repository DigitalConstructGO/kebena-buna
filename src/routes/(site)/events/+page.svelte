<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { money, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';
	import { pictureOf } from '#lib/site/visit/pictures.ts';

	let { data } = $props();

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
</script>

<svelte:head><title>{m.events_title()} · Kebena</title></svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.events_label()}</p>
		<h1 class="title">{m.events_title()}</h1>
		<p class="lede">{m.events_lede()}</p>
	</header>

	<section class="section">
		{#if data.events.length}
			<ul class="cards list">
				{#each data.events as e (e.id)}
					<li class="card item">
						<img src={pictureOf(e.image, 'event')} alt="" loading="lazy" decoding="async" />
						<div class="body">
							<p class="label">{when.format(new Date(e.startsAt))}</p>
							<h2>{tr(e.title, locale)}</h2>
							{#if e.summary}<p class="muted">{tr(e.summary, locale)}</p>{/if}
							<p class="tags">
								{#if e.visibility === 'members_only'}
									<span class="tag">{m.events_members_only()}</span>
								{:else if !e.open}
									<span class="tag">{e.left > 0 ? m.events_closed() : m.events_full()}</span>
								{:else}
									<span class="tag">{m.events_places_left({ count: e.left })}</span>
								{/if}
								{#if e.from === 0}
									<span class="tag">{m.events_free()}</span>
								{:else if e.from !== null}
									<span class="price">{money(e.from)}</span>
								{/if}
							</p>
							<a class="btn small" href={siteHref(`/events/${e.slug}`, locale)}>
								{e.open ? m.events_register() : m.events_details()}
							</a>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="notice">{m.events_empty()}</p>
		{/if}
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
		aspect-ratio: 16 / 10;
		object-fit: cover;
	}
	.body {
		display: grid;
		gap: 10px;
		align-content: start;
		padding: clamp(18px, 2.4vw, 24px);
	}
	.body h2 {
		font-size: 1.35rem;
		font-weight: 700;
	}
	.body p {
		margin: 0;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.tag {
		padding: 3px 10px;
		border: 1px solid var(--hair);
		border-radius: 999px;
		font-size: 13px;
	}
	.btn {
		justify-self: start;
	}
</style>
