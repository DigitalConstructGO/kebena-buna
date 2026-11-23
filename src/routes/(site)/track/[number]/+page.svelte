<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
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
</script>

<svelte:head><title>{m.track_title({ number: o.number })} · Kebena</title></svelte:head>

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
				{#if o.receiptNumber}<p class="muted">{m.track_receipt({ number: o.receiptNumber })}</p>{/if}
				{#if o.pickupCode}<p>{m.track_pickup_code()} <strong class="num">{o.pickupCode}</strong></p>{/if}
			</section>

			{#if o.status === 'pending_payment'}
				<section class="card">
					<h2 class="section-title">{m.track_pay_title()}</h2>
					{#if data.canPay}
						<p class="muted">{m.track_pay_lede({ amount: money(o.total - o.amountPaid) })}</p>
						<form
							method="POST"
							action="?/pay&k={encodeURIComponent(page.url.searchParams.get('k') ?? '')}"
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
					{:else}
						<p class="muted">{m.track_pay_offline()}</p>
						<p><a class="link" href="tel:+251912605824">+251 912 605 824</a></p>
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
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									<div class="qr" role="img" aria-label={m.track_qr_label({ code: t.code })}>{@html t.qr}</div>
								{/if}
								<p class="code num">{t.code}</p>
								<p>{formatDate(t.visitDate)}{t.startsAt ? ` · ${formatDateTime(t.startsAt).slice(-5)}` : ''}</p>
								{#if t.admits > 1}<p class="muted">{m.track_admits({ count: t.admits })}</p>{/if}
							</li>
						{/each}
					</ul>
					<p class="hint">{m.track_tickets_hint()}</p>
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
					<li><span>{m.site_discount()}</span><span class="num">−{money(o.discountTotal)}</span></li>
				{/if}
				{#if o.deliveryFee > 0}
					<li><span>{m.site_delivery()}</span><span class="num">{money(o.deliveryFee)}</span></li>
				{/if}
				<li class="total"><span>{m.site_total()}</span><span class="num">{money(o.total)}</span></li>
			</ul>
			<p class="hint">{m.site_vat_included({ amount: money(o.taxTotal) })}</p>
			{#if o.amountPaid > 0}<p class="muted">{m.track_paid_so_far({ amount: money(o.amountPaid) })}</p>{/if}

			{#if data.history.length}
				<h3 class="sub">{m.track_history()}</h3>
				<ol class="history">
					{#each data.history as h, i (i)}
						<li><span>{statusName(h.toStatus)}</span><span class="muted num">{formatDateTime(h.at)}</span></li>
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
