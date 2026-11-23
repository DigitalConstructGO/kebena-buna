<!--
	"How would you like to pay?" on a checkout, offered only when both ways are open: Chapa now,
	or a bank transfer paid from the order's page next (`/track/{number}`, where the accounts and
	the receipt upload are). With one way open there is nothing to choose; the form posts the
	default and the server sends the buyer wherever is open.
-->
<script lang="ts">
	import ImageSelect from '@nahu/admin-kit/formComponents/ImageSelect.svelte';
	import { m } from '#lib/i18n.ts';

	let {
		value = $bindable('online'),
		paymentsOn,
		transfersOn,
		step
	}: {
		value?: 'online' | 'transfer';
		paymentsOn: boolean;
		transfersOn: boolean;
		/** The fieldset's number, on a form whose steps are numbered. */
		step?: number;
	} = $props();

	const id = $props.id();
</script>

{#if paymentsOn && transfersOn}
	<fieldset>
		<legend id="{id}-legend">{step ? `${step}. ` : ''}{m.site_pay_how()}</legend>
		<ImageSelect
			id="{id}-pay"
			name="payWith"
			bind:value
			items={[
				{ value: 'online', name: m.site_pay_online(), description: m.site_pay_online_hint() },
				{ value: 'transfer', name: m.site_pay_transfer(), description: m.site_pay_transfer_hint() }
			]}
			labelledBy="{id}-legend"
		/>
	</fieldset>
{/if}
