<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { CUSTOMER_SOURCES, LOCALES } from '#lib/schemas/customers.ts';
	import { choicesOf } from '#lib/format.ts';

	/** A customer's contact fields, shared by the new-customer page and the edit dialog. */
	let {
		form,
		errors
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
	} = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	<InputComp label="Name" name="name" {form} {errors} required />
	<InputComp
		label="Phone"
		name="phone"
		type="tel"
		description="0911 234 567, or +44… for a number abroad. One customer per phone."
		{form}
		{errors}
	/>
	<InputComp label="Email" name="email" type="email" {form} {errors} />
	<InputComp
		label="Language"
		name="locale"
		type="select"
		items={LOCALES}
		{form}
		{errors}
		required
	/>
	<InputComp label="TIN" name="tin" description="For VAT invoices." {form} {errors} />
	<InputComp label="Business name" name="businessName" {form} {errors} />
	<InputComp label="Telegram chat id" name="telegramChatId" {form} {errors} />
	<InputComp
		label="Source"
		name="source"
		type="select"
		items={choicesOf(CUSTOMER_SOURCES)}
		{form}
		{errors}
	/>
</div>
<InputComp label="Notes" name="notes" type="textarea" rows={3} {form} {errors} />
