<script lang="ts">
	import type { ComponentProps, Snippet } from 'svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import RichEditor from '@nahu/admin-kit/formComponents/RichEditor.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { PUBLISH_STATUSES } from '#lib/constants.ts';
	import { choicesOf } from '#lib/format.ts';
	import LanguageTabs from '#lib/components/LanguageTabs.svelte';

	/**
	 * The fields of a website page or blog post: the title, summary and rich body in English and in
	 * each translation (Amharic, Afaan Oromo, Arabic), its address and publish status, SEO, and a
	 * picture. The bodies are sanitised on the server when saved; pictures dropped into a body go to
	 * `/dashboard/upload`.
	 *
	 * A new one's address follows its English title until the address is typed by hand, and its
	 * status is picked here; a saved one's status is changed by the buttons in the page header.
	 * `settings` holds what differs between a page and a post (parent and template, or category and
	 * author).
	 */
	type Store = ComponentProps<typeof InputComp>['form'];
	let {
		form,
		errors,
		base,
		picture,
		pictureLabel,
		stored = '',
		isNew = false,
		summary = false,
		settings
	}: {
		form: Store;
		errors: Store;
		/** The public address prefix: `/` for pages, `/blog/` for posts. */
		base: string;
		/** The form key of the picture field (`heroImage`, `coverImage`). */
		picture: string;
		pictureLabel: string;
		/** The stored picture, shown while editing. */
		stored?: string;
		isNew?: boolean;
		/** Offer the excerpt fields (posts). */
		summary?: boolean;
		settings?: Snippet;
	} = $props();

	// svelte-ignore state_referenced_locally
	let slugFollowsTitle = $state(isNew);
	const slugify = (s: string) =>
		s
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 100);

	/** Typing the English title moves the address along, until the address is typed itself. */
	function followTitle() {
		if (!slugFollowsTitle) return;
		const next = slugify(String($form.titleEn ?? ''));
		if (next && next !== $form.slug) $form.slug = next;
	}

	const errorOf = (name: string) => {
		const e = $errors[name];
		return Array.isArray(e) ? String(e[0] ?? '') : '';
	};
</script>

<div class="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
	<div class="order-2 grid grid-cols-1 min-w-0 gap-6 xl:order-1">
		<PageSection title="Words">
			<Card.Root>
				<Card.Content class="pt-6">
					<LanguageTabs
						form={form as never}
						errors={errors as never}
						fields={summary
							? ['title', 'excerpt', 'body', 'seoTitle', 'seoDescription']
							: ['title', 'body', 'seoTitle', 'seoDescription']}
					>
						{#snippet children({ lang, suffix, language })}
							<!-- Typing the English title moves the address along. -->
							<div oninput={lang === 'en' ? followTitle : undefined} role="presentation">
								<InputComp label="Title ({language})" name="title{suffix}" {form} {errors} required={lang === 'en'} />
							</div>
							{#if summary}
								<InputComp
									label="Excerpt ({language})"
									name="excerpt{suffix}"
									type="textarea"
									rows={2}
									description={lang === 'en'
										? 'Shown in lists. Left empty, it is made from the start of the text.'
										: undefined}
									{form}
									{errors}
								/>
							{/if}
							<RichEditor
								name="body{suffix}"
								label="Text ({language})"
								bind:value={$form[`body${suffix}`]}
								error={errorOf(`body${suffix}`)}
								uploadUrl="/dashboard/upload"
								contentClass="prose prose-sm max-w-none dark:prose-invert"
							/>
							<div class="mt-4 grid grid-cols-1 gap-2 border-t pt-4 sm:grid-cols-2">
								<p class="col-span-full text-sm font-medium">
									Search engines
									<span class="font-normal text-muted-foreground"
										>— optional. Left empty, the title and the start of the text are used.</span
									>
								</p>
								<InputComp label="SEO title ({language})" name="seoTitle{suffix}" {form} {errors} />
								<InputComp
									label="SEO description ({language})"
									name="seoDescription{suffix}"
									type="textarea"
									rows={2}
									{form}
									{errors}
								/>
							</div>
						{/snippet}
					</LanguageTabs>
				</Card.Content>
			</Card.Root>
		</PageSection>
	</div>

	<div class="order-1 grid grid-cols-1 h-fit gap-6 xl:order-2">
		<PageSection title="On the website">
			<Card.Root>
				<Card.Content class="grid grid-cols-1 gap-2 pt-6">
					<div oninput={() => (slugFollowsTitle = false)} role="presentation">
						<InputComp
							label="Address"
							name="slug"
							description="At {base}{$form.slug || '…'}"
							{form}
							{errors}
							required
						/>
					</div>
					<!-- Once saved, the header's Publish / Unpublish / Archive buttons change the status. -->
					{#if isNew}
						<InputComp
							label="Status"
							name="publishStatus"
							type="select"
							items={choicesOf(PUBLISH_STATUSES)}
							{form}
							{errors}
							required
						/>
					{/if}
					{@render settings?.()}
				</Card.Content>
			</Card.Root>
		</PageSection>

		<PageSection title={pictureLabel} hint="Optional. A wide picture, about 1600 × 900 px.">
			<Card.Root>
				<Card.Content class="pt-6">
					<InputComp
						label={pictureLabel}
						name={picture}
						type="file"
						accept="image/*"
						image={stored}
						hideLabel
						{form}
						{errors}
					/>
				</Card.Content>
			</Card.Root>
		</PageSection>
	</div>
</div>
