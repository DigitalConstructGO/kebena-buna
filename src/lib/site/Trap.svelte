<!--
	The invisible spam check (8.4): a field people never see or fill, so a post that fills it came
	from a bot. Pair with `siteFormBase.website` and `isTrapped` on the server.
-->
<script lang="ts">
	let { value = $bindable() }: { value?: string | null } = $props();
</script>

<div class="trap" aria-hidden="true">
	<label>Website <input name="website" type="text" tabindex="-1" autocomplete="off" bind:value /></label>
</div>
