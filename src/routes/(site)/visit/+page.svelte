<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';
	import TicketCheckout from '#lib/site/visit/TicketCheckout.svelte';
	import CalendarSwitch from '@nahu/admin-kit/formComponents/CalendarSwitch.svelte';
	import { useCalendar } from '@nahu/admin-kit/calendarPreference.svelte';
	import { formatDateIn, otherCalendar } from '@nahu/admin-kit/calendars';

	let { data } = $props();

	const locale = $derived(getLocale());

	/** The page again with one choice changed; the other choices stay. */
	const choose = (change: { date?: string; audience?: string }) => {
		const date = change.date ?? data.date;
		const audience = change.audience ?? data.audience?.code;
		const q = [date && `date=${encodeURIComponent(date)}`, audience && `audience=${encodeURIComponent(audience)}`].filter(Boolean);
		return `${siteHref('/visit', locale)}?${q.join('&')}`;
	};

	/*
	 * The days on either calendar, as the kit's date inputs show them: Gregorian by default (the
	 * root layout's `setKitCalendar`), switchable to Ethiopian, and remembered by this browser for
	 * every date input. Only the labels change; the link and the ticket keep the Gregorian date.
	 */
	const calendar = useCalendar();
	// After the first render, so the server's page and the browser's match.
	$effect(() => calendar.restore());
	const kind = $derived(calendar.kind);

	const weekday = $derived(new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }));
	// Ethiopian months are written in Amharic whatever the page's language, as everywhere in the kit.
	const dayMonth = $derived(
		kind === 'ethiopian'
			? new Intl.DateTimeFormat('am-ET', { calendar: 'ethiopic', day: 'numeric', month: 'short', timeZone: 'UTC' })
			: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
	);
	const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
</script>

<svelte:head><title>{m.visit_title()} · Kebena</title></svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.visit_label()}</p>
		<h1 class="title">{m.visit_title()}</h1>
		<p class="lede">{m.visit_lede()}</p>
	</header>

	<div class="section notes">
		<p class="notice">{m.visit_info_entry()}</p>
		<p class="notice">
			{m.visit_info_groups()}
			<a class="link" href={siteHref('/groups', locale)}>{m.visit_groups_link()}</a>
		</p>
	</div>

	<section class="section form">
		<fieldset>
			<legend>{m.visit_who()}</legend>
			<div class="opts">
				{#each data.audiences as a (a.code)}
					<a
						class="opt"
						class:on={a.code === data.audience?.code}
						aria-current={a.code === data.audience?.code ? 'true' : undefined}
						href={choose({ audience: a.code })}
						data-sveltekit-reset="false"
						data-sveltekit-replacestate
					>
						<span class="mid">{tr(a.name, locale)}</span>
					</a>
				{/each}
			</div>
			<p class="hint">{m.visit_who_hint()}</p>
		</fieldset>

		<fieldset>
			<legend>{m.visit_date()}</legend>
			<CalendarSwitch class="calendar" value={kind} onchange={(k) => calendar.set(k)} />
			{#if data.days.length}
				<div class="days">
					{#each data.days as d (d.date)}
						{#if d.free > 0}
							<a
								class="day"
								class:on={d.date === data.date}
								aria-current={d.date === data.date ? 'date' : undefined}
								href={choose({ date: d.date })}
								data-sveltekit-reset="false"
								data-sveltekit-replacestate
							>
								<span class="small">{weekday.format(asDate(d.date))}</span>
								<span class="mid">{dayMonth.format(asDate(d.date))}</span>
							</a>
						{:else}
							<span class="day full">
								<span class="small">{weekday.format(asDate(d.date))}</span>
								<span class="mid">{dayMonth.format(asDate(d.date))}</span>
								<span class="small">{m.visit_full()}</span>
							</span>
						{/if}
					{/each}
				</div>
				{#if data.date}
					<!-- The chosen day on both calendars, as the kit's date picker writes it. -->
					<p class="chosen" aria-live="polite">
						<span class="mid">{formatDateIn(data.date, kind, locale)}</span>
						<span class="small">{formatDateIn(data.date, otherCalendar(kind), locale, 'short')}</span>
					</p>
				{/if}
			{:else}
				<p class="notice">{m.visit_no_days()}</p>
			{/if}
		</fieldset>
	</section>

	{#if data.date && data.audience}
		<section class="section">
			{#key `${data.date}:${data.audience.code}`}
				<TicketCheckout
					form={data.form}
					types={data.types}
					declaration={data.audience.declaration}
					slots={data.slots}
					paymentsOn={data.paymentsOn}
				/>
			{/key}
		</section>
	{/if}

	<section class="section">
		<h2 class="section-title">{m.visit_more_title()}</h2>
		<div class="cards">
			<a class="card more" href={siteHref('/experiences', locale)}>
				<span class="label">{m.exp_label()}</span>
				<span class="mid">{m.visit_exp_link()}</span>
			</a>
			<a class="card more" href={siteHref('/events', locale)}>
				<span class="label">{m.events_label()}</span>
				<span class="mid">{m.visit_events_link()}</span>
			</a>
		</div>
	</section>
</div>

<style>
	.notes {
		display: grid;
		gap: 10px;
	}
	.notes p {
		margin: 0;
	}
	.opt {
		color: inherit;
		text-decoration: none;
	}
	.opt.on,
	.day.on {
		border-color: var(--accent-ink);
		background: color-mix(in srgb, var(--gold) 22%, transparent);
	}
	.days {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 6px;
		scroll-snap-type: x proximity;
	}
	.day {
		display: grid;
		flex: none;
		gap: 2px;
		min-width: 76px;
		padding: 10px 12px;
		border: 1px solid var(--hair);
		border-radius: 14px;
		color: inherit;
		text-align: center;
		text-decoration: none;
		scroll-snap-align: start;
	}
	.day.full {
		opacity: 0.45;
	}
	fieldset :global(.calendar) {
		justify-self: start;
	}
	.chosen {
		display: grid;
		gap: 2px;
		margin: 0;
	}
	.mid {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 600;
		line-height: 1.15;
	}
	.small {
		color: var(--ink-soft);
		font-size: 13px;
	}
	.more {
		display: grid;
		gap: 8px;
		color: inherit;
		text-decoration: none;
		transition: border-color 0.2s;
	}
	.more:hover {
		border-color: var(--accent-ink);
	}
</style>
