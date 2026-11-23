<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { SubmitFunction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import ActionForm from '@nahu/admin-kit/formComponents/ActionForm.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Checkbox } from '@nahu/admin-kit/components/ui/checkbox/index.js';
	import { localClock } from '@nahu/admin-kit/time';
	import { formatDate } from '#lib/format.ts';
	import { ticketCodeOf } from '#lib/ticketQr.ts';

	let { data } = $props();

	type Ticket = (typeof data.tickets)[number];

	let query = $state('');
	let slotId = $state<number | null>(null);
	let showIn = $state(false);
	/** How many to admit, per ticket: everyone still to come unless the desk says fewer. */
	let chosen = $state<Record<number, number>>({});
	/** This desk's last few check-ins, newest first. */
	let recent = $state<{ code: string; people: number; at: Date }[]>([]);
	let searchBox = $state<HTMLInputElement | null>(null);
	let quickForm = $state<HTMLFormElement>();
	let quickId = $state('');
	let notFound = $state<string | null>(null);

	const remainingOf = (t: Ticket) => Math.max(t.admits - t.checkedIn, 0);
	const countFor = (t: Ticket) => Math.min(chosen[t.id] ?? remainingOf(t), remainingOf(t));
	const nameOf = (t: Ticket) => t.holderName || t.customer || 'No name';

	/** A scanned signed QR (`KT1.CODE.…`), a link ending in a code, or a typed code. */
	const codeOf = ticketCodeOf;

	const matches = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const code = codeOf(query);
		const digits = q.replace(/\D/g, '');
		return data.tickets
			.filter((t) => slotId === null || t.slotId === slotId)
			.filter((t) => showIn || remainingOf(t) > 0 || (q !== '' && t.code === code))
			.filter(
				(t) =>
					q === '' ||
					t.code.includes(code) ||
					nameOf(t).toLowerCase().includes(q) ||
					(digits.length >= 4 && (t.phone ?? '').replace(/\D/g, '').includes(digits))
			)
			.sort((a, b) => Number(remainingOf(b) > 0) - Number(remainingOf(a) > 0));
	});

	const people = $derived(data.tickets.reduce((sum, t) => sum + t.admits, 0));
	const inside = $derived(data.tickets.reduce((sum, t) => sum + t.checkedIn, 0));

	/** Enter in the search box — what a barcode scanner sends — admits an exact code at once. */
	async function onSearchKey(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		const code = codeOf(query);
		if (!code) return;
		const hit = data.tickets.find((t) => t.code === code);
		if (!hit) {
			notFound = code;
			return;
		}
		notFound = null;
		if (remainingOf(hit) === 0) {
			// Already in: show its card, which says so, rather than admitting anyone twice.
			showIn = true;
			return;
		}
		quickId = String(hit.id);
		await tick();
		quickForm?.requestSubmit();
	}

	/** After a check-in: note it, clear the box, and be ready for the next scan. */
	function afterCheckIn(id: number, code: string, people: number): SubmitFunction {
		return () =>
			async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === 'success') {
					recent = [{ code, people, at: new Date() }, ...recent].slice(0, 6);
					delete chosen[id];
					query = '';
					notFound = null;
				}
				searchBox?.focus();
			};
	}

	const quickTicket = $derived(data.tickets.find((t) => String(t.id) === quickId));

	onMount(() => {
		searchBox?.focus();
		// Other desks and the gate scanners admit people too: keep the counts current.
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') void invalidateAll();
		}, 30_000);
		return () => clearInterval(timer);
	});
</script>

<PageHeader
	title="Check-in desk"
	description="{formatDate(data.today)} · {inside} of {people} {people === 1
		? 'visitor'
		: 'visitors'} in. Scan a ticket, or type a code, name or phone number."
/>

<div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
	<div class="flex min-w-0 flex-col gap-4">
		<div class="relative">
			<ScanLine
				class="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				bind:ref={searchBox}
				bind:value={query}
				type="search"
				inputmode="search"
				autocomplete="off"
				aria-label="Ticket code, name or phone"
				placeholder="Scan or type a code, name or phone"
				class="h-14 pl-11 text-lg"
				onkeydown={onSearchKey}
				oninput={() => (notFound = null)}
			/>
		</div>

		{#if notFound}
			<Notice tone="warning">
				No ticket for today has the code <strong>{notFound}</strong>.
				<a
					class="underline"
					href="{resolve('/dashboard/visits/tickets')}?search={encodeURIComponent(notFound)}"
				>
					Look it up in all tickets
				</a>
				— it may be for another day, or cancelled.
			</Notice>
		{/if}

		<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Entry time">
			<Button
				variant={slotId === null ? 'default' : 'outline'}
				size="sm"
				onclick={() => (slotId = null)}
			>
				All times
			</Button>
			{#each data.slots as slot (slot.id)}
				<Button
					variant={slotId === slot.id ? 'default' : 'outline'}
					size="sm"
					class="tabular-nums"
					aria-pressed={slotId === slot.id}
					title="{slot.location} · {slot.sold} of {slot.capacity} sold"
					onclick={() => (slotId = slotId === slot.id ? null : slot.id)}
				>
					{localClock(slot.startsAt)}
					<span class="text-xs opacity-75">{slot.checkedIn}/{slot.sold}</span>
				</Button>
			{/each}
			<label
				class="ml-auto flex min-h-9 cursor-pointer items-center gap-2 text-sm text-muted-foreground"
			>
				<Checkbox bind:checked={showIn} />
				Show who is already in
			</label>
		</div>

		{#if matches.length === 0}
			<p class="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
				{#if data.tickets.length === 0}
					No tickets for today.
				{:else if query}
					Nothing matches “{query}”.
				{:else}
					Everyone booked{slotId === null ? '' : ' for this time'} is in.
				{/if}
			</p>
		{/if}

		<ul class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
			{#each matches as t (t.id)}
				{@const remaining = remainingOf(t)}
				{@const n = countFor(t)}
				<li
					class={[
						'flex flex-col gap-3 rounded-xl border bg-card p-4',
						remaining === 0 && 'opacity-60'
					]}
				>
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<a
								href={resolve('/dashboard/visits/tickets/[id]', { id: String(t.id) })}
								class="font-mono text-lg font-semibold hover:underline"
							>
								{t.code}
							</a>
							<p class="truncate font-medium">{nameOf(t)}</p>
							<p class="truncate text-sm text-muted-foreground">
								{[t.event || (t.slotStart ? localClock(t.slotStart) : ''), t.type, t.audience]
									.filter(Boolean)
									.join(' · ')}
							</p>
						</div>
						<span
							class={[
								'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
								remaining === 0
									? 'bg-primary/10 text-primary'
									: t.checkedIn > 0
										? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
										: 'bg-muted text-muted-foreground'
							]}
						>
							{t.checkedIn} of {t.admits} in
						</span>
					</div>

					{#if remaining > 0}
						<ActionForm
							action="?/checkIn"
							reset={false}
							submit={afterCheckIn(t.id, t.code, n)}
							class="flex items-center gap-2"
						>
							{#snippet children({ busy })}
								<input type="hidden" name="id" value={t.id} />
								<input type="hidden" name="headcount" value={n} />
								{#if remaining > 1}
									<div
										class="flex items-center rounded-lg border"
										role="group"
										aria-label="People to admit on {t.code}"
									>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											class="size-12"
											aria-label="One fewer"
											disabled={n <= 1}
											onclick={() => (chosen[t.id] = n - 1)}
										>
											<Minus />
										</Button>
										<span
											class="w-8 text-center text-lg font-semibold tabular-nums"
											aria-live="polite"
										>
											{n}
										</span>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											class="size-12"
											aria-label="One more"
											disabled={n >= remaining}
											onclick={() => (chosen[t.id] = n + 1)}
										>
											<Plus />
										</Button>
									</div>
								{/if}
								<Button type="submit" class="h-12 flex-1 text-base" disabled={!!busy}>
									{#if busy}<LoadingBtn name="Checking in" />{:else}<CircleCheck class="size-5" /> Check
										in {n}{/if}
								</Button>
							{/snippet}
						</ActionForm>
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	<aside class="flex flex-col gap-2 lg:sticky lg:top-20 lg:self-start">
		<p class="text-sm font-medium text-muted-foreground">Checked in at this desk</p>
		{#if recent.length === 0}
			<p class="text-sm text-muted-foreground">Nobody yet.</p>
		{:else}
			<ul class="flex flex-col divide-y rounded-lg border">
				{#each recent as r, i (i)}
					<li class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
						<span class="font-mono">{r.code}</span>
						<span class="text-muted-foreground tabular-nums">{r.people} · {localClock(r.at)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>
</div>

<!-- What a scan submits: the whole party on the ticket whose code was entered. -->
<ActionForm
	action="?/checkIn"
	reset={false}
	bind:element={quickForm}
	submit={quickTicket
		? afterCheckIn(quickTicket.id, quickTicket.code, remainingOf(quickTicket))
		: undefined}
	class="hidden"
>
	<input type="hidden" name="id" value={quickId} />
</ActionForm>
