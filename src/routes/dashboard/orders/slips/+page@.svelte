<script lang="ts">
	import Printer from '@lucide/svelte/icons/printer';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { deliveryName, formatDateTime } from '#lib/format.ts';

	/**
	 * Packing slips, printed outside the dashboard layout (`+page@`) so they print as paper and not
	 * as a picture of the app. Black on white whatever the screen's theme, one order per page.
	 */
	let { data } = $props();
	const lh = $derived(data.letterhead);

	type Slip = (typeof data.slips)[number];
	/** Where it goes, in the order a rider reads it. */
	const destination = (s: Slip) => {
		if (s.deliveryMethod === 'pickup') return [`Pickup at ${s.pickupAt || 'the shop'}`];
		if (s.deliveryMethod === 'none') return ['Handed over at the counter'];
		const a = s.address;
		if (!a) return ['No delivery address on the order'];
		return [
			a.recipientName,
			a.phone,
			a.line1,
			[a.woreda, a.area, a.city].filter(Boolean).join(', '),
			a.landmark ? `Landmark: ${a.landmark}` : null
		].filter((x): x is string => Boolean(x));
	};
	const bags = (s: Slip) => s.lines.reduce((sum, l) => sum + l.quantity, 0);
</script>

<svelte:head>
	<title
		>{data.slips.length === 1
			? `Packing slip ${data.slips[0].number}`
			: `${data.slips.length} packing slips`}</title
	>
</svelte:head>

<div class="min-h-screen bg-white text-black">
	<div class="mx-auto flex max-w-3xl items-center justify-between gap-2 p-4 print:hidden">
		<Button variant="outline" onclick={() => history.back()}>
			<ArrowLeft class="size-4" /> Back
		</Button>
		<span class="text-sm text-neutral-600">
			{data.slips.length}
			{data.slips.length === 1 ? 'slip' : 'slips'}, one per page
		</span>
		<Button onclick={() => window.print()}><Printer class="size-4" /> Print</Button>
	</div>

	{#each data.slips as s (s.id)}
		<article
			class="mx-auto flex max-w-3xl break-after-page flex-col gap-5 p-8 text-sm print:p-0 [&:last-child]:break-after-auto"
		>
			<header class="flex items-start justify-between gap-6 border-b border-black pb-3">
				<div>
					<p class="text-xl font-bold">{lh.name}</p>
					<p>{lh.legalName}</p>
					{#if lh.address}<p>{lh.address}</p>{/if}
					{#if lh.phone}<p>Tel. {lh.phone}</p>{/if}
					{#if lh.tin}<p>TIN {lh.tin}</p>{/if}
				</div>
				<div class="text-right">
					<p class="text-lg font-semibold uppercase">Packing slip</p>
					<p class="font-mono text-base font-semibold">{s.number}</p>
					<p>Placed {formatDateTime(s.placedAt)}</p>
				</div>
			</header>

			<section class="grid grid-cols-2 gap-6">
				<div>
					<p class="text-xs font-semibold uppercase">Customer</p>
					<p class="font-medium">{s.customer}</p>
					{#if s.phone}<p>{s.phone}</p>{/if}
				</div>
				<div>
					<p class="text-xs font-semibold uppercase">{deliveryName(s.deliveryMethod)}</p>
					{#each destination(s) as line, i (i)}<p>{line}</p>{/each}
					{#if s.zone}<p>Zone: {s.zone}</p>{/if}
					{#if s.rider}<p>Rider: {s.rider}</p>{/if}
					{#if s.courier}<p>
							Courier: {s.courier}{s.trackingNumber ? ` · ${s.trackingNumber}` : ''}
						</p>{/if}
				</div>
			</section>

			<table class="w-full border-collapse">
				<thead>
					<tr class="border-b-2 border-black text-left">
						<th class="w-8 py-1.5 pr-2">✓</th>
						<th class="py-1.5 pr-2">Item</th>
						<th class="py-1.5 pr-2">Roast</th>
						<th class="py-1.5 pr-2">Grind</th>
						<th class="py-1.5 pr-2">Packaging</th>
						<th class="py-1.5 text-right">Qty</th>
					</tr>
				</thead>
				<tbody>
					{#each s.lines as l, i (i)}
						<tr class="border-b border-neutral-400 align-top">
							<td class="py-2 pr-2">
								<span class="inline-block size-4 border border-black"></span>
							</td>
							<td class="py-2 pr-2">
								{l.description}
								{#if l.sku}<span class="block font-mono text-xs text-neutral-600">
										{l.sku}
									</span>{/if}
							</td>
							<td class="py-2 pr-2">{l.roast || '—'}</td>
							<td class="py-2 pr-2">{l.grind || '—'}</td>
							<td class="py-2 pr-2">{l.packaging || '—'}</td>
							<td class="py-2 text-right text-base font-semibold tabular-nums">{l.quantity}</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="py-3 text-center">Nothing to pack on this order.</td></tr>
					{/each}
				</tbody>
				{#if s.lines.length}
					<tfoot>
						<tr>
							<td colspan="5" class="pt-2 text-right font-semibold">Items</td>
							<td class="pt-2 text-right font-semibold tabular-nums">{bags(s)}</td>
						</tr>
					</tfoot>
				{/if}
			</table>

			{#if s.customerNote}
				<section class="border border-black p-3">
					<p class="text-xs font-semibold uppercase">Customer's note</p>
					<p>{s.customerNote}</p>
				</section>
			{/if}

			<footer class="mt-6 grid grid-cols-2 gap-10">
				<div class="border-t border-black pt-1">Packed by</div>
				<div class="border-t border-black pt-1">Received by (name, signature, date)</div>
			</footer>
		</article>
	{/each}
</div>
