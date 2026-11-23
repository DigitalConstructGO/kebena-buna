<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { money, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';
	import { pictureOf } from '#lib/site/visit/pictures.ts';
	import Field from '#lib/site/Field.svelte';
	import Trap from '#lib/site/Trap.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message } = superForm(data.form);

	const locale = $derived(getLocale());
	const x = $derived(data.experience);

	const languageName = $derived(new Intl.DisplayNames([locale], { type: 'language' }));
	const sessionWhen = $derived(
		new Intl.DateTimeFormat(locale, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
			timeZone: 'Africa/Addis_Ababa'
		})
	);
	const nameOf = (code: string | null) => (code ? (languageName.of(code) ?? code) : '—');

	const sessionOptions = $derived(
		x.sessions.map((s) => ({
			value: s.id,
			label: m.exp_session_option({ when: sessionWhen.format(new Date(s.startsAt)), language: nameOf(s.language), count: s.free })
		}))
	);
	const languageOptions = $derived((x.languages ?? []).map((code) => ({ value: code, label: nameOf(code) })));
	const basis = $derived(
		x.pricing === 'per_booking' ? m.exp_per_booking() : x.pricing === 'ticket_plus' ? m.exp_ticket_plus() : m.exp_per_person()
	);
</script>

<svelte:head><title>{tr(x.name, locale)} · Kebena</title></svelte:head>

<div class="page">
	<header class="head">
		<a class="label back" href={siteHref('/experiences', locale)}>← {m.exp_back()}</a>
		<h1 class="title">{tr(x.name, locale)}</h1>
		<p class="lede">
			{m.exp_duration({ minutes: x.durationMin })} ·
			{x.maxParty ? m.exp_party({ min: x.minParty, max: x.maxParty }) : m.exp_party_min({ min: x.minParty })}
		</p>
	</header>

	<div class="section split">
		<div class="about">
			<img src={pictureOf(x.image, x.kind)} alt="" decoding="async" />
			{#if x.description}<p class="desc">{tr(x.description, locale)}</p>{/if}
			<section class="card">
				<h2 class="section-title">{m.exp_prices()}</h2>
				{#if x.pricing === 'quote'}
					<p>{m.exp_quote()}</p>
				{:else if x.prices.length}
					<ul class="lines">
						{#each x.prices as p, i (i)}
							<li>
								<span>{tr(p.audience, locale)}</span>
								<span class="num">{p.price > 0 ? `${money(p.price)} ${basis}` : m.exp_free()}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p>{m.exp_free()}</p>
				{/if}
			</section>
		</div>

		<form method="POST" class="aside card form" use:enhance>
			<div>
				<h2 class="section-title">{m.exp_request_title()}</h2>
				<p class="muted">{m.exp_request_lede()}</p>
			</div>
			<div class="fields">
				{#if !x.isEnquiryOnly && sessionOptions.length}
					<Field
						label={m.exp_session()}
						name="sessionId"
						type="select"
						options={sessionOptions}
						placeholder="—"
						bind:value={$form.sessionId}
						errors={$errors.sessionId}
						required
					/>
				{:else}
					{#if !x.isEnquiryOnly}<p class="notice">{m.exp_no_sessions()}</p>{/if}
					<Field label={m.exp_preferred_date()} name="preferredDate" type="date" bind:value={$form.preferredDate} errors={$errors.preferredDate} />
				{/if}
				<Field
					label={m.exp_party_size()}
					name="partySize"
					type="number"
					min={x.minParty}
					max={x.maxParty ?? 250}
					bind:value={$form.partySize}
					errors={$errors.partySize}
					required
				/>
				{#if languageOptions.length > 1}
					<Field label={m.exp_language()} name="language" type="select" options={languageOptions} bind:value={$form.language} errors={$errors.language} />
				{/if}
				<Field label={m.visit_name()} name="name" bind:value={$form.name} errors={$errors.name} required autocomplete="name" />
				<Field label={m.visit_phone()} name="phone" type="tel" bind:value={$form.phone} errors={$errors.phone} required autocomplete="tel" />
				<Field label={m.visit_email()} name="email" type="email" bind:value={$form.email} errors={$errors.email} autocomplete="email" />
				<Field label={m.exp_requests()} name="specialRequests" type="textarea" rows={3} bind:value={$form.specialRequests} errors={$errors.specialRequests} />
				<Field
					label={m.exp_accessibility()}
					name="accessibilityNeeds"
					type="textarea"
					rows={2}
					bind:value={$form.accessibilityNeeds}
					errors={$errors.accessibilityNeeds}
				/>
			</div>
			<label class="check">
				<input type="checkbox" name="marketingConsent" bind:checked={$form.marketingConsent} />
				<span>{m.visit_consent()}</span>
			</label>
			<Trap bind:value={$form.website} />
			{#if $message}
				<p class="notice" class:ok={$message === m.exp_sent()} class:bad={$message !== m.exp_sent()} role="status">{$message}</p>
			{/if}
			<button class="btn" disabled={$delayed}>{m.exp_send()}</button>
		</form>
	</div>
</div>

<style>
	.back {
		text-decoration: none;
	}
	.about {
		display: grid;
		gap: 20px;
		align-content: start;
	}
	.about img {
		width: 100%;
		aspect-ratio: 16 / 10;
		object-fit: cover;
		border-radius: 20px;
	}
	.desc {
		margin: 0;
		font-size: 1.1rem;
		line-height: 1.6;
	}
	form .section-title {
		margin-bottom: 6px;
	}
	form p {
		margin: 0;
	}
</style>
