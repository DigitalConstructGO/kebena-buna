<!-- The marketing tick box on public forms: optional and never pre-ticked (8.4). -->
<script lang="ts">
	import { Checkbox } from '@nahu/admin-kit/components/ui/checkbox/index.js';
	import { m } from '#lib/paraglide/messages.js';

	let { checked = $bindable(false) }: { checked?: boolean } = $props();
</script>

<label class="check">
	<Checkbox name="marketingConsent" bind:checked />
	<span>{m.site_consent()}</span>
</label>
