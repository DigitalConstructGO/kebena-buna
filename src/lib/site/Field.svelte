<!--
	A labelled input for the public site's forms, in the design's style (`site.css` › Forms). Binds
	its value; shows the first superforms error under it. `type="select"` takes `options`,
	`type="textarea"` takes `rows`; anything else is an `<input>` and extra attributes pass through.
-->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Option = { value: string | number; label: string };
	let {
		label,
		name,
		value = $bindable(),
		errors,
		hint,
		type = 'text',
		options = [],
		placeholder,
		rows = 4,
		required = false,
		wide = false,
		...rest
	}: {
		label: string;
		name: string;
		value?: unknown;
		errors?: string[] | null;
		hint?: string;
		type?: HTMLInputAttributes['type'] | 'select' | 'textarea';
		options?: Option[];
		placeholder?: string;
		rows?: number;
		required?: boolean;
		wide?: boolean;
	} & Omit<HTMLInputAttributes, 'type' | 'value' | 'name'> = $props();

	const id = $props.id();
	const error = $derived(errors?.[0]);
	const describedBy = $derived(
		[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
	);
</script>

<label class="field" class:wide data-invalid={error ? '' : undefined} for={id}>
	<span>{label}{#if required}<span aria-hidden="true"> *</span>{/if}</span>
	{#if type === 'select'}
		<select {id} {name} bind:value {required} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy}>
			{#if placeholder}<option value="">{placeholder}</option>{/if}
			{#each options as o (o.value)}
				<option value={o.value}>{o.label}</option>
			{/each}
		</select>
	{:else if type === 'textarea'}
		<textarea
			{id}
			{name}
			{rows}
			{placeholder}
			{required}
			bind:value
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
		></textarea>
	{:else}
		<input
			{id}
			{name}
			{type}
			{placeholder}
			{required}
			bind:value
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			{...rest}
		/>
	{/if}
	{#if hint}<small id="{id}-hint">{hint}</small>{/if}
	{#if error}<p class="error" id="{id}-error">{error}</p>{/if}
</label>
