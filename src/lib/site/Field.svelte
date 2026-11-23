<!--
	A labelled field for the public site's forms, in the design's style (`site.css` › Forms). The
	control is the admin-kit's: its `Input`, `Textarea` or `SelectComp`. Binds its value and shows
	the first superforms error under it. `type="select"` takes `options`, `type="textarea"` takes
	`rows`; anything else is an `Input`, and extra attributes (`autocomplete`, `inputmode`) pass
	through to it, which the kit's `InputComp` would drop: a checkout must still autofill.
-->
<script lang="ts">
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Textarea } from '@nahu/admin-kit/components/ui/textarea/index.js';
	import SelectComp from '@nahu/admin-kit/formComponents/SelectComp.svelte';

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
	} & Omit<HTMLInputAttributes, 'type' | 'value' | 'name' | 'files'> = $props();

	const id = $props.id();
	const error = $derived(errors?.[0]);
	const describedBy = $derived(
		[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
			undefined
	);

	/** An optional select with a placeholder offers it as a choice, so a pick can be taken back. */
	const items = $derived([
		...(placeholder && !required ? [{ value: '', name: placeholder }] : []),
		...options.map((o) => ({ value: o.value, name: o.label }))
	]);
	/** The kit's `Input` takes any type but `file`, which has its own upload. */
	const inputType = $derived((type ?? 'text') as Exclude<HTMLInputTypeAttribute, 'file'>);
	const text = {
		get: () => (value == null ? '' : String(value as string | number)),
		set: (v: string) => (value = v)
	};
</script>

<label class="field" class:wide data-invalid={error ? '' : undefined} for={id}>
	<span>
		{label}{#if required}<span aria-hidden="true"> *</span>{/if}
	</span>
	{#if type === 'select'}
		<SelectComp
			{id}
			{name}
			{items}
			{label}
			placeholder={placeholder ?? '—'}
			bind:value
			{required}
			invalid={Boolean(error)}
			{describedBy}
		/>
	{:else if type === 'textarea'}
		<Textarea
			{id}
			{name}
			{rows}
			{placeholder}
			{required}
			bind:value={text.get, text.set}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
		/>
	{:else}
		<Input
			{id}
			{name}
			type={inputType}
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
