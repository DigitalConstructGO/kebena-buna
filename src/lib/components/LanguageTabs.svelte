<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { flushSync, untrack } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { LANGS, LANG_NAMES, LANG_SUFFIX, type Lang } from '#lib/languages.ts';

	/**
	 * A form's translated text as one tab per language, English first.
	 *
	 * Every translated field used to sit on screen in all four languages at once — 24 inputs on a
	 * product, 16 on a plan — so the fields that matter for the record were a long scroll away and
	 * the English was easy to lose among its translations. Here each language is a tab; the tab
	 * says how much of it is filled and whether it holds an error.
	 *
	 * Every language stays in the form while its tab is closed (`hidden`, not unmounted), so a
	 * save still posts all four. A save refused for a field in a closed tab opens that tab, and the
	 * kit's error summary opens it too (`kit-reveal`) before focusing the field.
	 *
	 *     <LanguageTabs {form} {errors} fields={['name', 'description']}>
	 *       {#snippet children({ suffix, language })}
	 *         <InputComp label="Name ({language})" name="name{suffix}" {form} {errors} />
	 *       {/snippet}
	 *     </LanguageTabs>
	 */
	let {
		form,
		errors,
		fields,
		children
	}: {
		/** The superforms `$form` store, to count what each language has filled in. */
		form: Readable<Record<string, unknown>>;
		/** The superforms `$errors` store, to mark a tab holding an error. */
		errors: Readable<Record<string, unknown>>;
		/** The translated fields' base names: `name` stands for `nameEn`, `nameAm`, … */
		fields: string[];
		/** One language's fields. `language` is its English name, for the labels. */
		children: Snippet<[{ lang: Lang; suffix: (typeof LANG_SUFFIX)[Lang]; language: string }]>;
	} = $props();

	const uid = $props.id();
	let active = $state<Lang>('en');

	/** A rich editor left empty still holds `<p></p>`. */
	const filled = (value: unknown) =>
		typeof value === 'string' && value.replace(/<[^>]*>/g, '').trim() !== '';

	const status = $derived(
		Object.fromEntries(
			LANGS.map((lang) => {
				const names = fields.map((field) => `${field}${LANG_SUFFIX[lang]}`);
				return [
					lang,
					{
						error: names.some((name) => Boolean($errors[name])),
						count: names.filter((name) => filled($form[name])).length
					}
				];
			})
		) as Record<Lang, { error: boolean; count: number }>
	);

	/*
	 * A refused save whose errors are all in closed tabs opens the first of them, so the reader
	 * sees what to fix. Only when errors arrive: choosing another tab afterwards is left alone.
	 */
	$effect(() => {
		const withError = LANGS.filter((lang) => status[lang].error);
		if (withError.length && !withError.includes(untrack(() => active))) active = withError[0];
	});

	/** The language of the panel an element sits in. */
	const langOf = (target: EventTarget | null) => {
		const lang = (target as HTMLElement | null)?.closest<HTMLElement>('[data-lang]')?.dataset.lang;
		return lang && (LANGS as readonly string[]).includes(lang) ? (lang as Lang) : null;
	};

	function revealOn(node: HTMLElement) {
		// The error summary asks for a field in a closed tab to be shown.
		const reveal = (event: Event) => {
			const lang = langOf(event.target);
			if (lang) active = lang;
		};
		/*
		 * The browser's own check (`required`) stops a save before superforms sees it, then tries to
		 * point at the field — and cannot, when its tab is closed: the save silently did nothing.
		 * The tab is opened synchronously, so the browser finds the field showing. Only the first
		 * refused field counts; the browser points at that one.
		 */
		let openedAt = -Infinity;
		const invalid = (event: Event) => {
			const lang = langOf(event.target);
			if (!lang || !(event.target as HTMLElement).closest('[hidden]')) return;
			if (event.timeStamp - openedAt < 100) return;
			openedAt = event.timeStamp;
			flushSync(() => (active = lang));
		};
		node.addEventListener('kit-reveal', reveal);
		node.addEventListener('invalid', invalid, true);
		return () => {
			node.removeEventListener('kit-reveal', reveal);
			node.removeEventListener('invalid', invalid, true);
		};
	}

	/** Arrow keys move along the tabs, as a tab list should. */
	function onKeydown(event: KeyboardEvent) {
		const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (!step) return;
		event.preventDefault();
		const next = LANGS[(LANGS.indexOf(active) + step + LANGS.length) % LANGS.length];
		active = next;
		document.getElementById(`${uid}-tab-${next}`)?.focus();
	}
</script>

<div class="flex flex-col gap-3" {@attach revealOn}>
	<div
		role="tablist"
		aria-label="Language"
		tabindex="-1"
		class="flex [scrollbar-width:thin] gap-1 overflow-x-auto overflow-y-hidden border-b"
		onkeydown={onKeydown}
	>
		{#each LANGS as lang (lang)}
			{@const on = active === lang}
			{@const s = status[lang]}
			<button
				type="button"
				role="tab"
				id="{uid}-tab-{lang}"
				aria-selected={on}
				aria-controls="{uid}-panel-{lang}"
				tabindex={on ? 0 : -1}
				onclick={() => (active = lang)}
				class={[
					'-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
					on
						? 'border-primary font-medium text-foreground'
						: 'border-transparent text-muted-foreground hover:text-foreground'
				]}
			>
				{LANG_NAMES[lang]}
				{#if s.error}
					<CircleAlert class="size-3.5 text-destructive" aria-label="has an error" />
				{:else}
					<span
						class={[
							'rounded-full px-1.5 text-xs tabular-nums',
							s.count === fields.length ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
						]}
						aria-label="{s.count} of {fields.length} filled">{s.count}/{fields.length}</span
					>
				{/if}
			</button>
		{/each}
	</div>

	{#each LANGS as lang (lang)}
		<div
			role="tabpanel"
			id="{uid}-panel-{lang}"
			aria-labelledby="{uid}-tab-{lang}"
			data-lang={lang}
			hidden={active !== lang}
			class={['flex flex-col gap-2', lang === 'ar' && 'rtl']}
		>
			{#if lang !== 'en'}
				<p class="text-xs text-muted-foreground">
					Left empty, the website shows the English to {LANG_NAMES[lang]} readers.
				</p>
			{/if}
			{@render children({ lang, suffix: LANG_SUFFIX[lang], language: LANG_NAMES[lang] })}
		</div>
	{/each}
</div>

<style>
	/* Arabic is typed right to left; the labels and hints around it stay as the page reads. */
	.rtl :global(:is(input:not([type='hidden']), textarea, [contenteditable='true'])) {
		direction: rtl;
	}
</style>
