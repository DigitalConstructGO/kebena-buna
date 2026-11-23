<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { m } from '#lib/paraglide/messages.js';
	import Field from '#lib/site/Field.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message } = superForm(data.form);
</script>

<svelte:head><title>{m.track_find_title()} · Kebena</title></svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.track_label()}</p>
		<h1 class="title">{m.track_find_title()}</h1>
		<p class="lede">{m.track_find_lede()}</p>
	</header>
	<form method="POST" class="section form card" style:max-width="560px" use:enhance>
		<div class="fields">
			<Field label={m.track_find_number()} name="number" bind:value={$form.number} errors={$errors.number} required placeholder="KC-26-000123" autocomplete="off" />
			<Field label={m.track_find_phone()} name="phone" type="tel" bind:value={$form.phone} errors={$errors.phone} required autocomplete="tel" />
		</div>
		{#if $message}<p class="notice bad" role="alert">{$message}</p>{/if}
		<button class="btn" disabled={$delayed}>{m.track_find_button()}</button>
	</form>
</div>
