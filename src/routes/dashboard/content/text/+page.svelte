<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Search from '@lucide/svelte/icons/search';
	import Pencil from '@lucide/svelte/icons/pencil';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Textarea } from '@nahu/admin-kit/components/ui/textarea/index.js';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { LANGS, LANG_NAMES, LANG_SUFFIX } from '#lib/languages.ts';

	let { data } = $props();

	/** The keys whose editor is open. */
	let open = $state<Record<string, boolean>>({});
	let saving = $state<string | null>(null);

	const label = (key: string) => {
		const rest = key.split('_').slice(1).join(' ');
		return rest.charAt(0).toUpperCase() + rest.slice(1);
	};
	const rows = (text: string) =>
		Math.min(12, Math.max(2, Math.ceil(text.length / 90) + (text.match(/\n/g)?.length ?? 0)));
	const heading = $derived(
		data.q
			? `Matching “${data.q}”`
			: data.edited
				? 'Edited on the dashboard'
				: (data.groups.find((g) => g.prefix === data.group)?.label ?? data.group)
	);
</script>

<PageHeader
	title="Site text"
	description="Every word on the public website, in all six languages: headings, buttons, page copy, form messages. Change a line here and the website shows it at once; Reset puts back the written wording. Words in braces, like {'{name}'}, are filled in by the site — keep them as they are."
/>

<div class="mt-4 grid gap-6 lg:grid-cols-[15rem_1fr]">
	<nav aria-label="Pages" class="flex flex-col gap-1 text-sm">
		<form method="GET" class="relative mb-2">
			<Search class="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
			<Input
				name="q"
				value={data.q}
				placeholder="Search any language"
				class="pl-8"
				aria-label="Search the site's words"
			/>
		</form>
		<a
			href="{resolve('/dashboard/content/text')}?edited=1"
			class={[
				'flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted',
				{ 'bg-muted': data.edited }
			]}
			aria-current={data.edited ? 'page' : undefined}
		>
			<span>Edited lines</span>
			<span class="text-muted-foreground tabular-nums">{data.editedTotal}</span>
		</a>
		<hr class="my-1" />
		{#each data.groups as g (g.prefix)}
			{@const here = !data.q && !data.edited && g.prefix === data.group}
			<a
				href="{resolve('/dashboard/content/text')}?group={g.prefix}"
				class={[
					'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted',
					{ 'bg-muted font-medium': here }
				]}
				aria-current={here ? 'page' : undefined}
			>
				<span>{g.label}</span>
				<span class="shrink-0 text-muted-foreground tabular-nums">
					{#if g.edited}<span class="text-primary">{g.edited} ·</span>{/if}
					{g.total}
				</span>
			</a>
		{/each}
	</nav>

	<section aria-label={heading} class="min-w-0">
		<h2 class="mb-3 text-lg font-semibold">{heading}</h2>
		{#if !data.entries.length}
			<p class="text-sm text-muted-foreground">
				{data.q ? 'No line on the website matches that.' : 'Nothing here yet.'}
			</p>
		{/if}
		<ul class="divide-y divide-border rounded-lg border">
			{#each data.entries as e (e.key)}
				{@const edited = LANGS.filter((l) => e.edit[l])}
				<li class="p-3">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-sm font-medium">
								{label(e.key)}
								{#each edited as l (l)}
									<Badge variant="secondary" class="ml-1 align-middle">Edited · {l}</Badge>
								{/each}
							</p>
							<p class="font-mono text-xs text-muted-foreground">{e.key}</p>
							{#if !open[e.key]}
								<p class="mt-1 line-clamp-3 text-sm whitespace-pre-line">
									{e.edit.en || e.written.en}
								</p>
							{/if}
						</div>
						{#if !open[e.key]}
							<Button variant="outline" size="sm" onclick={() => (open[e.key] = true)}>
								<Pencil class="size-4" /> Edit
							</Button>
						{/if}
					</div>

					{#if open[e.key]}
						<form
							method="POST"
							action="?/save"
							class="mt-3 grid gap-3"
							use:enhance={() => {
								saving = e.key;
								return async ({ result, update }) => {
									await update({ reset: false });
									saving = null;
									if (result.type === 'success') open[e.key] = false;
								};
							}}
						>
							<input type="hidden" name="key" value={e.key} />
							{#each LANGS as l (l)}
								{@const value = e.edit[l] ?? e.written[l]}
								<label class="grid gap-1 text-sm">
									<span class="flex items-center gap-2">
										{LANG_NAMES[l]}
										{#if e.edit[l]}<Badge variant="secondary">Edited</Badge>{/if}
									</span>
									<Textarea
										name="text{LANG_SUFFIX[l]}"
										{value}
										rows={rows(value)}
										dir={l === 'ar' ? 'rtl' : 'auto'}
										lang={l}
										placeholder={e.written[l] || 'Shows the English until written'}
									/>
									{#if e.edit[l] && e.written[l]}
										<span class="text-xs text-muted-foreground">Written: {e.written[l]}</span>
									{/if}
								</label>
							{/each}
							<div class="flex flex-wrap gap-2">
								<Button type="submit" size="sm" disabled={saving === e.key}>
									{saving === e.key ? 'Saving…' : 'Save'}
								</Button>
								{#if edited.length}
									<Button type="submit" size="sm" variant="outline" formaction="?/reset">
										<RotateCcw class="size-4" /> Reset to written
									</Button>
								{/if}
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onclick={() => (open[e.key] = false)}
								>
									Cancel
								</Button>
							</div>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
		{#if data.more}
			<p class="mt-2 text-sm text-muted-foreground">
				{data.more} more — narrow the search to see them.
			</p>
		{/if}
	</section>
</div>
