<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';
	import { pictureOf } from '#lib/site/visit/pictures.ts';
	import Field from '#lib/site/Field.svelte';
	import Trap from '#lib/site/Trap.svelte';
	import TicketCheckout from '#lib/site/visit/TicketCheckout.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message } = superForm(data.register);

	const locale = $derived(getLocale());
	const e = $derived(data.event);
	const when = $derived(
		new Intl.DateTimeFormat(locale, {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
			timeZone: 'Africa/Addis_Ababa'
		})
	);
	const choose = (audience: string) => `${siteHref(`/events/${e.slug}`, locale)}?audience=${encodeURIComponent(audience)}`;
</script>

<svelte:head><title>{tr(e.title, locale)} · Kebena</title></svelte:head>

<div class="page">
	<header class="head">
		<a class="label back" href={siteHref('/events', locale)}>← {m.events_back()}</a>
		<h1 class="title">{tr(e.title, locale)}</h1>
		{#if e.summary}<p class="lede">{tr(e.summary, locale)}</p>{/if}
	</header>

	<div class="section about">
		<img src={pictureOf(e.image, 'event')} alt="" decoding="async" />
		<dl class="card facts">
			<div>
				<dt class="label">{m.events_when()}</dt>
				<dd>{when.format(new Date(e.startsAt))}</dd>
			</div>
			<div>
				<dt class="label">{m.events_where()}</dt>
				<dd>{tr(e.location, locale)}</dd>
			</div>
			<div>
				<dt class="label">{m.events_seats()}</dt>
				<dd>
					{#if e.visibility === 'members_only'}{m.events_members_only()}{:else if e.open}{m.events_places_left({ count: e.left })}{:else}{e.left > 0
							? m.events_closed()
							: m.events_full()}{/if}
				</dd>
			</div>
		</dl>
		{#if e.description}<p class="desc">{tr(e.description, locale)}</p>{/if}
	</div>

	{#if e.visibility === 'members_only'}
		<p class="section notice">{m.events_members_note()}</p>
	{:else if !e.open}
		<p class="section notice">{e.left > 0 ? m.events_closed() : m.events_full()}</p>
	{:else if data.sellsTickets && data.audience}
		<section class="section">
			<h2 class="section-title">{m.events_register_title()}</h2>
			{#if data.audiences.length > 1}
				<div class="opts who">
					{#each data.audiences as a (a.code)}
						<a
								class="opt"
							class:on={a.code === data.audience.code}
							aria-current={a.code === data.audience.code ? 'true' : undefined}
							href={choose(a.code)}
							data-sveltekit-reset="false"
							data-sveltekit-replacestate
						>
							<span class="mid">{tr(a.name, locale)}</span>
						</a>
					{/each}
				</div>
			{/if}
			{#key data.audience.code}
				<TicketCheckout
					form={data.buy}
					types={data.types}
					declaration={data.audience.declaration}
					paymentsOn={data.paymentsOn}
					heading={m.events_tickets()}
					action="?/buy"
				/>
			{/key}
		</section>
	{:else}
		<section class="section">
			<form method="POST" action="?/register" class="card form register" use:enhance>
				<h2 class="section-title">{m.events_register_title()}</h2>
				<div class="fields two">
					<Field label={m.visit_name()} name="name" bind:value={$form.name} errors={$errors.name} required autocomplete="name" />
					<Field label={m.visit_phone()} name="phone" type="tel" bind:value={$form.phone} errors={$errors.phone} required autocomplete="tel" />
					<Field label={m.visit_email()} name="email" type="email" bind:value={$form.email} errors={$errors.email} autocomplete="email" />
					<Field
						label={m.events_seats()}
						name="seats"
						type="number"
						min={1}
						max={Math.min(e.left, 20)}
						bind:value={$form.seats}
						errors={$errors.seats}
						required
					/>
				</div>
				<label class="check">
					<input type="checkbox" name="marketingConsent" bind:checked={$form.marketingConsent} />
					<span>{m.visit_consent()}</span>
				</label>
				<Trap bind:value={$form.website} />
				{#if $message}<p class="notice" class:ok={$message === m.events_sent()} role="status">{$message}</p>{/if}
				<button class="btn" disabled={$delayed}>{m.events_register()}</button>
			</form>
		</section>
	{/if}
</div>

<style>
	.back {
		text-decoration: none;
	}
	.about {
		display: grid;
		gap: 20px;
	}
	.about img {
		width: 100%;
		max-height: 440px;
		object-fit: cover;
		border-radius: 20px;
	}
	.facts {
		display: grid;
		gap: 16px;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
		margin: 0;
	}
	.facts dd {
		margin: 4px 0 0;
		font-size: 1.05rem;
	}
	.desc {
		max-width: 70ch;
		margin: 0;
		font-size: 1.1rem;
		line-height: 1.6;
	}
	.who {
		margin-bottom: 24px;
	}
	.opt {
		color: inherit;
		text-decoration: none;
	}
	.opt.on {
		border-color: var(--accent-ink);
		background: color-mix(in srgb, var(--gold) 22%, transparent);
	}
	.mid {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 600;
	}
	.register {
		max-width: 720px;
	}
	.register h2,
	.register p {
		margin: 0;
	}
</style>
