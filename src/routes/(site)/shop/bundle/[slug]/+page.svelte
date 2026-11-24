<script lang="ts">
	import { enhance } from '$app/forms';
	import SelectComp from '@nahu/admin-kit/formComponents/SelectComp.svelte';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { money, tr } from '#lib/format.ts';
	import { bundlePrice } from '#lib/bundles.ts';
	import { siteHref } from '#lib/site/locale.ts';

	let { data, form } = $props();

	const locale = $derived(getLocale());
	const b = $derived(data.bundle);
	const uid = $props.id();

	type Item = (typeof data.items)[number];
	/** The coffee picked for each place in a choice, `<item>-<n>`; untouched, its cheapest. */
	let chosen = $state<Record<string, string>>({});
	const places = (i: Item) => Array.from({ length: i.quantity }, (_, n) => n);
	const pickOf = (i: Item, n: number) =>
		chosen[`${i.id}-${n}`] ?? String(i.choices[0]?.variantId ?? '');
	let roastLevelId = $state('');
	let grindId = $state('');
	let quantity = $state(1);
	let adding = $state(false);

	/** What the bags picked cost alone, and what the bundle charges for them. */
	const list = $derived(
		data.items.reduce((sum, i) => {
			if (i.kind === 'exact') return sum + i.quantity * (i.price ?? 0);
			return (
				sum +
				places(i).reduce(
					(s, n) => s + (i.choices.find((c) => String(c.variantId) === pickOf(i, n))?.price ?? 0),
					0
				)
			);
		}, 0)
	);
	const priced = $derived(bundlePrice(b.rule, list));

	const itemName = (i: Item) => {
		const size = tr(i.size ?? '', locale);
		if (i.kind === 'exact') return `${tr(i.product ?? '', locale)} — ${size}`;
		return i.category
			? m.bundle_any_in({ size, category: tr(i.category, locale) })
			: m.bundle_any({ size });
	};
	const usual = $derived({ value: '', name: m.bundle_usual() });
</script>

<svelte:head>
	<title>{m.site_page_title({ title: tr(b.name, locale) })}</title>
	{#if b.summary && tr(b.summary, locale)}
		<meta name="description" content={tr(b.summary, locale)} />
	{/if}
</svelte:head>

<div class="page">
	<div class="wrap">
		<a class="back label" href={siteHref('/shop', locale)}>← {m.shop_back()}</a>
	</div>

	<div class="section split detail">
		<div class="gallery">
			<img class="main" src={b.image} alt={tr(b.name, locale)} width="900" height="900" />
		</div>

		<div class="buy">
			<header class="intro">
				<p class="label">{m.bundle_label()}</p>
				<h1 class="name">{tr(b.name, locale)}</h1>
				{#if b.summary && tr(b.summary, locale)}<p class="lede">{tr(b.summary, locale)}</p>{/if}
			</header>

			<section>
				<h2 class="section-title">{m.bundle_contains()}</h2>
				<ul class="contents">
					{#each data.items as i (i.id)}
						<li>
							<span>{i.quantity} × {itemName(i)}</span>
							{#if i.kind === 'exact' && i.price !== null}
								<span class="muted num">{money(i.price * i.quantity)}</span>
							{/if}
						</li>
					{/each}
				</ul>
			</section>

			<form
				method="POST"
				action="?/add"
				class="form"
				use:enhance={() => {
					adding = true;
					return async ({ update }) => {
						await update({ reset: false });
						adding = false;
					};
				}}
			>
				{#if data.items.some((i) => i.kind === 'choice')}
					<fieldset>
						<legend>{m.bundle_choose()}</legend>
						{#each data.items.filter((i) => i.kind === 'choice') as i (i.id)}
							{#each places(i) as n (n)}
								<label class="pick" for="{uid}-{i.id}-{n}">
									<span>{itemName(i)} · {m.bundle_pick({ n: n + 1 })}</span>
									<SelectComp
										id="{uid}-{i.id}-{n}"
										name="pick-{i.id}"
										bind:value={() => pickOf(i, n), (v) => (chosen[`${i.id}-${n}`] = v)}
										label={m.bundle_pick({ n: n + 1 })}
										items={i.choices.map((c) => ({
											value: String(c.variantId),
											name: `${tr(c.name, locale)} · ${money(c.price)}`
										}))}
									/>
								</label>
							{/each}
						{/each}
					</fieldset>
				{/if}

				{#if data.roasts.length}
					<label class="pick" for="{uid}-roast">
						<span>{m.shop_roast()}</span>
						<SelectComp
							id="{uid}-roast"
							name="roastLevelId"
							bind:value={roastLevelId}
							label={m.shop_roast()}
							items={[
								usual,
								...data.roasts.map((r) => ({ value: String(r.id), name: tr(r.name, locale) }))
							]}
						/>
					</label>
				{/if}
				{#if data.grinds.length}
					<label class="pick" for="{uid}-grind">
						<span>{m.shop_grind()}</span>
						<SelectComp
							id="{uid}-grind"
							name="grindId"
							bind:value={grindId}
							label={m.shop_grind()}
							items={[
								usual,
								...data.grinds.map((g) => ({ value: String(g.id), name: tr(g.name, locale) }))
							]}
						/>
					</label>
				{/if}
				<p class="hint">{m.bundle_options_hint()}</p>

				<fieldset>
					<legend>{m.shop_quantity()}</legend>
					<div class="count">
						<button
							type="button"
							aria-label={m.shop_fewer()}
							disabled={quantity <= 1}
							onclick={() => quantity--}
						>
							−
						</button>
						<output aria-live="polite">{quantity}</output>
						<button
							type="button"
							aria-label={m.shop_more()}
							disabled={quantity >= b.max}
							onclick={() => quantity++}
						>
							+
						</button>
					</div>
					<input type="hidden" name="quantity" value={quantity} />
					{#if b.max < 10}<p class="hint">{m.bundle_max({ count: b.max })}</p>{/if}
				</fieldset>

				<div class="send">
					<p class="sum">
						<span class="price num">{money(priced.price * quantity)}</span>
						{#if priced.saving > 0}
							<span class="muted">
								· <s>{m.bundle_alone({ price: money(list * quantity) })}</s> ·
								{m.bundle_save({ amount: money(priced.saving * quantity) })}
							</span>
						{/if}
					</p>
					{#if !b.stacks}<p class="hint">{m.bundle_no_codes()}</p>{/if}
					<button class="btn" disabled={adding}>{m.bundle_add()}</button>
					{#if form?.error}<p class="notice bad" role="alert">{form.error}</p>{/if}
				</div>
			</form>
		</div>
	</div>
</div>

<style>
	.back {
		display: inline-flex;
		min-height: 44px;
		align-items: center;
		color: var(--ink);
		text-decoration: none;
	}
	.detail {
		margin-top: 16px;
	}
	@media (width >= 860px) {
		.detail {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
		.gallery {
			position: sticky;
			top: 104px;
		}
	}
	.main {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border: 1px solid var(--hair);
		border-radius: 24px;
		background: var(--well);
	}
	.buy {
		display: grid;
		gap: 28px;
		align-content: start;
	}
	.intro {
		display: grid;
		gap: 12px;
	}
	.name {
		font-size: clamp(2.2rem, 5vw, 3.6rem);
		font-weight: 800;
		line-height: 0.98;
		text-transform: uppercase;
	}
	.intro .lede {
		max-width: none;
	}
	.contents {
		display: grid;
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
	}
	.contents li {
		display: flex;
		gap: 12px;
		justify-content: space-between;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
	}
	.pick {
		display: grid;
		gap: 6px;
		margin-bottom: 12px;
		font-size: 14px;
	}
	.pick :global([data-slot='select-trigger']) {
		width: 100%;
		height: auto;
		min-height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--hair);
		border-radius: 10px;
		background: var(--card-solid);
		color: var(--ink);
		font: inherit;
	}
	.send {
		display: grid;
		gap: 14px;
		padding-top: 24px;
		border-top: 1px solid var(--hair);
	}
	.sum {
		margin: 0;
		font-size: 1.05rem;
	}
	.sum .price {
		font-size: 1.8rem;
	}
	.hint {
		margin: 0;
	}
</style>
