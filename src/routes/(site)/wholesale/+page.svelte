<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { tr } from '#lib/format.ts';
	import { BUSINESS_TYPES } from '#lib/constants.ts';
	import { INCOTERMS } from '#lib/schemas/siteForms.ts';
	import Field from '#lib/site/Field.svelte';
	import Trap from '#lib/site/Trap.svelte';
	import Consent from '#lib/site/Consent.svelte';
	import FormNotice from '#lib/site/FormNotice.svelte';
	import FileUpload from '@nahu/admin-kit/formComponents/FileUpload.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const application = superForm(data.application);
	// svelte-ignore state_referenced_locally
	const quote = superForm(data.quote);
	const {
		form: aForm,
		errors: aErrors,
		enhance: aEnhance,
		delayed: aDelayed,
		message: aMessage
	} = application;
	const {
		form: qForm,
		errors: qErrors,
		enhance: qEnhance,
		delayed: qDelayed,
		message: qMessage
	} = quote;

	const locale = $derived(getLocale());

	const TYPE_NAMES: Record<(typeof BUSINESS_TYPES)[number], () => string> = {
		cafe: m.wholesale_type_cafe,
		hotel: m.wholesale_type_hotel,
		restaurant: m.wholesale_type_restaurant,
		office: m.wholesale_type_office,
		retailer: m.wholesale_type_retailer,
		exporter: m.wholesale_type_exporter,
		other: m.wholesale_type_other
	};
	const types = $derived(BUSINESS_TYPES.map((t) => ({ value: t, label: TYPE_NAMES[t]() })));
	const incoterms = $derived(
		INCOTERMS.map((t) => ({ value: t, label: t === 'other' ? m.wholesale_incoterm_other() : t }))
	);

	const range = (t: { minKg: number; maxKg: number | null }) =>
		t.maxKg === null
			? m.wholesale_tier_from({ min: t.minKg })
			: m.wholesale_tier_range({ min: t.minKg, max: t.maxKg });
</script>

<svelte:head>
	<title>{m.site_page_title({ title: m.wholesale_title() })}</title>
	<meta name="description" content={m.wholesale_lede()} />
</svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.wholesale_label()}</p>
		<h1 class="title">{m.wholesale_title()}</h1>
		<p class="lede">{m.wholesale_lede()}</p>
	</header>

	<section class="section" aria-labelledby="how-title">
		<h2 class="section-title" id="how-title">{m.wholesale_how_title()}</h2>
		<ul class="cards how">
			<li class="card">
				<p class="label">{m.wholesale_how_apply()}</p>
				<p>{m.wholesale_how_apply_text()}</p>
			</li>
			<li class="card">
				<p class="label">{m.wholesale_how_minimum()}</p>
				<p>{m.wholesale_how_minimum_text({ kg: data.minOrderKg })}</p>
			</li>
			<li class="card">
				<p class="label">{m.wholesale_how_pay()}</p>
				<p>{m.wholesale_how_pay_text()}</p>
			</li>
		</ul>
		{#if data.tiers.length}
			<div class="card tiers">
				<p class="label">{m.wholesale_tiers()}</p>
				<ul class="lines">
					{#each data.tiers as t (t.id)}
						<li>
							<span>{tr(t.name, locale)} · <span class="muted num">{range(t)}</span></span>
							<span class="price num">−{t.discountPct}%</span>
						</li>
					{/each}
				</ul>
				<p class="hint">{m.wholesale_tiers_hint()}</p>
			</div>
		{/if}
	</section>

	<section class="section" aria-labelledby="apply-title">
		<form
			method="POST"
			action="?/application"
			enctype="multipart/form-data"
			class="form"
			use:aEnhance
		>
			<h2 class="section-title" id="apply-title">{m.wholesale_apply_title()}</h2>
			<Trap bind:value={$aForm.website} />
			<fieldset>
				<legend>{m.wholesale_business()}</legend>
				<div class="fields two">
					<Field
						label={m.wholesale_name()}
						name="name"
						bind:value={$aForm.name}
						errors={$aErrors.name}
						required
						autocomplete="organization"
					/>
					<Field
						label={m.wholesale_type()}
						name="type"
						type="select"
						options={types}
						bind:value={$aForm.type}
						errors={$aErrors.type}
						required
					/>
					<Field
						label={m.wholesale_licence()}
						name="tradeLicenceNumber"
						bind:value={$aForm.tradeLicenceNumber}
						errors={$aErrors.tradeLicenceNumber}
						required
					/>
					<!-- The kit's drop zone is the file input's own label, so this one names the field only. -->
					<div class="field" data-invalid={$aErrors.tradeLicenceFile ? '' : undefined}>
						<span>{m.wholesale_licence_file()}</span>
						<FileUpload
							form={aForm}
							name="tradeLicenceFile"
							accept=".pdf,image/*"
							placeholder={m.wholesale_licence_file_hint()}
						/>
						{#if $aErrors.tradeLicenceFile}<p class="error" role="alert">
								{$aErrors.tradeLicenceFile[0]}
							</p>{/if}
					</div>
					<Field
						label={m.wholesale_tin()}
						name="tin"
						bind:value={$aForm.tin}
						errors={$aErrors.tin}
						required
						inputmode="numeric"
					/>
					<Field
						label={m.wholesale_vat()}
						name="vatNumber"
						bind:value={$aForm.vatNumber}
						errors={$aErrors.vatNumber}
					/>
					<Field
						label={m.wholesale_monthly()}
						name="expectedMonthlyKg"
						type="number"
						min={0}
						step="any"
						inputmode="decimal"
						bind:value={$aForm.expectedMonthlyKg}
						errors={$aErrors.expectedMonthlyKg}
					/>
				</div>
			</fieldset>
			<fieldset>
				<legend>{m.wholesale_contact()}</legend>
				<div class="fields two">
					<Field
						label={m.wholesale_contact_name()}
						name="contactName"
						bind:value={$aForm.contactName}
						errors={$aErrors.contactName}
						required
						autocomplete="name"
					/>
					<Field
						label={m.wholesale_phone()}
						name="contactPhone"
						type="tel"
						bind:value={$aForm.contactPhone}
						errors={$aErrors.contactPhone}
						required
						autocomplete="tel"
					/>
					<Field
						label={m.wholesale_email()}
						name="contactEmail"
						type="email"
						bind:value={$aForm.contactEmail}
						errors={$aErrors.contactEmail}
						autocomplete="email"
					/>
					<Field
						label={m.wholesale_city()}
						name="city"
						bind:value={$aForm.city}
						errors={$aErrors.city}
						placeholder={m.wholesale_city_placeholder()}
						autocomplete="address-level2"
					/>
					<Field
						label={m.wholesale_address()}
						name="address"
						bind:value={$aForm.address}
						errors={$aErrors.address}
						wide
						autocomplete="street-address"
						hint={m.wholesale_address_hint()}
					/>
					<Field
						label={m.wholesale_notes()}
						name="notes"
						type="textarea"
						bind:value={$aForm.notes}
						errors={$aErrors.notes}
						wide
					/>
				</div>
			</fieldset>
			<Consent bind:checked={$aForm.marketingConsent} />
			<FormNotice message={$aMessage} thanks={m.wholesale_thanks()} />
			<button class="btn" disabled={$aDelayed}>{m.wholesale_send()}</button>
		</form>
	</section>

	<section class="section split" aria-labelledby="quote-title">
		<form method="POST" action="?/quote" class="form" use:qEnhance>
			<h2 class="section-title" id="quote-title">{m.wholesale_quote_title()}</h2>
			<p class="muted">{m.wholesale_quote_lede()}</p>
			<Trap bind:value={$qForm.website} />
			<div class="fields two">
				<Field
					label={m.wholesale_contact_name()}
					name="name"
					bind:value={$qForm.name}
					errors={$qErrors.name}
					required
					autocomplete="name"
				/>
				<Field
					label={m.wholesale_company()}
					name="company"
					bind:value={$qForm.company}
					errors={$qErrors.company}
					autocomplete="organization"
				/>
				<Field
					label={m.wholesale_email()}
					name="email"
					type="email"
					bind:value={$qForm.email}
					errors={$qErrors.email}
					required
					autocomplete="email"
				/>
				<Field
					label={m.wholesale_phone_optional()}
					name="phone"
					type="tel"
					bind:value={$qForm.phone}
					errors={$qErrors.phone}
					autocomplete="tel"
				/>
				<Field
					label={m.wholesale_country()}
					name="country"
					bind:value={$qForm.country}
					errors={$qErrors.country}
					required
					autocomplete="country-name"
				/>
				<Field
					label={m.wholesale_origin()}
					name="origin"
					bind:value={$qForm.origin}
					errors={$qErrors.origin}
					placeholder={m.wholesale_origin_placeholder()}
				/>
				<Field
					label={m.wholesale_grade()}
					name="grade"
					bind:value={$qForm.grade}
					errors={$qErrors.grade}
					placeholder={m.wholesale_grade_placeholder()}
				/>
				<Field
					label={m.wholesale_bags()}
					name="bags"
					type="number"
					min={1}
					inputmode="numeric"
					bind:value={$qForm.bags}
					errors={$qErrors.bags}
					required
					hint={m.wholesale_bags_hint()}
				/>
				<Field
					label={m.wholesale_incoterm()}
					name="incoterm"
					type="select"
					options={incoterms}
					bind:value={$qForm.incoterm}
					errors={$qErrors.incoterm}
				/>
				<Field
					label={m.wholesale_message()}
					name="message"
					type="textarea"
					bind:value={$qForm.message}
					errors={$qErrors.message}
					wide
				/>
			</div>
			<Consent bind:checked={$qForm.marketingConsent} />
			<FormNotice message={$qMessage} thanks={m.wholesale_quote_thanks()} />
			<button class="btn" disabled={$qDelayed}>{m.wholesale_quote_send()}</button>
		</form>
	</section>
</div>

<style>
	.how {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.how li {
		display: grid;
		gap: 8px;
		align-content: start;
	}
	.how p {
		margin: 0;
	}
	.tiers {
		display: grid;
		gap: 8px;
		margin-top: 16px;
	}
	.tiers .label {
		margin: 0;
	}
</style>
