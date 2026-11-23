<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { money, tr } from '#lib/format.ts';
	import Field from '#lib/site/Field.svelte';
	import Trap from '#lib/site/Trap.svelte';
	import ImageSelect from '@nahu/admin-kit/formComponents/ImageSelect.svelte';
	import { Checkbox } from '@nahu/admin-kit/components/ui/checkbox/index.js';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message } = superForm(data.form);

	const locale = $derived(getLocale());
	const r2 = (n: number) => Math.round(n * 100) / 100;

	/** The coffees, grouped: one card per product, its bag sizes as choices inside. */
	const products = $derived(
		[...new Set(data.variants.map((v) => v.productId))].map((id) => {
			const variants = data.variants.filter((v) => v.productId === id);
			const first = variants[0];
			return {
				id,
				name: tr(first.product, locale),
				notes: tr(first.tastingNotes ?? first.summary ?? '', locale),
				variants
			};
		})
	);

	const variant = $derived(data.variants.find((v) => v.id === Number($form.variantId)));
	const plan = $derived(data.plans.find((p) => p.id === Number($form.planId)));
	const roasts = $derived(data.roasts.filter((r) => r.productId === variant?.productId));
	const grinds = $derived(data.grinds.filter((g) => g.productId === variant?.productId));
	const zone = $derived(data.zones.find((z) => z.id === Number($form.deliveryZoneId)));
	const areas = $derived(data.areas.filter((a) => a.zoneId === zone?.id));

	const perDelivery = $derived(
		variant && plan
			? r2(variant.price * Number($form.quantity || 1) * (1 - plan.discountPct / 100))
			: 0
	);
	const total = $derived(plan ? r2(perDelivery * plan.deliveries) : 0);
	const fullPrice = $derived(
		variant && plan ? r2(variant.price * Number($form.quantity || 1) * plan.deliveries) : 0
	);

	/** A new coffee keeps the roast only if that coffee comes in it. */
	function pickVariant(id: number) {
		$form.variantId = id;
		const next = data.variants.find((v) => v.id === id);
		const allowed = data.roasts.filter((r) => r.productId === next?.productId);
		if (!allowed.some((r) => r.id === Number($form.roastLevelId))) {
			$form.roastLevelId = (allowed.find((r) => r.isDefault) ?? allowed[0])?.id ?? 0;
		}
		if (
			$form.grindId &&
			!data.grinds.some((g) => g.productId === next?.productId && g.id === Number($form.grindId))
		) {
			$form.grindId = null;
		}
	}
</script>

<svelte:head>
	<title>{m.subs_title()} · Kebena</title>
	<meta name="description" content={m.subs_lede()} />
</svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.subs_label()}</p>
		<h1 class="title">{m.subs_title()}</h1>
		<p class="lede">{m.subs_lede()}</p>
	</header>

	{#if !data.plans.length || !data.variants.length}
		<p class="section notice">{m.subs_none()}</p>
	{:else}
		<form method="POST" class="section split" use:enhance>
			<div class="form">
				<Trap />
				<input type="hidden" name="idempotencyKey" value={$form.idempotencyKey} />

				<fieldset>
					<legend>{m.subs_step_coffee()}</legend>
					<div class="coffees">
						{#each products as p (p.id)}
							<div class="card coffee">
								<p class="mid" id="coffee-{p.id}">{p.name}</p>
								{#if p.notes}<p class="small muted">{p.notes}</p>{/if}
								<!-- One radio group across the cards: every card's choices are named `variantId`. -->
								<ImageSelect
									name="variantId"
									id="variant-{p.id}"
									bind:value={() => Number($form.variantId), (v) => pickVariant(Number(v))}
									items={p.variants.map((v) => ({
										value: v.id,
										name: v.size ? tr(v.size, locale) : tr(v.variantName ?? '', locale),
										meta: money(v.price)
									}))}
									labelledBy="coffee-{p.id}"
								/>
							</div>
						{/each}
					</div>
					{#if $errors.variantId}<p class="error">{$errors.variantId[0]}</p>{/if}
					<div class="fields two">
						<Field
							type="select"
							label={m.subs_roast()}
							name="roastLevelId"
							bind:value={$form.roastLevelId}
							errors={$errors.roastLevelId}
							options={roasts.map((r) => ({ value: r.id, label: tr(r.name, locale) }))}
							required
						/>
						<Field
							type="select"
							label={m.subs_grind()}
							name="grindId"
							bind:value={$form.grindId}
							errors={$errors.grindId}
							placeholder={m.subs_area_pick()}
							options={grinds.map((g) => ({ value: g.id, label: tr(g.name, locale) }))}
						/>
					</div>
					<div class="count-row">
						<span class="small">{m.subs_bags()}</span>
						<div class="count">
							<button
								type="button"
								aria-label={m.subs_fewer()}
								disabled={Number($form.quantity) <= 1}
								onclick={() => ($form.quantity = Number($form.quantity) - 1)}
							>
								−
							</button>
							<output aria-live="polite">{$form.quantity}</output>
							<button
								type="button"
								aria-label={m.subs_more()}
								disabled={Number($form.quantity) >= 5}
								onclick={() => ($form.quantity = Number($form.quantity) + 1)}
							>
								+
							</button>
						</div>
						<input type="hidden" name="quantity" value={$form.quantity} />
					</div>
				</fieldset>

				<fieldset>
					<legend id="plan-legend">{m.subs_step_plan()}</legend>
					<ImageSelect
						name="planId"
						bind:value={$form.planId}
						items={data.plans.map((p) => ({
							value: p.id,
							name: `${p.deliveries} ${m.subs_deliveries_word()}`,
							description: p.discountPct > 0 ? m.subs_save({ pct: p.discountPct }) : undefined
						}))}
						labelledBy="plan-legend"
					/>
					<ImageSelect
						name="frequency"
						bind:value={$form.frequency}
						items={[
							{ value: 'biweekly', name: m.subs_biweekly(), description: m.subs_biweekly_hint() },
							{ value: 'monthly', name: m.subs_monthly(), description: m.subs_monthly_hint() }
						]}
						labelledBy="plan-legend"
					/>
				</fieldset>

				<fieldset>
					<legend>{m.subs_step_where()}</legend>
					<div class="fields two">
						<Field
							type="select"
							label={m.subs_zone()}
							name="deliveryZoneId"
							bind:value={$form.deliveryZoneId}
							errors={$errors.deliveryZoneId}
							options={data.zones.map((z) => ({ value: z.id, label: tr(z.name, locale) }))}
							required
						/>
						{#if zone && !zone.isPickup && areas.length}
							<Field
								type="select"
								label={m.subs_area()}
								name="areaId"
								bind:value={$form.areaId}
								errors={$errors.areaId}
								placeholder={m.subs_area_pick()}
								options={areas.map((a) => ({ value: a.id, label: tr(a.name, locale) }))}
								required
							/>
						{/if}
						{#if zone && !zone.isPickup}
							<Field
								label={m.subs_city()}
								name="city"
								bind:value={$form.city}
								errors={$errors.city}
								required
								autocomplete="address-level2"
							/>
							<Field
								label={m.subs_line1()}
								name="line1"
								bind:value={$form.line1}
								errors={$errors.line1}
								required
								autocomplete="street-address"
								wide
							/>
							<Field
								label={m.subs_landmark()}
								name="landmark"
								bind:value={$form.landmark}
								errors={$errors.landmark}
								hint={m.subs_landmark_hint()}
								wide
							/>
						{:else if zone}
							<p class="hint wide">{m.subs_pickup_hint()}</p>
						{/if}
					</div>
				</fieldset>

				<fieldset>
					<legend>{m.subs_step_you()}</legend>
					<div class="fields two">
						<Field
							label={m.member_name()}
							name="name"
							bind:value={$form.name}
							errors={$errors.name}
							required
							autocomplete="name"
						/>
						<Field
							label={m.member_phone()}
							name="phone"
							type="tel"
							bind:value={$form.phone}
							errors={$errors.phone}
							required
							autocomplete="tel"
							hint={m.subs_phone_hint()}
						/>
						<Field
							label={m.member_email()}
							name="email"
							type="email"
							bind:value={$form.email}
							errors={$errors.email}
							autocomplete="email"
							wide
						/>
					</div>
				</fieldset>

				<label class="check">
					<Checkbox name="marketingConsent" bind:checked={$form.marketingConsent} />
					<span>{m.subs_consent()}</span>
				</label>
			</div>

			<aside class="aside card summary">
				<p class="label">{m.member_summary()}</p>
				{#if variant && plan}
					<h2 class="section-title">{tr(variant.product, locale)}</h2>
					<ul class="lines">
						<li>
							<span>{m.subs_per_delivery({ count: Number($form.quantity) })}</span><span
								class="num"
							>
								{money(perDelivery)}
							</span>
						</li>
						<li>
							<span>{m.subs_deliveries({ count: plan.deliveries })}</span><span class="num">
								× {plan.deliveries}
							</span>
						</li>
						{#if fullPrice > total}<li>
								<span>{m.subs_you_save()}</span><span class="num">−{money(fullPrice - total)}</span>
							</li>{/if}
						<li class="total">
							<span>{m.site_total()}</span><span class="num">{money(total)}</span>
						</li>
					</ul>
				{/if}
				<p class="hint">{m.subs_pay_note()}</p>
				{#if $message}<p class="notice" role="status">{$message}</p>{/if}
				<button class="btn" disabled={$delayed || !variant || !plan}>{m.subs_submit()}</button>
			</aside>
		</form>
	{/if}
</div>

<style>
	/* A neighbour's hint must not stretch this field's input (grid rows stretch by default). */
	.form :global(.field) {
		align-content: start;
	}
	.coffees {
		display: grid;
		gap: 12px;
	}
	.coffee {
		display: grid;
		gap: 10px;
		padding: 18px;
	}
	.coffee p {
		margin: 0;
	}
	.mid {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 600;
	}
	.small {
		font-size: 14px;
	}
	.count-row {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.wide {
		grid-column: 1 / -1;
	}
	.summary {
		display: grid;
		gap: 14px;
	}
	.summary p,
	.summary h2 {
		margin: 0;
	}
</style>
