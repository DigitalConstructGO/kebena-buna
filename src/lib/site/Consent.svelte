<!-- The marketing tick box on public forms: optional and never pre-ticked (8.4). -->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	let { checked = $bindable(false) }: { checked?: boolean } = $props();
</script>

<label class="check">
	<input type="checkbox" name="marketingConsent" bind:checked />
	<span>{m.site_consent()}</span>
</label>
