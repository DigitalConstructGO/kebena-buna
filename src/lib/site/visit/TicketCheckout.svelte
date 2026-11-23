<!--
	The ticket checkout shared by `/visit` (entry, with an arrival slot) and `/events/{slug}`: how
	many of each type, the buyer, the audience's ID declaration, marketing consent and the total.
	Posts as JSON (the quantities are a list), so it needs JavaScript, as the payment step does.
-->
<script lang="ts">
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { money, tr } from '#lib/format.ts';
	import Field from '#lib/site/Field.svelte';
	import Trap from '#lib/site/Trap.svelte';
	import PayWith from '#lib/site/PayWith.svelte';
	import DiscountCode from '#lib/site/DiscountCode.svelte';
	import { discountOff, type DiscountRule } from '#lib/discounts.ts';
	import ImageSelect from '@nahu/admin-kit/formComponents/ImageSelect.svelte';
	import { Checkbox } from '@nahu/admin-kit/components/ui/checkbox/index.js';

	type Localized = Record<string, string>;
	type TicketForm = {
		name: string;
		phone: string;
		email?: string | null;
		idempotencyKey?: string;
		website?: string;
		marketingConsent: boolean;
		audienceId: number;
		declared: boolean;
		payWith: 'online' | 'transfer';
		discountCode?: string | null;
		slotId?: number;
		items: { ticketTypeId: number; quantity: number }[];
	};
	type TicketType = {
		id: number;
		name: Localized;
		description: Localized | null;
		requiresProof: Localized | null;
		minQuantity: number;
		maxQuantity: number | null;
		price: number;
	};

	let {
		form: formData,
		types,
		declaration,
		slots,
		paymentsOn,
		transfersOn = false,
		itemType = 'ticket',
		heading,
		action
	}: {
		form: SuperValidated<TicketForm>;
		types: TicketType[];
		/** The audience's ID declaration, when it asks for one. */
		declaration: Localized | null;
		/** Arrival slots, for museum entry. */
		slots?: { id: number; label: string; remaining: number }[];
		paymentsOn: boolean;
		/** Bank accounts are listed, so a transfer can be chosen. */
		transfersOn?: boolean;
		/** What the lines are sold as, for the codes that apply only to some: entry or an event. */
		itemType?: 'ticket' | 'event_ticket';
		heading?: string;
		/** A named form action (`?/buy`); the page's default one when left out. */
		action?: string;
	} = $props();

	const uid = $props.id();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message } = superForm(formData, {
		dataType: 'json',
		// Chapa's checkout is another site: leave for it with a full page load.
		onResult({ result, cancel }) {
			if (
				result.type === 'redirect' &&
				new URL(result.location, location.href).origin !== location.origin
			) {
				cancel();
				location.href = result.location;
			}
		}
	});

	const locale = $derived(getLocale());
	const typeOf = (id: number) => types.find((t) => t.id === id);
	const gross = $derived(
		$form.items.reduce((sum, i) => sum + i.quantity * (typeOf(i.ticketTypeId)?.price ?? 0), 0)
	);
	let rule = $state<(DiscountRule & { code: string }) | null>(null);
	const discount = $derived(discountOff(rule, [{ itemType, gross }]));
	const total = $derived(gross - discount);
	const count = $derived($form.items.reduce((sum, i) => sum + i.quantity, 0));
	/** Straight on to Chapa, or to the order's page to pay by transfer. */
	const online = $derived(paymentsOn && $form.payWith !== 'transfer');

	/*
	 * Written through `$form`, not through a local `item`: changing a copy taken out of the store
	 * never tells the store, so the count, the total and the posted list all stayed at nought.
	 */
	function step(index: number, by: 1 | -1) {
		const { ticketTypeId, quantity } = $form.items[index];
		const t = typeOf(ticketTypeId);
		if (!t) return;
		const max = Math.min(t.maxQuantity ?? 50, 50);
		$form.items[index].quantity =
			by === 1
				? quantity === 0
					? Math.max(t.minQuantity, 1)
					: Math.min(quantity + 1, max)
				: quantity <= t.minQuantity
					? 0
					: quantity - 1;
	}
</script>

<form method="POST" {action} class="split" use:enhance>
	<div class="form">
		{#if slots}
			<fieldset>
				<legend id="{uid}-slot">{m.visit_time()}</legend>
				{#if slots.length}
					<ImageSelect
						name="slotId"
						bind:value={$form.slotId}
						items={slots.map((s) => ({
							value: s.id,
							name: s.label,
							description:
								s.remaining > 0 ? m.visit_places_left({ count: s.remaining }) : m.visit_full(),
							disabled: s.remaining < 1
						}))}
						labelledBy="{uid}-slot"
						invalid={Boolean($errors.slotId)}
					/>
				{:else}
					<p class="notice">{m.visit_no_slots()}</p>
				{/if}
				{#if $errors.slotId}<p class="error" role="alert">{$errors.slotId[0]}</p>{/if}
			</fieldset>
		{/if}

		<fieldset>
			<legend>{heading ?? m.visit_tickets()}</legend>
			<ul class="types">
				{#each $form.items as item, i (item.ticketTypeId)}
					{@const t = typeOf(item.ticketTypeId)}
					{#if t}
						<li class="type">
							<div class="what">
								<span class="mid">{tr(t.name, locale)}</span>
								<span class="price">{t.price > 0 ? money(t.price) : m.visit_free()}</span>
								{#if t.description}<span class="small">{tr(t.description, locale)}</span>{/if}
								{#if t.requiresProof}<span class="small">
										{m.visit_proof({ proof: tr(t.requiresProof, locale) })}
									</span>{/if}
							</div>
							<div class="count">
								<button
									type="button"
									aria-label={m.visit_qty_less({ name: tr(t.name, locale) })}
									disabled={item.quantity === 0}
									onclick={() => step(i, -1)}
								>
									−
								</button>
								<output aria-live="polite">{item.quantity}</output>
								<button
									type="button"
									aria-label={m.visit_qty_more({ name: tr(t.name, locale) })}
									disabled={item.quantity >= Math.min(t.maxQuantity ?? 50, 50)}
									onclick={() => step(i, 1)}
								>
									+
								</button>
							</div>
						</li>
					{/if}
				{/each}
			</ul>
			{#if $errors.items?._errors}<p class="error" role="alert">{$errors.items._errors[0]}</p>{/if}
		</fieldset>

		<fieldset>
			<legend>{m.visit_details()}</legend>
			<div class="fields two">
				<Field
					label={m.visit_name()}
					name="name"
					bind:value={$form.name}
					errors={$errors.name}
					required
					autocomplete="name"
					wide
				/>
				<Field
					label={m.visit_phone()}
					name="phone"
					type="tel"
					bind:value={$form.phone}
					errors={$errors.phone}
					hint={m.visit_phone_hint()}
					required
					autocomplete="tel"
				/>
				<Field
					label={m.visit_email()}
					name="email"
					type="email"
					bind:value={$form.email}
					errors={$errors.email}
					hint={m.visit_email_hint()}
					autocomplete="email"
				/>
			</div>
			{#if declaration}
				<label class="check">
					<Checkbox bind:checked={$form.declared} />
					<span>{tr(declaration, locale)}</span>
				</label>
				{#if $errors.declared}<p class="error" role="alert">{$errors.declared[0]}</p>{/if}
			{/if}
			<label class="check">
				<Checkbox bind:checked={$form.marketingConsent} />
				<span>{m.visit_consent()}</span>
			</label>
			<Trap bind:value={$form.website} />
		</fieldset>

		{#if total > 0}
			<PayWith bind:value={$form.payWith} {paymentsOn} {transfersOn} />
		{/if}
	</div>

	<aside class="aside card summary">
		<h2 class="section-title">{m.visit_summary()}</h2>
		{#if count}
			<ul class="lines">
				{#each $form.items.filter((x) => x.quantity > 0) as item (item.ticketTypeId)}
					{@const t = typeOf(item.ticketTypeId)}
					<li>
						<span>{item.quantity} × {t ? tr(t.name, locale) : ''}</span>
						<span class="num">{money(item.quantity * (t?.price ?? 0))}</span>
					</li>
				{/each}
				{#if discount > 0 && rule}
					<li>
						<span>{m.site_discount_line({ code: rule.code })}</span>
						<span class="num">−{money(discount)}</span>
					</li>
				{/if}
				<li class="total"><span>{m.visit_total()}</span><span class="num">{money(total)}</span></li>
			</ul>
		{:else}
			<p class="muted">{m.visit_nothing()}</p>
		{/if}
		{#if gross > 0}
			<DiscountCode
				bind:value={$form.discountCode}
				bind:rule
				lines={[{ itemType, gross }]}
				errors={$errors.discountCode}
			/>
		{/if}
		{#if $message}<p class="notice bad" role="alert">{$message}</p>{/if}
		<button class="btn" disabled={$delayed || count === 0}>
			{total === 0 ? m.visit_get_free() : online ? m.visit_pay() : m.site_pay_place()}
		</button>
		{#if total > 0}
			<p class="hint">
				{online
					? m.visit_pay_note()
					: transfersOn
						? m.site_pay_transfer_next()
						: m.visit_pay_later()}
			</p>
		{/if}
	</aside>
</form>

<style>
	.types {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.type {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 0;
		border-bottom: 1px solid var(--line);
	}
	.what {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.what .mid {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 600;
		line-height: 1.15;
	}
	.what .price {
		font-family: var(--font-display);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.what .small {
		color: var(--ink-soft);
		font-size: 14px;
		line-height: 1.35;
	}
	.count {
		flex: none;
	}
	.summary {
		display: grid;
		gap: 16px;
	}
	.summary .section-title {
		margin-bottom: 0;
	}
	.summary .hint {
		margin: 0;
	}
</style>
