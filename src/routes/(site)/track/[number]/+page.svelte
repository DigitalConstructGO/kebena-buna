<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { superForm } from 'sveltekit-superforms';
	import FileUpload from '@nahu/admin-kit/formComponents/FileUpload.svelte';
	import ImageSelect from '@nahu/admin-kit/formComponents/ImageSelect.svelte';
	import Field from '#lib/site/Field.svelte';
	import { siteHref } from '#lib/site/locale.ts';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { formatDate, formatDateTime, money, tr } from '#lib/format.ts';

	let { data, form } = $props();

	const locale = $derived(getLocale());
	const o = $derived(data.order);

	const STATUS: Record<string, () => string> = {
		pending_payment: m.track_status_pending_payment,
		paid: m.track_status_paid,
		roasting: m.track_status_roasting,
		packed: m.track_status_packed,
		out_for_delivery: m.track_status_out_for_delivery,
		delivered: m.track_status_delivered,
		ready_for_pickup: m.track_status_ready_for_pickup,
		collected: m.track_status_collected,
		completed: m.track_status_completed,
		cancelled: m.track_status_cancelled
	};
	const statusName = (s: string) => STATUS[s]?.() ?? s;

	let paying = $state(false);

	// svelte-ignore state_referenced_locally
	const {
		form: tForm,
		errors: tErrors,
		enhance: tEnhance,
		delayed: tDelayed,
		message: tMessage
	} = superForm(data.transferForm, { resetForm: true });

	/** The order's link carries its secret; every action posted from here needs it too. */
	const k = $derived(encodeURIComponent(page.url.searchParams.get('k') ?? ''));
	const owed = $derived(money(o.total - o.amountPaid));

	let copied = $state<number | null>(null);
	async function copy(id: number, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = id;
			setTimeout(() => (copied = copied === id ? null : copied), 2000);
		} catch {
			// No clipboard (an old browser, a page not served over https): the number is on screen.
		}
	}
</script>

<svelte:head>
	<title>{m.site_page_title({ title: m.track_title({ number: o.number }) })}</title>
</svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.track_label()}</p>
		<h1 class="title">{o.number}</h1>
		<p class="lede">{m.track_lede({ name: o.contactName ?? '' })}</p>
	</header>

	<div class="section split">
		<div class="form">
			{#if data.outcome === 'paid'}
				<p class="notice ok" role="status">{m.track_paid_now()}</p>
			{:else if data.outcome === 'failed'}
				<p class="notice bad" role="alert">{m.track_pay_declined()}</p>
			{:else if data.outcome === 'pending'}
				<p class="notice" role="status">{m.track_pay_pending()}</p>
			{/if}

			<section class="card status">
				<p class="label">{m.track_status_label()}</p>
				<p class="big">{statusName(o.status)}</p>
				<p class="muted">{m.track_placed({ when: formatDateTime(o.placedAt) })}</p>
				{#if o.receiptNumber}<p class="muted">
						{m.track_receipt({ number: o.receiptNumber })}
					</p>{/if}
				{#if o.pickupCode}<p>
						{m.track_pickup_code()} <strong class="num">{o.pickupCode}</strong>
					</p>{/if}
			</section>

			{#if o.status === 'pending_payment'}
				<section class="card" id="pay">
					<h2 class="section-title">{m.track_pay_title()}</h2>
					{#if data.transfer?.status === 'pending'}
						<p class="notice ok" role="status">
							{m.track_transfer_waiting({
								amount: money(data.transfer.amount),
								when: formatDateTime(data.transfer.createdAt)
							})}
						</p>
					{:else}
						{#if data.transfer?.status === 'failed'}
							<p class="notice bad" role="alert">
								{m.track_transfer_rejected({ reason: data.transfer.failureReason ?? '' })}
							</p>
						{/if}
						{#if data.canPay}
							{#if data.accounts.length}<h3 class="sub">{m.track_pay_online_title()}</h3>{/if}
							<p class="muted">{m.track_pay_lede({ amount: owed })}</p>
							<form
								method="POST"
								action="?/pay&k={k}"
								use:enhance={() => {
									paying = true;
									return async ({ update }) => {
										await update();
										paying = false;
									};
								}}
							>
								<button class="btn" disabled={paying}>{m.track_pay_button()}</button>
							</form>
							{#if form?.payError}<p class="error" role="alert">{form.payError}</p>{/if}
						{:else if !data.accounts.length}
							<p class="muted">{m.track_pay_offline()}</p>
							<p><a class="link" href="tel:+251912605824">+251 912 605 824</a></p>
						{/if}

						{#if data.accounts.length}
							<div class="transfer" id="transfer">
								<h3 class="sub">{m.track_transfer_title()}</h3>
								<p class="muted">{m.track_transfer_lede({ amount: owed, number: o.number })}</p>
								<ul class="accounts">
									{#each data.accounts as a (a.id)}
										<li class="account">
											<p class="label">{a.bankName}</p>
											<p>{m.track_transfer_account_name()}: <strong>{a.accountName}</strong></p>
											<p class="number">
												<span class="muted">{m.track_transfer_account_number()}:</span>
												<strong class="num">{a.accountNumber}</strong>
												<button
													type="button"
													class="link"
													onclick={() => copy(a.id, a.accountNumber)}
												>
													{copied === a.id ? m.track_transfer_copied() : m.track_transfer_copy()}
												</button>
											</p>
											{#if a.note}<p class="muted">{a.note}</p>{/if}
										</li>
									{/each}
								</ul>

								<form
									method="POST"
									action="?/transfer&k={k}"
									enctype="multipart/form-data"
									class="receipt"
									use:tEnhance
									novalidate
								>
									{#if data.accounts.length > 1}
										<div class="field" data-invalid={$tErrors.bankAccountId ? '' : undefined}>
											<span id="paid-into">{m.track_transfer_paid_into()} *</span>
											<ImageSelect
												name="bankAccountId"
												bind:value={$tForm.bankAccountId}
												items={data.accounts.map((a) => ({
													value: a.id,
													name: a.bankName,
													description: a.accountNumber
												}))}
												labelledBy="paid-into"
												required
											/>
											{#if $tErrors.bankAccountId}<p class="error" role="alert">
													{$tErrors.bankAccountId[0]}
												</p>{/if}
										</div>
									{:else}
										<input type="hidden" name="bankAccountId" value={$tForm.bankAccountId} />
									{/if}
									<Field
										label={m.track_transfer_reference()}
										name="reference"
										bind:value={$tForm.reference}
										errors={$tErrors.reference}
										hint={m.track_transfer_reference_hint()}
									/>
									<!-- The kit's drop zone is the file input's own label, so this one names the field only. -->
									<div class="field" data-invalid={$tErrors.receipt ? '' : undefined}>
										<span>{m.track_transfer_receipt()} *</span>
										<FileUpload
											form={tForm}
											name="receipt"
											accept=".pdf,image/*"
											removable={false}
											placeholder={m.track_transfer_receipt_hint()}
										/>
										{#if $tErrors.receipt}<p class="error" role="alert">
												{$tErrors.receipt[0]}
											</p>{/if}
									</div>
									{#if $tMessage && $tMessage !== 'ok'}<p class="notice bad" role="alert">
											{$tMessage}
										</p>{/if}
									<button class="btn" disabled={$tDelayed}>{m.track_transfer_submit()}</button>
								</form>
							</div>
						{/if}
					{/if}
				</section>
			{/if}

			{#if data.tickets.length}
				<section>
					<h2 class="section-title">{m.track_tickets()}</h2>
					<ul class="cards tickets">
						{#each data.tickets as t (t.code)}
							<li class="card ticket">
								<p class="label">{tr(t.type, locale)}</p>
								{#if t.qr}
									<!-- Our own SVG, made by `qrcode` from the ticket's signed string. -->
									<div class="qr" role="img" aria-label={m.track_qr_label({ code: t.code })}>
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html t.qr}
									</div>
								{/if}
								<p class="code num">{t.code}</p>
								<p>
									{formatDate(t.visitDate)}{t.startsAt
										? ` · ${formatDateTime(t.startsAt).slice(-5)}`
										: ''}
								</p>
								{#if t.admits > 1}<p class="muted">{m.track_admits({ count: t.admits })}</p>{/if}
							</li>
						{/each}
					</ul>
					<p class="hint">{m.track_tickets_hint()}</p>
				</section>
			{/if}

			{#if data.more === 'coffee' && data.coffees.length}
				<section class="more">
					<p class="label">{m.track_more_title()}</p>
					<h2 class="section-title">{m.track_more_coffee()}</h2>
					<p class="muted">{m.track_more_coffee_lede()}</p>
					<ul class="coffees">
						{#each data.coffees as c (c.slug)}
							<li>
								<a class="card coffee" href={siteHref(`/shop/${c.slug}`, locale)}>
									<img src={c.image} alt="" loading="lazy" width="320" height="320" />
									<span class="name">{tr(c.name, locale)}</span>
									<span class="muted num">{money(c.from)}</span>
								</a>
							</li>
						{/each}
					</ul>
					<a class="btn ghost" href={siteHref('/shop', locale)}>{m.track_more_shop_cta()}</a>
				</section>
			{:else if data.more === 'visit'}
				<section class="card more">
					<p class="label">{m.track_more_title()}</p>
					<h2 class="section-title">{m.track_more_visit()}</h2>
					<p class="muted">{m.track_more_visit_lede()}</p>
					<p class="actions">
						<a class="btn" href={siteHref('/visit', locale)}>{m.track_more_visit_cta()}</a>
						<a class="btn ghost" href={siteHref('/experiences', locale)}>
							{m.track_more_experiences_cta()}
						</a>
					</p>
				</section>
			{/if}
		</div>

		<aside class="aside card">
			<h2 class="section-title">{m.track_summary()}</h2>
			<ul class="lines">
				{#each data.lines as l (l.id)}
					<li>
						<span>{l.quantity} × {tr(l.description, locale)}</span>
						<span class="num">{money(l.lineTotal)}</span>
					</li>
				{/each}
				{#if o.discountTotal > 0}
					<li>
						<span>{m.site_discount()}</span><span class="num">−{money(o.discountTotal)}</span>
					</li>
				{/if}
				{#if o.deliveryFee > 0}
					<li><span>{m.site_delivery()}</span><span class="num">{money(o.deliveryFee)}</span></li>
				{/if}
				<li class="total">
					<span>{m.site_total()}</span><span class="num">{money(o.total)}</span>
				</li>
			</ul>
			<p class="hint">{m.site_vat_included({ amount: money(o.taxTotal) })}</p>
			{#if o.amountPaid > 0}<p class="muted">
					{m.track_paid_so_far({ amount: money(o.amountPaid) })}
				</p>{/if}

			{#if data.history.length}
				<h3 class="sub">{m.track_history()}</h3>
				<ol class="history">
					{#each data.history as h, i (i)}
						<li>
							<span>{statusName(h.toStatus)}</span><span class="muted num">
								{formatDateTime(h.at)}
							</span>
						</li>
					{/each}
				</ol>
			{/if}
		</aside>
	</div>
</div>

<style>
	.status {
		display: grid;
		gap: 6px;
	}
	.status p {
		margin: 0;
	}
	.big {
		font-family: var(--font-display);
		font-size: clamp(1.6rem, 3vw, 2.2rem);
		font-weight: 800;
		line-height: 1.05;
	}
	.tickets {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ticket {
		display: grid;
		gap: 6px;
	}
	.ticket p {
		margin: 0;
	}
	.qr {
		width: min(100%, 240px);
		aspect-ratio: 1;
		padding: 8px;
		border-radius: 12px;
		background: #fff;
	}
	.qr :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.code {
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}
	.sub {
		margin-top: 24px;
		font-size: 1rem;
	}
	#pay .sub:first-of-type {
		margin-top: 8px;
	}
	.transfer {
		display: grid;
		gap: 12px;
	}
	.accounts {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.account {
		display: grid;
		gap: 4px;
		padding: 12px 14px;
		border: 1px solid var(--hair);
		border-radius: 12px;
	}
	.account p {
		margin: 0;
	}
	.number {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px;
	}
	.number strong {
		font-size: 1.1rem;
		letter-spacing: 0.04em;
		overflow-wrap: anywhere;
	}
	.receipt {
		display: grid;
		gap: 14px;
	}
	.more {
		display: grid;
		gap: 10px;
	}
	.more p {
		margin: 0;
	}
	.coffees {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.coffee {
		display: grid;
		gap: 4px;
		height: 100%;
		color: inherit;
		text-decoration: none;
	}
	.coffee img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 10px;
	}
	.coffee .name {
		font-weight: 700;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.more .btn {
		justify-self: start;
	}
	.history {
		display: grid;
		gap: 6px;
		margin: 10px 0 0;
		padding: 0;
		list-style: none;
		font-size: 14px;
	}
	.history li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}
</style>
