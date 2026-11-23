<script lang="ts">
	import { page } from '$app/state';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { useKit } from '@nahu/admin-kit/context';

	/**
	 * Where the page sits in the menu — "Sales › Orders" — read off the same `NAVIGATION` the
	 * sidebar draws, hidden setup lists included. On a record's own page the list is a link back
	 * to it; the record's name is the page's heading, so it is not repeated here.
	 */
	const kit = useKit();
	const home = '/dashboard';

	const crumbs = $derived.by(() => {
		const path = page.url.pathname;
		let best: { group: string; title: string; url: string; grouped: boolean } | undefined;
		for (const item of kit.navigation) {
			for (const link of item.items ?? [item]) {
				const under =
					link.url === home ? path === home : path === link.url || path.startsWith(link.url + '/');
				if (under && link.url.length > (best?.url.length ?? -1)) {
					best = {
						group: item.title,
						title: link.title,
						url: link.url,
						grouped: Boolean(item.items)
					};
				}
			}
		}
		if (!best || best.url === home) return [];

		const onList = path === best.url;
		const out: { label: string; href?: string }[] = [];
		if (best.grouped && best.group !== best.title) out.push({ label: best.group });
		out.push({ label: best.title, href: onList || !kit.canOpen(best.url) ? undefined : best.url });
		return out;
	});
</script>

{#if crumbs.length}
	<nav aria-label="Breadcrumb" class="min-w-0">
		<ol class="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
			{#each crumbs as crumb, i (crumb.label)}
				{#if i > 0}<li aria-hidden="true"><ChevronRight class="size-3.5 shrink-0" /></li>{/if}
				<li
					class="truncate {i === crumbs.length - 1 && !crumb.href
						? 'font-medium text-foreground'
						: ''}"
				>
					{#if crumb.href}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a path from NAVIGATION -->
						<a href={crumb.href} class="hover:text-foreground hover:underline">{crumb.label}</a>
					{:else}
						{crumb.label}
					{/if}
				</li>
			{/each}
		</ol>
	</nav>
{/if}
