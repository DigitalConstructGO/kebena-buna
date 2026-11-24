<!--
	The top bar's search (Ctrl/⌘ K): the kit's page palette, plus the records staff are handed at the
	desk — order and booking numbers, phones, ticket and card codes, names — from
	`/dashboard/search`, grouped by kind and only what the viewer may open. Pages are matched here;
	records on the server, a moment after typing stops.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Disc from '@lucide/svelte/icons/disc';
	import SearchIcon from '@lucide/svelte/icons/search';
	import * as Command from '@nahu/admin-kit/components/ui/command/index.js';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { searchEntries } from '@nahu/admin-kit/navigation';
	import { useKit } from '@nahu/admin-kit/context';

	type Hit = { kind: string; label: string; detail: string | null; url: string };
	type Group = { group: string; hits: Hit[] };

	const kit = useKit();
	const pages = $derived(searchEntries(kit.navigation, (u) => kit.canOpen(u), kit.searchExtra));

	let open = $state(false);
	let query = $state('');
	let groups = $state<Group[]>([]);
	let loading = $state(false);

	const term = $derived(query.trim().toLowerCase());
	const matchedPages = $derived(
		(term ? pages.filter((p) => p.label.toLowerCase().includes(term)) : pages).slice(
			0,
			term ? 8 : 50
		)
	);

	// Records: asked for once typing settles; a newer query cancels the one in flight.
	let timer: ReturnType<typeof setTimeout> | undefined;
	let inFlight: AbortController | undefined;
	function lookUp() {
		clearTimeout(timer);
		inFlight?.abort();
		const q = query.trim();
		if (q.length < 2) {
			groups = [];
			loading = false;
			return;
		}
		loading = true;
		const ctrl = (inFlight = new AbortController());
		timer = setTimeout(() => void ask(q, ctrl), 200);
	}
	async function ask(q: string, ctrl: AbortController) {
		try {
			const res = await fetch(`/dashboard/search?q=${encodeURIComponent(q)}`, {
				signal: ctrl.signal
			});
			groups = res.ok ? ((await res.json()) as { groups: Group[] }).groups : [];
		} catch {
			// aborted by a newer query, or offline: keep what is shown
		} finally {
			if (!ctrl.signal.aborted) loading = false;
		}
	}

	/** Opened or closed; a fresh box each time. */
	const setOpen = (v: boolean) => {
		open = v;
		if (!v) {
			query = '';
			lookUp();
		}
	};

	// The shortcut as this keyboard writes it, known only in the browser (as the kit's search).
	let mac = $state(false);
	onMount(() => {
		mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey) {
			event.preventDefault();
			setOpen(!open);
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<DialogComp title="Search" variant="ghost" bind:open={() => open, setOpen}>
	{#snippet trigger(props)}
		<Button
			size="sm"
			variant="ghost"
			class="w-auto gap-2 px-3 text-muted-foreground"
			title="Search orders, customers, tickets and pages"
			aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}
			{...props}
		>
			<SearchIcon />
			<span class="hidden text-sm lg:inline">Search</span>
			<kbd
				class="hidden rounded border bg-muted px-1.5 font-sans text-[11px] font-medium md:inline-block"
			>
				{mac ? '⌘' : 'Ctrl'} K
			</kbd>
		</Button>
	{/snippet}
	<Command.Root shouldFilter={false} class="rounded-lg shadow-md md:min-w-140">
		<Command.Input
			bind:value={query}
			oninput={lookUp}
			placeholder="Order or booking number, phone, ticket or card code, name, page…"
			type="search"
		/>
		<Command.List class="max-h-[60vh]">
			{#if !groups.length && !matchedPages.length}
				<Command.Empty>{loading ? 'Searching…' : 'Nothing found.'}</Command.Empty>
			{/if}
			{#each groups as g (g.group)}
				<Command.Group heading={g.group}>
					{#each g.hits as hit (hit.url)}
						<Command.LinkItem href={hit.url} value={hit.url} onSelect={() => setOpen(false)}>
							<span class="font-medium">{hit.label}</span>
							{#if hit.detail}
								<span class="truncate text-xs text-muted-foreground">{hit.detail}</span>
							{/if}
						</Command.LinkItem>
					{/each}
				</Command.Group>
			{/each}
			{#if matchedPages.length}
				<Command.Group heading="Pages">
					{#each matchedPages as item (item.url)}
						<Command.LinkItem
							href={item.url}
							value={`page:${item.url}`}
							onSelect={() => setOpen(false)}
						>
							<Disc />
							{item.label}
						</Command.LinkItem>
					{/each}
				</Command.Group>
			{/if}
		</Command.List>
	</Command.Root>
</DialogComp>
