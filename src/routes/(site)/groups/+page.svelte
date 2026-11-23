<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { m } from '#lib/paraglide/messages.js';
	import Field from '#lib/site/Field.svelte';
	import Trap from '#lib/site/Trap.svelte';
	import Consent from '#lib/site/Consent.svelte';
	import FormNotice from '#lib/site/FormNotice.svelte';
	import ImageSelect from '@nahu/admin-kit/formComponents/ImageSelect.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const group = superForm(data.group);
	// svelte-ignore state_referenced_locally
	const privateEvent = superForm(data.event);
	const {
		form: gForm,
		errors: gErrors,
		enhance: gEnhance,
		delayed: gDelayed,
		message: gMessage
	} = group;
	const {
		form: pForm,
		errors: pErrors,
		enhance: pEnhance,
		delayed: pDelayed,
		message: pMessage
	} = privateEvent;

	const today = new Date().toISOString().slice(0, 10);
</script>

<svelte:head>
	<title>{m.groups_title()} · Kebena</title>
	<meta name="description" content={m.groups_lede()} />
</svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.groups_label()}</p>
		<h1 class="title">{m.groups_title()}</h1>
		<p class="lede">{m.groups_lede()}</p>
	</header>

	<ol class="section cards steps">
		<li class="card">
			<span class="big">1</span>
			<p>{m.groups_step_1()}</p>
		</li>
		<li class="card">
			<span class="big">2</span>
			<p>{m.groups_step_2()}</p>
		</li>
		<li class="card">
			<span class="big">3</span>
			<p>{m.groups_step_3()}</p>
		</li>
	</ol>

	<section class="section split" aria-labelledby="group-title">
		<form method="POST" action="?/group" class="form" use:gEnhance>
			<h2 class="section-title" id="group-title">{m.groups_form_title()}</h2>
			<Trap bind:value={$gForm.website} />
			<fieldset>
				<legend id="kind-legend">{m.groups_kind()}</legend>
				<ImageSelect
					name="kind"
					bind:value={$gForm.kind}
					items={[
						{
							value: 'school',
							name: m.groups_kind_school(),
							description: m.groups_kind_school_hint()
						},
						{ value: 'group', name: m.groups_kind_group(), description: m.groups_kind_group_hint() }
					]}
					labelledBy="kind-legend"
				/>
			</fieldset>
			<fieldset>
				<legend>{m.groups_who()}</legend>
				<div class="fields two">
					<Field
						label={m.groups_organisation()}
						name="organisationName"
						bind:value={$gForm.organisationName}
						errors={$gErrors.organisationName}
						required
						autocomplete="organization"
						wide
					/>
					<Field
						label={m.groups_contact_name()}
						name="contactName"
						bind:value={$gForm.contactName}
						errors={$gErrors.contactName}
						required
						autocomplete="name"
					/>
					<Field
						label={m.groups_phone()}
						name="phone"
						type="tel"
						bind:value={$gForm.phone}
						errors={$gErrors.phone}
						required
						autocomplete="tel"
					/>
					<Field
						label={m.groups_email()}
						name="email"
						type="email"
						bind:value={$gForm.email}
						errors={$gErrors.email}
						required
						autocomplete="email"
					/>
					<Field
						label={m.groups_tin()}
						name="tin"
						bind:value={$gForm.tin}
						errors={$gErrors.tin}
						hint={m.groups_tin_hint()}
					/>
				</div>
			</fieldset>
			<fieldset>
				<legend>{m.groups_visit()}</legend>
				<div class="fields two">
					<Field
						label={m.groups_date_1()}
						name="preferredDate1"
						type="date"
						min={today}
						bind:value={$gForm.preferredDate1}
						errors={$gErrors.preferredDate1}
						required
					/>
					<Field
						label={m.groups_date_2()}
						name="preferredDate2"
						type="date"
						min={today}
						bind:value={$gForm.preferredDate2}
						errors={$gErrors.preferredDate2}
					/>
					<Field
						label={m.groups_date_3()}
						name="preferredDate3"
						type="date"
						min={today}
						bind:value={$gForm.preferredDate3}
						errors={$gErrors.preferredDate3}
					/>
					<Field
						label={m.groups_size()}
						name="partySize"
						type="number"
						min={10}
						max={500}
						inputmode="numeric"
						bind:value={$gForm.partySize}
						errors={$gErrors.partySize}
						required
						hint={m.groups_size_hint()}
					/>
					<Field
						label={m.groups_ages()}
						name="ageRange"
						bind:value={$gForm.ageRange}
						errors={$gErrors.ageRange}
						required
						placeholder={m.groups_ages_placeholder()}
					/>
					<Field
						label={m.groups_requests()}
						name="specialRequests"
						type="textarea"
						bind:value={$gForm.specialRequests}
						errors={$gErrors.specialRequests}
						wide
						hint={m.groups_requests_hint()}
					/>
				</div>
			</fieldset>
			<Consent bind:checked={$gForm.marketingConsent} />
			<FormNotice message={$gMessage} thanks={m.groups_thanks()} />
			<button class="btn" disabled={$gDelayed}>{m.groups_send()}</button>
		</form>
		<aside class="aside card">
			<h2 class="section-title">{m.groups_good_to_know()}</h2>
			<ul class="facts">
				<li>{m.groups_fact_capacity()}</li>
				<li>{m.groups_fact_payment()}</li>
				<li>{m.groups_fact_hold()}</li>
				<li>{m.groups_fact_qr()}</li>
			</ul>
		</aside>
	</section>

	<section class="section split" aria-labelledby="event-title">
		<form method="POST" action="?/event" class="form" use:pEnhance>
			<h2 class="section-title" id="event-title">{m.groups_event_title()}</h2>
			<p class="muted">{m.groups_event_lede()}</p>
			<Trap bind:value={$pForm.website} />
			<div class="fields two">
				<Field
					label={m.groups_contact_name()}
					name="name"
					bind:value={$pForm.name}
					errors={$pErrors.name}
					required
					autocomplete="name"
				/>
				<Field
					label={m.groups_phone()}
					name="phone"
					type="tel"
					bind:value={$pForm.phone}
					errors={$pErrors.phone}
					required
					autocomplete="tel"
				/>
				<Field
					label={m.groups_email()}
					name="email"
					type="email"
					bind:value={$pForm.email}
					errors={$pErrors.email}
					required
					autocomplete="email"
				/>
				<Field
					label={m.groups_event_type()}
					name="eventType"
					bind:value={$pForm.eventType}
					errors={$pErrors.eventType}
					required
					placeholder={m.groups_event_type_placeholder()}
				/>
				<Field
					label={m.groups_event_date()}
					name="preferredDate"
					type="date"
					min={today}
					bind:value={$pForm.preferredDate}
					errors={$pErrors.preferredDate}
					required
				/>
				<Field
					label={m.groups_guests()}
					name="guestCount"
					type="number"
					min={1}
					inputmode="numeric"
					bind:value={$pForm.guestCount}
					errors={$pErrors.guestCount}
					required
				/>
				<Field
					label={m.groups_budget()}
					name="budget"
					bind:value={$pForm.budget}
					errors={$pErrors.budget}
					placeholder={m.groups_budget_placeholder()}
				/>
				<Field
					label={m.groups_catering()}
					name="catering"
					bind:value={$pForm.catering}
					errors={$pErrors.catering}
					placeholder={m.groups_catering_placeholder()}
				/>
				<Field
					label={m.groups_message()}
					name="message"
					type="textarea"
					bind:value={$pForm.message}
					errors={$pErrors.message}
					wide
				/>
			</div>
			<Consent bind:checked={$pForm.marketingConsent} />
			<FormNotice message={$pMessage} thanks={m.groups_event_thanks()} />
			<button class="btn" disabled={$pDelayed}>{m.groups_event_send()}</button>
		</form>
	</section>
</div>

<style>
	.steps {
		margin-block-start: clamp(28px, 4vw, 48px);
		padding: 0;
		list-style: none;
	}
	.steps li {
		display: grid;
		gap: 8px;
	}
	.steps p {
		margin: 0;
	}
	.big {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 800;
		color: var(--accent-ink);
		line-height: 1;
	}
	.facts {
		display: grid;
		gap: 12px;
		margin: 0;
		padding-inline-start: 1.1em;
	}
</style>
