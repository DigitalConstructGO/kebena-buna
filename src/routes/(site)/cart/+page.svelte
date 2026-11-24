<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import SelectComp from '@nahu/admin-kit/formComponents/SelectComp.svelte';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { money, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';

	let { data, form } = $props();

	const locale = $derived(getLocale());
	const anyShort = $derived(data.lines.some((l) => l.short) || data.bundles.some((b) => b.short));

	const uid = $props.id();
	const counts = (quantity: number, max = 10) =>
		Array.from({ length: Math.max(max, quantity) }, (_, i) => ({
			value: String(i + 1),
			name: String(i + 1)
		}));
	/**
	 * Re-sends a line's count as soon as it changes; the page reloads the priced cart. The select's
	 * own button belongs to the line's form; the post waits a tick for its hidden input to update.
	 */
	const submitCount = (id: string) => () =>
		tick().then(() =>
			(document.getElementById(id) as HTMLButtonElement | null)?.form?.requestSubmit()
		);
</script>

<svelte:head><title>{m.site_page_title({ title: m.cart_title() })}</title></svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.cart_label()}</p>
		<h1 class="title">{m.cart_title()}</h1>
	</header>

	{#if !data.lines.length && !data.bundles.length}
		<div class="section card empty">
			<p class="lede">{m.cart_empty()}</p>
			<a class="btn" href={siteHref('/shop', locale)}>{m.cart_browse()}</a>
		</div>
	{:else}
		<div class="section split">
			<div class="form">
				{#if data.changed}<p class="notice" role="status">{m.cart_changed()}</p>{/if}
				{#if form?.error}<p class="notice bad" role="alert">{form.error}</p>{/if}
				<ul class="items">
					{#each data.lines as l, i (l.key)}
						<li class="item card">
							<a
								class="pic"
								href={siteHref(`/shop/${l.slug}`, locale)}
								tabindex="-1"
								aria-hidden="true"
							>
								<img src={l.image} alt="" width="96" height="96" loading="lazy" />
							</a>
							<div class="what">
								<a class="name" href={siteHref(`/shop/${l.slug}`, locale)}>{tr(l.name, locale)}</a>
								<p class="muted">
									{[l.size, l.roast, l.grind, l.packaging]
										.filter(Boolean)
										.map((x) => tr(x ?? '', locale))
										.join(' · ')}
								</p>
								<p class="muted num">{m.shop_each({ price: money(l.unitPrice) })}</p>
								{#if l.short}
									<p class="error">
										{l.available && l.available > 0
											? m.shop_only_left({ count: l.available })
											: m.shop_sold_out()}
									</p>
								{/if}
							</div>
							<div class="how">
								<form method="POST" action="?/update" use:enhance>
									<input type="hidden" name="key" value={l.key} />
									<label class="qty" for="{uid}-{i}">
										<span class="visually-hidden">{m.shop_quantity()}</span>
										<SelectComp
											id="{uid}-{i}"
											name="quantity"
											value={String(l.quantity)}
											items={counts(l.quantity)}
											label={m.shop_quantity()}
											onValueChange={submitCount(`${uid}-${i}`)}
										/>
									</label>
								</form>
								<p class="price num">{money(l.lineTotal)}</p>
								<form method="POST" action="?/remove" use:enhance>
									<input type="hidden" name="key" value={l.key} />
									<button class="remove">{m.cart_remove()}</button>
								</form>
							</div>
						</li>
					{/each}
					{#each data.bundles as b, i (b.key)}
						<li class="item card">
							<a
								class="pic"
								href={siteHref(`/shop/bundle/${b.slug}`, locale)}
								tabindex="-1"
								aria-hidden="true"
							>
								<img src={b.image} alt="" width="96" height="96" loading="lazy" />
							</a>
							<div class="what">
								<p class="label">{m.bundle_label()}</p>
								<a class="name" href={siteHref(`/shop/bundle/${b.slug}`, locale)}>
									{tr(b.name, locale)}
								</a>
								<ul class="bags">
									{#each b.bags as bag, j (j)}
										<li class="muted">
											{bag.quantity} × {[bag.name, bag.size, bag.roast, bag.grind]
												.filter(Boolean)
												.map((x) => tr(x ?? '', locale))
												.join(' · ')}
										</li>
									{/each}
								</ul>
								<p class="muted num">
									{m.shop_each({ price: money(b.price) })}{#if b.saving > 0}
										· {m.bundle_save({ amount: money(b.saving) })}{/if}
								</p>
								{#if b.short}<p class="error">{m.shop_sold_out()}</p>{/if}
							</div>
							<div class="how">
								<form method="POST" action="?/updateBundle" use:enhance>
									<input type="hidden" name="key" value={b.key} />
									<label class="qty" for="{uid}-b{i}">
										<span class="visually-hidden">{m.shop_quantity()}</span>
										<SelectComp
											id="{uid}-b{i}"
											name="quantity"
											value={String(b.quantity)}
											items={counts(b.quantity, b.max)}
											label={m.shop_quantity()}
											onValueChange={submitCount(`${uid}-b${i}`)}
										/>
									</label>
								</form>
								<p class="price num">{money(b.total)}</p>
								<form method="POST" action="?/removeBundle" use:enhance>
									<input type="hidden" name="key" value={b.key} />
									<button class="remove">{m.cart_remove()}</button>
								</form>
							</div>
						</li>
					{/each}
				</ul>
				<a class="link" href={siteHref('/shop', locale)}>← {m.cart_continue()}</a>
			</div>

			<aside class="aside card">
				<h2 class="section-title">{m.track_summary()}</h2>
				<ul class="lines">
					<li class="total">
						<span>{m.cart_subtotal()}</span><span class="num">{money(data.subtotal)}</span>
					</li>
				</ul>
				<p class="hint">{m.cart_delivery_later()}</p>
				{#if anyShort}
					<p class="error">{m.cart_fix_short()}</p>
				{:else}
					<a class="btn wide" href={siteHref('/checkout', locale)}>{m.cart_checkout()}</a>
				{/if}
			</aside>
		</div>
	{/if}
</div>

<style>
	.empty {
		display: grid;
		gap: 18px;
		justify-items: start;
	}
	.items {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.item {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr);
		gap: 16px;
		align-items: start;
		padding: 14px;
	}
	@media (width >= 560px) {
		.item {
			grid-template-columns: 96px minmax(0, 1fr) auto;
		}
	}
	.pic img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 12px;
	}
	.what {
		display: grid;
		gap: 4px;
	}
	.what p {
		margin: 0;
		font-size: 14px;
	}
	.name {
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 700;
		text-decoration: none;
	}
	.bags {
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 14px;
	}
	.how {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		grid-column: 2;
	}
	@media (width >= 560px) {
		.how {
			grid-column: auto;
			flex-direction: column;
			align-items: flex-end;
		}
	}
	.how p {
		margin: 0;
	}
	.qty :global([data-slot='select-trigger']) {
		width: auto;
		min-width: 72px;
		height: auto;
		min-height: 40px;
		padding: 6px 10px;
		border: 1px solid var(--hair);
		border-radius: 10px;
		background: var(--card-solid);
		color: var(--ink);
		font: inherit;
	}
	.remove {
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink-soft);
		font: inherit;
		font-size: 13px;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.wide {
		width: 100%;
		margin-top: 8px;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
