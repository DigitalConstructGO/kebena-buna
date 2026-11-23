<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { money, pct, tr } from '#lib/format.ts';
	import Field from '#lib/site/Field.svelte';
	import Trap from '#lib/site/Trap.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message } = superForm(data.form, { dataType: 'form' });

	const locale = $derived(getLocale());
	const plan = $derived(data.plans.find((p) => p.id === Number($form.planId)));
	/** The buyer is the first adult; the rest of the plan's room is named here. */
	const otherAdults = $derived(Math.max((plan?.maxAdults ?? 1) - 1, 0));
	const children = $derived(plan?.maxChildren ?? 0);

	const lines = (text: string) => text.split(/\n+/).map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
	const covers = (p: (typeof data.plans)[number]) =>
		p.maxChildren
			? m.member_covers_family({ adults: p.maxAdults, children: p.maxChildren })
			: m.member_covers_one({ adults: p.maxAdults });
</script>

<svelte:head>
	<title>{m.member_title()} · Kebena</title>
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
					<legend>{m.member_step_plan()}</legend>
					<div class="plans">
						{#each data.plans as p (p.id)}
							<label class="opt plan">
								<input type="radio" name="planId" value={p.id} bind:group={$form.planId} />
								<span class="mid">{tr(p.name, locale)}</span>
								<span class="big">{money(p.price)}</span>
								<span class="small">{m.member_term({ months: p.durationMonths })} · {covers(p)}</span>
								{#if tr(p.description ?? '', locale)}<span class="small">{tr(p.description ?? '', locale)}</span>{/if}
								<!-- The plan's own wording when staff wrote one; otherwise what its settings give. -->
								<ul class="perks">
									{#if lines(tr(p.benefits ?? '', locale)).length}
										{#each lines(tr(p.benefits ?? '', locale)) as perk (perk)}<li>{perk}</li>{/each}
									{:else}
										{#if p.freeEntry}<li>{m.member_perk_entry()}</li>{/if}
										{#if p.shopDiscountPct > 0}<li>{m.member_perk_discount({ pct: pct(p.shopDiscountPct) })}</li>{/if}
										{#if p.freeDelivery}<li>{m.member_perk_delivery()}</li>{/if}
										{#if p.membersOnlyEvents}<li>{m.member_perk_events()}</li>{/if}
									{/if}
								</ul>
								{#if tr(p.requiresProof ?? '', locale)}
									<span class="small proof">{m.member_proof({ proof: tr(p.requiresProof ?? '', locale) })}</span>
								{/if}
							</label>
						{/each}
					</div>
					{#if $errors.planId}<p class="error">{$errors.planId[0]}</p>{/if}
				</fieldset>

				<fieldset>
					<legend>{m.member_step_you()}</legend>
					<div class="fields two">
						<Field label={m.member_name()} name="name" bind:value={$form.name} errors={$errors.name} required autocomplete="name" />
						<Field label={m.member_phone()} name="phone" type="tel" bind:value={$form.phone} errors={$errors.phone} required autocomplete="tel" hint={m.member_phone_hint()} />
						<Field label={m.member_email()} name="email" type="email" bind:value={$form.email} errors={$errors.email} autocomplete="email" wide />
					</div>
				</fieldset>

				{#if otherAdults || children}
					<fieldset>
						<legend>{m.member_step_people()}</legend>
						<p class="hint">{m.member_people_hint()}</p>
						<div class="fields two">
							{#each Array.from({ length: otherAdults }, (_, i) => i) as i (i)}
								<Field label={m.member_adult({ n: i + 2 })} name="adults" bind:value={$form.adults[i]} autocomplete="off" />
							{/each}
							{#each Array.from({ length: children }, (_, i) => i) as i (i)}
								<Field label={m.member_child({ n: i + 1 })} name="children" bind:value={$form.children[i]} autocomplete="off" />
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

				<label class="check">
					<input type="checkbox" name="marketingConsent" bind:checked={$form.marketingConsent} />
					<span>{m.member_consent()}</span>
				</label>
			</div>

			<aside class="aside card summary">
				<p class="label">{m.member_summary()}</p>
				{#if plan}
					<h2 class="section-title">{tr(plan.name, locale)}</h2>
					<ul class="lines">
						<li><span>{m.member_term({ months: plan.durationMonths })}</span><span class="num">{money(plan.price)}</span></li>
						<li class="total"><span>{m.site_total()}</span><span class="num">{money(plan.price)}</span></li>
					</ul>
				{/if}
				<p class="hint">{m.member_pay_note()}</p>
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
	.plans {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
	}
	.plan {
		gap: 8px;
		padding: 18px;
	}
	.perks {
		display: grid;
		gap: 4px;
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
		font-size: 14px;
	}
	.perks li::before {
		content: '✓ ';
		color: var(--accent-ink);
		font-weight: 700;
	}
	.proof {
		font-style: italic;
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
