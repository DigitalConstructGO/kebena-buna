<script lang="ts">
	import { resolve } from '$app/paths';
	import { ModeWatcher } from 'mode-watcher';
	import Coffee from '@lucide/svelte/icons/coffee';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import * as Sidebar from '@nahu/admin-kit/components/ui/sidebar/index.js';
	import KitProvider from '@nahu/admin-kit/components/KitProvider.svelte';
	import AppSidebar from '@nahu/admin-kit/components/shell/AppSidebar.svelte';
	import GlobalSearch from '#lib/components/GlobalSearch.svelte';
	import DarkMode from '@nahu/admin-kit/components/shell/DarkMode.svelte';
	import DateText from '@nahu/admin-kit/components/DateText.svelte';
	import UserMenu from '#lib/components/UserMenu.svelte';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { access } from '#lib/access.ts';
	import { ENTITIES, NAVIGATION } from '#lib/navigation.ts';

	let { data, children } = $props();

	/** "Roast level" → "roast level": the kit's label reads mid-sentence. */
	const lower = (entity: string) => entity.charAt(0).toLowerCase() + entity.slice(1);
	/*
	 * One word for making a record: "New …", as on every page-level create button here. The kit's
	 * lookup screens said "+ Add New Roast level"; "Add" is kept for putting something on a record.
	 */
	const labels = {
		lookupAddNewTitle: (entity: string) => `+ New ${lower(entity)}`
	};
</script>

<ModeWatcher />

<KitProvider
	{access}
	navigation={NAVIGATION}
	entities={ENTITIES}
	{labels}
	permList={data.permList}
	isSuperAdmin={data.isSuperAdmin}
>
	<Sidebar.Provider>
		<AppSidebar>
			{#snippet footer()}
				<span class="truncate text-xs">Kebena General Trading PLC</span>
			{/snippet}
			{#snippet logo()}
				<a href={resolve('/dashboard')} class="flex items-center gap-3 px-1 py-2">
					<span
						class="grid size-9 grid-cols-1 place-items-center rounded-lg bg-primary text-primary-foreground"
					>
						<Coffee class="size-5" />
					</span>
					<span class="leading-tight">
						<span class="block text-base font-semibold">Kebena Coffee</span>
						<span class="block text-xs text-muted-foreground">Museum & roastery</span>
					</span>
				</a>
			{/snippet}
		</AppSidebar>
		<main class="min-w-0 flex-1 px-2">
			<div
				class="sticky top-2 z-40 flex items-center justify-between gap-2 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur-md"
			>
				<div class="flex min-w-0 items-center gap-2">
					<Sidebar.Trigger />
					<Breadcrumbs />
				</div>
				<div class="flex shrink-0 items-center gap-1.5 sm:gap-3">
					<span class="hidden items-center gap-1.5 text-sm text-muted-foreground lg:flex">
						<CalendarDays class="size-4" />
						<DateText value={data.today} both />
					</span>
					<GlobalSearch />
					<DarkMode />
					<UserMenu account={data.account} />
				</div>
			</div>
			<div class="p-1 pt-4 pb-16 sm:p-2 sm:pt-4">
				{@render children()}
			</div>
		</main>
	</Sidebar.Provider>
</KitProvider>
