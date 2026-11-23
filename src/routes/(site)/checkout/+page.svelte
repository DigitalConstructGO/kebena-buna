<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { money, tr } from '#lib/format.ts';
	import { checkoutSchema } from '#lib/schemas/checkout.ts';
	import Field from '#lib/site/Field.svelte';
	import Trap from '#lib/site/Trap.svelte';
	import { siteHref } from '#lib/site/locale.ts';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting, message } = superForm(data.form, {
		validators: zod4Client(checkoutSchema),
		scrollToError: 'smooth'
	});

	const locale = $derived(getLocale());
	const zone = $derived($form.method === 'delivery' ? data.zones.find((z) => z.id === $form.zoneId) : undefined);
	const areas = $derived(data.areas.filter((a) => a.zoneId === $form.zoneId));
	/** The same rule the server charges by (`feeOf`): free above the zone's threshold. */
	const fee = $derived(zone ? (zone.free !== null && data.subtotal >= zone.free ? 0 : zone.fee) : 0);
	const total = $derived(data.subtotal + fee);
</script>

<svelte:head><title>{m.checkout_title()} · Kebena</title></svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.cart_label()}</p>
		<h1 class="title">{m.checkout_title()}</h1>
		<p class="lede">{m.checkout_lede()}</p>
	</header>

	<form method="POST" class="section split" use:enhance novalidate>
		<div class="form">
			<Trap bind:value={$form.website} />
			<input type="hidden" name="idempotencyKey" value={$form.idempotencyKey} />

			<fieldset>
				<legend>1. {m.checkout_you()}</legend>
				<div class="fields two">
					<Field label={m.checkout_name()} name="name" bind:value={$form.name} errors={$errors.name} required autocomplete="name" wide />
					<Field
						label={m.checkout_phone()}
						name="phone"
						type="tel"
						bind:value={$form.phone}
						errors={$errors.phone}
						required
						autocomplete="tel"
						hint={m.checkout_phone_hint()}
					/>
					<Field label={m.checkout_email()} name="email" type="email" bind:value={$form.email} errors={$errors.email} autocomplete="email" hint={m.checkout_email_hint()} />
				</div>
			</fieldset>

			<fieldset>
				<legend>2. {m.checkout_how()}</legend>
				<div class="opts">
					<label class="opt">
						<input type="radio" name="method" value="pickup" bind:group={$form.method} />
						<span class="mid">{m.checkout_pickup()}</span>
						<span class="small">
							{data.pickupPlace ? tr(data.pickupPlace.name, locale) : m.checkout_pickup_place()} · {m.checkout_free()}
						</span>
					</label>
					<label class="opt">
						<input type="radio" name="method" value="delivery" bind:group={$form.method} />
						<span class="mid">{m.checkout_delivery()}</span>
						<span class="small">{m.checkout_delivery_hint()}</span>
					</label>
				</div>

				{#if $form.method === 'delivery'}
					<div class="fields two">
						<Field
							label={m.checkout_zone()}
							name="zoneId"
							type="select"
							bind:value={$form.zoneId}
							errors={$errors.zoneId}
							required
							placeholder={m.checkout_choose()}
							options={data.zones.map((z) => ({
								value: z.id,
								label: `${tr(z.name, locale)} · ${money(z.fee)}`
							}))}
						/>
						<Field
							label={m.checkout_area()}
							name="areaId"
							type="select"
							bind:value={$form.areaId}
							errors={$errors.areaId}
							placeholder={areas.length ? m.checkout_choose() : m.checkout_area_other()}
							options={areas.map((a) => ({ value: a.id, label: tr(a.name, locale) }))}
						/>
						<Field label={m.checkout_city()} name="city" bind:value={$form.city} errors={$errors.city} required autocomplete="address-level2" />
						<Field label={m.checkout_woreda()} name="woreda" bind:value={$form.woreda} errors={$errors.woreda} />
						<Field
							label={m.checkout_line1()}
							name="line1"
							bind:value={$form.line1}
							errors={$errors.line1}
							required
							autocomplete="street-address"
							wide
						/>
						<Field label={m.checkout_landmark()} name="landmark" bind:value={$form.landmark} errors={$errors.landmark} hint={m.checkout_landmark_hint()} wide />
					</div>
					{#if zone?.usesCourier}
						<p class="notice">{m.checkout_courier_note({ days: zone.transitDays })}</p>
					{:else if zone && zone.free !== null && fee > 0}
						<p class="hint">{m.checkout_free_above({ amount: money(zone.free) })}</p>
					{/if}
				{/if}
			</fieldset>

			<fieldset>
				<legend>3. {m.checkout_anything()}</legend>
				<Field label={m.checkout_note()} name="note" type="textarea" rows={3} bind:value={$form.note} errors={$errors.note} />
				<label class="check">
					<input type="checkbox" name="marketingConsent" bind:checked={$form.marketingConsent} />
					<span>{m.checkout_consent()}</span>
				</label>
			</fieldset>
		</div>

		<aside class="aside card">
			<h2 class="section-title">{m.track_summary()}</h2>
			<ul class="lines">
				{#each data.lines as l (l.key)}
					<li>
						<span>{l.quantity} × {tr(l.description, locale)}</span>
						<span class="num">{money(l.lineTotal)}</span>
					</li>
				{/each}
				<li>
					<span>{m.site_delivery()}</span>
					<span class="num">{$form.method === 'pickup' ? m.checkout_free() : zone ? (fee ? money(fee) : m.checkout_free()) : '—'}</span>
				</li>
				<li class="total"><span>{m.site_total()}</span><span class="num">{money(total)}</span></li>
			</ul>
			<p class="hint">{m.checkout_vat()}</p>
			{#if $message}<p class="notice bad" role="alert">{$message}</p>{/if}
			<button class="btn wide" disabled={$submitting}>
				{data.paymentsOn ? m.checkout_pay({ amount: money(total) }) : m.checkout_place()}
			</button>
			<p class="hint">{data.paymentsOn ? m.checkout_pay_hint() : m.checkout_place_hint()}</p>
			<a class="link" href={siteHref('/cart', locale)}>← {m.checkout_back()}</a>
		</aside>
	</form>
</div>

<style>
	.wide {
		width: 100%;
		margin-top: 8px;
	}
	.aside {
		display: grid;
		gap: 12px;
	}
	.aside .hint {
		margin: 0;
	}
	.aside .lines li span:first-child {
		max-width: 70%;
	}
</style>
