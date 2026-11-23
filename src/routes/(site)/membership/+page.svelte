<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { money, pct, tr } from '#lib/format.ts';
	import Field from '#lib/site/Field.svelte';
	import Trap from '#lib/site/Trap.svelte';
	import PayWith from '#lib/site/PayWith.svelte';
	import DiscountCode from '#lib/site/DiscountCode.svelte';
	import { discountOff, type DiscountRule } from '#lib/discounts.ts';
	import ImageSelect from '@nahu/admin-kit/formComponents/ImageSelect.svelte';
	import { Checkbox } from '@nahu/admin-kit/components/ui/checkbox/index.js';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message } = superForm(data.form, { dataType: 'form' });

	const locale = $derived(getLocale());
	const plan = $derived(data.plans.find((p) => p.id === Number($form.planId)));
	let rule = $state<(DiscountRule & { code: string }) | null>(null);
	const codeLines = $derived(plan ? [{ itemType: 'membership', gross: plan.price }] : []);
	const discount = $derived(discountOff(rule, codeLines));
	/** The buyer is the first adult; the rest of the plan's room is named here. */
	const otherAdults = $derived(Math.max((plan?.maxAdults ?? 1) - 1, 0));
	const children = $derived(plan?.maxChildren ?? 0);

	const lines = (text: string) =>
		text
			.split(/\n+/)
			.map((l) => l.replace(/^[-•*]\s*/, '').trim())
			.filter(Boolean);
	const covers = (p: (typeof data.plans)[number]) =>
		p.maxChildren
			? m.member_covers_family({ adults: p.maxAdults, children: p.maxChildren })
			: m.member_covers_one({ adults: p.maxAdults });
	/** The plan's own wording when staff wrote one; otherwise what its settings give. */
	const perks = (p: (typeof data.plans)[number]) => {
		const written = lines(tr(p.benefits ?? '', locale));
		if (written.length) return written;
		return [
			p.freeEntry && m.member_perk_entry(),
			p.shopDiscountPct > 0 && m.member_perk_discount({ pct: pct(p.shopDiscountPct) }),
			p.freeDelivery && m.member_perk_delivery(),
			p.membersOnlyEvents && m.member_perk_events()
		].filter(Boolean) as string[];
	};
	/** Everything a plan's card says under its name, as the lines of one description. */
	const planText = (p: (typeof data.plans)[number]) =>
		[
			`${m.member_term({ months: p.durationMonths })} · ${covers(p)}`,
			tr(p.description ?? '', locale),
			...perks(p).map((perk) => `✓ ${perk}`),
			tr(p.requiresProof ?? '', locale) &&
				m.member_proof({ proof: tr(p.requiresProof ?? '', locale) })
		]
			.filter(Boolean)
			.join('\n');
</script>

<svelte:head>
	<title>{m.site_page_title({ title: m.member_title() })}</title>
	<meta name="description" content={m.member_lede()} />
</svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.member_label()}</p>
		<h1 class="title">{m.member_title()}</h1>
		<p class="lede">{m.member_lede()}</p>
	</header>

	{#if !data.plans.length}
		<p class="section notice">{m.member_none()}</p>
	{:else}
		<form method="POST" class="section split" use:enhance>
			<div class="form">
				<Trap />
				<input type="hidden" name="idempotencyKey" value={$form.idempotencyKey} />

				<fieldset>
					<legend id="plan-legend">{m.member_step_plan()}</legend>
					<div class="plans">
						<ImageSelect
							name="planId"
							bind:value={$form.planId}
							items={data.plans.map((p) => ({
								value: p.id,
								name: tr(p.name, locale),
								meta: money(p.price),
								description: planText(p)
							}))}
							labelledBy="plan-legend"
							invalid={Boolean($errors.planId)}
						/>
					</div>
					{#if $errors.planId}<p class="error">{$errors.planId[0]}</p>{/if}
				</fieldset>

				<fieldset>
					<legend>{m.member_step_you()}</legend>
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
							hint={m.member_phone_hint()}
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

				{#if otherAdults || children}
					<fieldset>
						<legend>{m.member_step_people()}</legend>
						<p class="hint">{m.member_people_hint()}</p>
						<div class="fields two">
							{#each Array.from({ length: otherAdults }, (_, i) => i) as i (i)}
								<Field
									label={m.member_adult({ n: i + 2 })}
									name="adults"
									bind:value={$form.adults[i]}
									autocomplete="off"
								/>
							{/each}
							{#each Array.from({ length: children }, (_, i) => i) as i (i)}
								<Field
									label={m.member_child({ n: i + 1 })}
									name="children"
									bind:value={$form.children[i]}
									autocomplete="off"
								/>
							{/each}
						</div>
						{#if $errors.adults?._errors}<p class="error">{$errors.adults._errors[0]}</p>{/if}
						{#if $errors.children?._errors}<p class="error">{$errors.children._errors[0]}</p>{/if}
					</fieldset>
				{/if}

				<fieldset>
					<legend>{m.member_step_start()}</legend>
					<div class="fields two">
						<Field
							label={m.member_start()}
							name="startsOn"
							type="date"
							bind:value={$form.startsOn}
							errors={$errors.startsOn}
							min={data.today}
							max={data.latestStart}
							required
							hint={m.member_start_hint()}
						/>
					</div>
				</fieldset>

				<PayWith
					bind:value={$form.payWith}
					paymentsOn={data.paymentsOn}
					transfersOn={data.transfersOn}
				/>

				<label class="check">
					<Checkbox name="marketingConsent" bind:checked={$form.marketingConsent} />
					<span>{m.member_consent()}</span>
				</label>
			</div>

			<aside class="aside card summary">
				<p class="label">{m.member_summary()}</p>
				{#if plan}
					<h2 class="section-title">{tr(plan.name, locale)}</h2>
					<ul class="lines">
						<li>
							<span>{m.member_term({ months: plan.durationMonths })}</span><span class="num">
								{money(plan.price)}
							</span>
						</li>
						{#if discount > 0 && rule}
							<li>
								<span>{m.site_discount_line({ code: rule.code })}</span>
								<span class="num">−{money(discount)}</span>
							</li>
						{/if}
						<li class="total">
							<span>{m.site_total()}</span><span class="num">{money(plan.price - discount)}</span>
						</li>
					</ul>
				{/if}
				<p class="hint">
					{(!data.paymentsOn || $form.payWith === 'transfer') && data.transfersOn
						? m.site_pay_transfer_next()
						: m.member_pay_note()}
				</p>
				{#if plan}
					<DiscountCode
						bind:value={$form.discountCode}
						bind:rule
						lines={codeLines}
						errors={$errors.discountCode}
					/>
				{/if}
				{#if $message}<p class="notice" role="status">{$message}</p>{/if}
				<button class="btn" disabled={$delayed || !plan}>{m.member_submit()}</button>
			</aside>
		</form>
	{/if}
</div>

<style>
	/* A neighbour's hint must not stretch this field's input (grid rows stretch by default). */
	.form :global(.field) {
		align-content: start;
	}
	/* A plan's description is several lines: its term, its wording, its perks. */
	.plans :global([role='radiogroup']) {
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
	}
	.plans :global([role='radiogroup'] .text-xs) {
		white-space: pre-line;
		font-size: 14px;
		line-height: 1.45;
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
