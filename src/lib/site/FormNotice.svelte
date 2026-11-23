<!--
	What a public form says after posting (`inboxAction`): its own thank-you on `ok`, the wait
	notice on `flood`. Announced to screen readers.
-->
<script lang="ts">
	import { m } from '#lib/i18n.ts';

	let { message, thanks }: { message: unknown; thanks: string } = $props();
</script>

{#if message === 'ok'}
	<p class="notice ok" role="status">{thanks}</p>
{:else if message === 'flood'}
	<p class="notice bad" role="alert">{m.site_err_flood()}</p>
{/if}
