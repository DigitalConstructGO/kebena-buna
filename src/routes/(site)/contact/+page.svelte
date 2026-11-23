<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { m } from '#lib/paraglide/messages.js';
	import Field from '#lib/site/Field.svelte';
	import Trap from '#lib/site/Trap.svelte';
	import Consent from '#lib/site/Consent.svelte';
	import FormNotice from '#lib/site/FormNotice.svelte';
	import ImageSelect from '@nahu/admin-kit/formComponents/ImageSelect.svelte';
	import ArrivalMap from '#lib/components/museum/ArrivalMap.svelte';
	import { localizeHref } from '#lib/paraglide/runtime.js';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const enquiry = superForm(data.enquiry);
	// svelte-ignore state_referenced_locally
	const feedback = superForm(data.feedback);
	const {
		form: eForm,
		errors: eErrors,
		enhance: eEnhance,
		delayed: eDelayed,
		message: eMessage
	} = enquiry;
	const {
		form: fForm,
		errors: fErrors,
		enhance: fEnhance,
		delayed: fDelayed,
		message: fMessage
	} = feedback;

	let tab = $state<'enquiry' | 'feedback'>('enquiry');
	const today = new Date().toISOString().slice(0, 10);
	const ratings = $derived([
		{ value: 1, label: m.contact_rating_1() },
		{ value: 2, label: m.contact_rating_2() },
		{ value: 3, label: m.contact_rating_3() },
		{ value: 4, label: m.contact_rating_4() },
		{ value: 5, label: m.contact_rating_5() }
	]);
</script>

<svelte:head>
	<title>{m.contact_title()} · Kebena</title>
	<meta name="description" content={m.contact_lede()} />
</svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.contact_label()}</p>
		<h1 class="title">{m.contact_title()}</h1>
		<p class="lede">{m.contact_lede()}</p>
	</header>

	<div class="section split">
		<div class="form">
			<div class="tabs" role="tablist" aria-label={m.contact_tabs_label()}>
				<button
					type="button"
					role="tab"
					id="tab-enquiry"
					aria-controls="panel-enquiry"
					aria-selected={tab === 'enquiry'}
					onclick={() => (tab = 'enquiry')}
				>
					{m.contact_tab_enquiry()}
				</button>
				<button
					type="button"
					role="tab"
					id="tab-feedback"
					aria-controls="panel-feedback"
					aria-selected={tab === 'feedback'}
					onclick={() => (tab = 'feedback')}
				>
					{m.contact_tab_feedback()}
				</button>
			</div>

			<div
				id="panel-enquiry"
				role="tabpanel"
				aria-labelledby="tab-enquiry"
				hidden={tab !== 'enquiry'}
			>
				<form method="POST" action="?/enquiry" class="form" use:eEnhance>
					<Trap bind:value={$eForm.website} />
					<div class="fields two">
						<Field
							label={m.contact_name()}
							name="name"
							bind:value={$eForm.name}
							errors={$eErrors.name}
							required
							autocomplete="name"
						/>
						<Field
							label={m.contact_subject()}
							name="subject"
							bind:value={$eForm.subject}
							errors={$eErrors.subject}
							required
						/>
						<Field
							label={m.contact_email()}
							name="email"
							type="email"
							bind:value={$eForm.email}
							errors={$eErrors.email}
							autocomplete="email"
						/>
						<Field
							label={m.contact_phone()}
							name="phone"
							type="tel"
							bind:value={$eForm.phone}
							errors={$eErrors.phone}
							autocomplete="tel"
						/>
						<p class="hint wide">{m.contact_reach_hint()}</p>
						<Field
							label={m.contact_message()}
							name="message"
							type="textarea"
							rows={6}
							bind:value={$eForm.message}
							errors={$eErrors.message}
							required
							wide
						/>
					</div>
					<Consent bind:checked={$eForm.marketingConsent} />
					<FormNotice message={$eMessage} thanks={m.contact_thanks_enquiry()} />
					<button class="btn" disabled={$eDelayed}>{m.contact_send()}</button>
				</form>
			</div>

			<div
				id="panel-feedback"
				role="tabpanel"
				aria-labelledby="tab-feedback"
				hidden={tab !== 'feedback'}
			>
				<form method="POST" action="?/feedback" class="form" use:fEnhance>
					<Trap bind:value={$fForm.website} />
					<fieldset>
						<legend id="rating-legend">{m.contact_rating()}</legend>
						<div class="rating">
							<ImageSelect
								name="rating"
								bind:value={$fForm.rating}
								items={ratings.map((r) => ({
									value: r.value,
									name: String(r.value),
									description: r.label
								}))}
								labelledBy="rating-legend"
								invalid={Boolean($fErrors.rating)}
							/>
						</div>
						{#if $fErrors.rating}<p class="error">{$fErrors.rating[0]}</p>{/if}
					</fieldset>
					<div class="fields two">
						<Field
							label={m.contact_feedback_message()}
							name="message"
							type="textarea"
							rows={5}
							bind:value={$fForm.message}
							errors={$fErrors.message}
							required
							wide
						/>
						<Field
							label={m.contact_name_optional()}
							name="name"
							bind:value={$fForm.name}
							errors={$fErrors.name}
							autocomplete="name"
						/>
						<Field
							label={m.contact_email_optional()}
							name="email"
							type="email"
							bind:value={$fForm.email}
							errors={$fErrors.email}
							autocomplete="email"
						/>
						<Field
							label={m.contact_visit_date()}
							name="visitDate"
							type="date"
							max={today}
							bind:value={$fForm.visitDate}
							errors={$fErrors.visitDate}
						/>
					</div>
					<Consent bind:checked={$fForm.marketingConsent} />
					<FormNotice message={$fMessage} thanks={m.contact_thanks_feedback()} />
					<button class="btn" disabled={$fDelayed}>{m.contact_send_feedback()}</button>
				</form>
			</div>
		</div>

		<aside class="aside card details">
			<h2 class="section-title">{m.contact_visit_us()}</h2>
			<dl>
				<dt class="label">{m.contact_address()}</dt>
				<dd>{m.contact_address_value()}</dd>
				<dt class="label">{m.contact_hours()}</dt>
				<dd>{m.contact_hours_value()}</dd>
				<dt class="label">{m.contact_phone()}</dt>
				<dd><a class="link num" href="tel:+251912605824">+251 912 605 824</a></dd>
				<dt class="label">{m.contact_email()}</dt>
				<dd>
					<a class="link" href="mailto:info@kebenageneraltrading.com">
						info@kebenageneraltrading.com
					</a>
				</dd>
			</dl>
			<a
				class="btn ghost small"
				href="https://www.google.com/maps/search/?api=1&query=Coffee+cup+building+Jimma+Ethiopia"
				target="_blank"
				rel="noopener noreferrer"
			>
				{m.contact_directions()}
			</a>
		</aside>
	</div>
</div>

<!-- the way here, told as you scroll; every word is one the site already translates -->
<ArrivalMap
	eyebrow={m.site_nav_visit()}
	title={m.contact_visit_us()}
	beats={[m.contact_address_value(), m.contact_hours_value()]}
	tags={[
		m.site_footer_halls(),
		m.site_nav_experiences(),
		m.site_footer_events(),
		m.site_footer_tickets(),
		m.site_nav_shop(),
		m.site_footer_membership()
	]}
	place={{ name: 'Kebena Museum', area: 'Jimma · Oromia' }}
	rows={[
		{ label: m.contact_address(), value: m.contact_address_value() },
		{ label: m.contact_hours(), value: m.contact_hours_value() },
		{ label: m.contact_phone(), value: '+251 912 605 824' },
		{ label: m.contact_email(), value: 'info@kebenageneraltrading.com' }
	]}
	actions={[
		{
			label: m.contact_directions(),
			href: 'https://www.google.com/maps/search/?api=1&query=Coffee+cup+building+Jimma+Ethiopia',
			external: true
		},
		{ label: m.site_footer_tickets(), href: localizeHref('/visit') }
	]}
/>

<style>
	.tabs {
		display: inline-flex;
		gap: 4px;
		justify-self: start;
		padding: 4px;
		border: 1px solid var(--hair);
		border-radius: 999px;
	}
	.tabs button {
		min-height: 40px;
		padding: 0 18px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 15px;
		cursor: pointer;
	}
	.tabs button[aria-selected='true'] {
		background: var(--gold);
		color: var(--forest-950);
		font-weight: 600;
	}
	.rating :global([role='radiogroup']) {
		grid-template-columns: repeat(5, minmax(0, 1fr));
	}
	@media (width <= 520px) {
		.rating :global([role='radiogroup']) {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.details {
		display: grid;
		gap: 18px;
		align-content: start;
	}
	dl {
		display: grid;
		gap: 6px;
		margin: 0;
	}
	dt {
		margin-top: 10px;
	}
	dd {
		margin: 0;
	}
</style>
