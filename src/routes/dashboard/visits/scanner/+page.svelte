<script lang="ts">
	import { onMount } from 'svelte';
	import jsQR from 'jsqr';
	import Camera from '@lucide/svelte/icons/camera';
	import CameraOff from '@lucide/svelte/icons/camera-off';
	import Wifi from '@lucide/svelte/icons/wifi';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { localClock } from '@nahu/admin-kit/time';
	import { formatDate } from '#lib/format.ts';
	import { importQrKey, parseTicketQr, ticketCodeOf, verifyTicketQr } from '#lib/ticketQr.ts';

	let { data } = $props();

	type Ticket = (typeof data.tickets)[number];
	type Queued = { clientScanId: string; raw: string; headcount?: number; scannedAt: string; wasOffline: boolean };
	type Verdict = {
		tone: 'go' | 'again' | 'stop';
		title: string;
		detail?: string;
		ticket?: Ticket;
		admitted?: number;
	};

	const QUEUE_KEY = 'kb-scan-queue';
	const LIST_KEY = 'kb-scan-day';

	// svelte-ignore state_referenced_locally
	let tickets = $state<Ticket[]>(data.tickets);
	// svelte-ignore state_referenced_locally
	let today = $state(data.today);
	let queue = $state<Queued[]>([]);
	let online = $state(true);
	let syncing = $state(false);
	let lastSync = $state<Date | null>(null);
	let verdict = $state<Verdict | null>(null);
	/** A group ticket waiting for the gate to say how many came in. */
	let pending = $state<{ raw: string; ticket: Ticket; count: number } | null>(null);
	let recent = $state<{ code: string; title: string; tone: Verdict['tone']; at: Date }[]>([]);
	let typed = $state('');
	let cameraOn = $state(false);
	let cameraError = $state<string | null>(null);
	let video = $state<HTMLVideoElement>();
	let key = $state<CryptoKey | null>(null);
	let stream: MediaStream | null = null;
	let lastRead = { raw: '', at: 0 };

	const byCode = $derived(new Map(tickets.map((t) => [t.code, t])));
	const inside = $derived(tickets.reduce((sum, t) => sum + t.checkedIn, 0));
	const expected = $derived(tickets.reduce((sum, t) => sum + t.admits, 0));

	const save = (k: string, v: unknown) => {
		try {
			localStorage.setItem(k, JSON.stringify(v));
		} catch {
			// a full or blocked storage only loses the offline copy
		}
	};
	const load = <T,>(k: string): T | null => {
		try {
			const v = localStorage.getItem(k);
			return v ? (JSON.parse(v) as T) : null;
		} catch {
			return null;
		}
	};

	const who = (t: Ticket) => t.holder || t.customer || '';
	const label = (t: Ticket) => `${t.audience} · ${t.type}`.toUpperCase();

	/** Reads one scan, decides on the device, and queues it for the server. */
	async function handle(raw: string, headcount?: number) {
		const qr = parseTicketQr(raw);
		if (qr && key && !(await verifyTicketQr(qr, key))) {
			return show(raw, { tone: 'stop', title: 'Not a Kebena ticket', detail: 'The QR code is not signed by Kebena.' });
		}
		if (qr && qr.visitDate !== today) {
			return show(raw, { tone: 'stop', title: 'Wrong day', detail: `This ticket is for ${formatDate(qr.visitDate)}.` });
		}
		const code = ticketCodeOf(raw);
		const t = byCode.get(code);
		if (!t) {
			return show(raw, { tone: 'stop', title: 'Not on today’s list', detail: `${code} — check it at the desk.` });
		}
		const remaining = Math.max(t.admits - t.checkedIn, 0);
		if (remaining === 0) {
			const first = t.firstCheckedInAt ? localClock(new Date(t.firstCheckedInAt)) : 'earlier';
			return show(raw, { tone: 'again', title: 'Re-entry', detail: `First checked in at ${first}.`, ticket: t });
		}
		if (remaining > 1 && headcount === undefined) {
			pending = { raw, ticket: t, count: remaining };
			return;
		}
		const people = Math.min(headcount ?? remaining, remaining);
		t.checkedIn += people;
		t.firstCheckedInAt ??= new Date();
		const rest = t.admits - t.checkedIn;
		show(
			raw,
			{
				tone: 'go',
				title: people === 1 ? 'Admit 1' : `Admit ${people}`,
				detail: rest ? `${rest} more on this ticket still to come.` : undefined,
				ticket: t,
				admitted: people
			},
			people
		);
	}

	function show(raw: string, v: Verdict, headcount?: number) {
		pending = null;
		verdict = v;
		recent = [{ code: v.ticket?.code ?? ticketCodeOf(raw), title: v.title, tone: v.tone, at: new Date() }, ...recent].slice(0, 8);
		enqueue({ clientScanId: crypto.randomUUID(), raw, headcount, scannedAt: new Date().toISOString(), wasOffline: !online });
		navigator.vibrate?.(v.tone === 'go' ? 80 : [60, 60, 60]);
	}

	function enqueue(scan: Queued) {
		queue = [...queue, scan];
		save(QUEUE_KEY, queue);
		save(LIST_KEY, { today, tickets });
		void sync();
	}

	/** Sends the queue; what the server settled leaves it, the rest waits for the next try. */
	async function sync() {
		if (syncing || !queue.length || !navigator.onLine) return;
		syncing = true;
		const batch = queue.slice(0, 200);
		try {
			const res = await fetch('/dashboard/visits/scanner/sync', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ scans: batch })
			});
			if (!res.ok) throw new Error(String(res.status));
			const { results } = (await res.json()) as { results: { clientScanId: string; result: string; code: string }[] };
			const done = new Set(results.map((r) => r.clientScanId));
			queue = queue.filter((q) => !done.has(q.clientScanId));
			save(QUEUE_KEY, queue);
			for (const r of results) {
				if (r.result === 'duplicate_offline') {
					recent = [{ code: r.code, title: 'Admitted twice while offline', tone: 'stop' as const, at: new Date() }, ...recent].slice(0, 8);
				}
			}
			online = true;
			lastSync = new Date();
		} catch {
			online = false;
		} finally {
			syncing = false;
		}
		if (queue.length && online) void sync();
	}

	/** A fresh list from the server, when nothing is waiting to go up (it would be overwritten). */
	async function refresh() {
		if (queue.length || !navigator.onLine) return;
		try {
			const res = await fetch('/dashboard/visits/scanner/sync');
			if (!res.ok) throw new Error(String(res.status));
			const day = (await res.json()) as { today: string; tickets: Ticket[] };
			today = day.today;
			tickets = day.tickets;
			save(LIST_KEY, day);
			online = true;
			lastSync = new Date();
		} catch {
			online = false;
		}
	}

	async function startCamera() {
		cameraError = null;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
			cameraOn = true;
			await Promise.resolve();
			if (video) {
				video.srcObject = stream;
				await video.play();
				void readLoop();
			}
		} catch (err) {
			cameraError = err instanceof Error && err.name === 'NotAllowedError' ? 'Camera permission was refused.' : 'No camera could be opened.';
			stopCamera();
		}
	}

	function stopCamera() {
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		cameraOn = false;
	}

	/** Reads frames until the camera stops: BarcodeDetector where the browser has it, jsQR otherwise. */
	async function readLoop() {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		const Detector = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
		const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
		while (cameraOn && video) {
			let raw: string | null = null;
			if (video.readyState >= 2 && !pending) {
				if (detector) {
					raw = (await detector.detect(video).catch(() => []))[0]?.rawValue ?? null;
				} else if (ctx) {
					const w = (canvas.width = video.videoWidth);
					const h = (canvas.height = video.videoHeight);
					ctx.drawImage(video, 0, 0, w, h);
					raw = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
				}
			}
			// The same QR held up to the camera reads many times a second: count it once.
			if (raw && (raw !== lastRead.raw || Date.now() - lastRead.at > 4000)) {
				lastRead = { raw, at: Date.now() };
				await handle(raw);
			}
			await new Promise((r) => setTimeout(r, 180));
		}
	}

	function submitTyped(e: SubmitEvent) {
		e.preventDefault();
		if (typed.trim()) void handle(typed.trim());
		typed = '';
	}

	onMount(() => {
		const saved = load<Queued[]>(QUEUE_KEY);
		if (saved?.length) queue = saved;
		// A list kept from earlier today (taken offline) keeps the device's own check-ins.
		const day = load<{ today: string; tickets: Ticket[] }>(LIST_KEY);
		if (day?.today === today && saved?.length) tickets = day.tickets;
		void importQrKey(data.publicKey).then((k) => (key = k));
		online = navigator.onLine;
		const up = () => {
			online = true;
			void sync();
		};
		const down = () => (online = false);
		window.addEventListener('online', up);
		window.addEventListener('offline', down);
		void sync();
		const timer = setInterval(() => {
			void sync();
			void refresh();
		}, 60_000);
		return () => {
			clearInterval(timer);
			window.removeEventListener('online', up);
			window.removeEventListener('offline', down);
			stopCamera();
		};
	});
</script>

<PageHeader
	title="Gate scanner"
	description="{formatDate(today)} · {inside} of {expected} in. Point the camera at a ticket QR; it keeps working offline and catches up when the network is back."
/>

<div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
	<div class="flex min-w-0 flex-col gap-4">
		<div class="relative aspect-[4/3] max-h-[70vh] w-full overflow-hidden rounded-xl bg-black">
			{#if cameraOn}
				<video bind:this={video} class="size-full object-cover" playsinline muted></video>
				<div class="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/70"></div>
			{:else}
				<div class="grid size-full place-items-center p-6 text-center text-white/80">
					<div class="flex flex-col items-center gap-3">
						<Camera class="size-10" />
						<p>The camera is off.</p>
						{#if cameraError}<p class="text-sm text-red-300">{cameraError}</p>{/if}
					</div>
				</div>
			{/if}

			{#if verdict}
				<button
					type="button"
					class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white"
					style:background={verdict.tone === 'go'
						? (verdict.ticket?.colour ?? '#15803d')
						: verdict.tone === 'again'
							? '#b45309'
							: '#b91c1c'}
					onclick={() => (verdict = null)}
					aria-live="assertive"
				>
					<span class="text-4xl font-black tracking-tight sm:text-5xl">{verdict.title}</span>
					{#if verdict.ticket}
						<span class="text-xl font-bold tracking-wide">{label(verdict.ticket)}</span>
						{#if who(verdict.ticket)}<span class="text-lg">{who(verdict.ticket)}</span>{/if}
						{#if verdict.tone === 'go' && verdict.ticket.requiresIdCheck}
							<span class="mt-2 rounded-full bg-white/20 px-4 py-1 text-sm font-semibold">Check ID</span>
						{/if}
					{/if}
					{#if verdict.detail}<span class="text-base opacity-90">{verdict.detail}</span>{/if}
					<span class="mt-4 text-sm opacity-75">Tap for the next scan</span>
				</button>
			{/if}

			{#if pending}
				<div class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 p-6 text-center text-white">
					<span class="text-xl font-bold">{label(pending.ticket)}</span>
					<span>{who(pending.ticket)} · group of {pending.ticket.admits}, {pending.ticket.admits - pending.ticket.checkedIn} still to come</span>
					<div class="flex items-center gap-4">
						<Button variant="secondary" size="lg" disabled={pending.count <= 1} onclick={() => pending && pending.count--}>−</Button>
						<span class="w-16 text-4xl font-black tabular-nums">{pending.count}</span>
						<Button
							variant="secondary"
							size="lg"
							disabled={pending.count >= pending.ticket.admits - pending.ticket.checkedIn}
							onclick={() => pending && pending.count++}>+</Button
						>
					</div>
					<div class="flex gap-3">
						<Button size="lg" onclick={() => pending && handle(pending.raw, pending.count)}>Admit {pending.count}</Button>
						<Button variant="ghost" size="lg" onclick={() => (pending = null)}>Cancel</Button>
					</div>
				</div>
			{/if}
		</div>

		<div class="flex flex-wrap gap-3">
			{#if cameraOn}
				<Button variant="outline" onclick={stopCamera}><CameraOff class="size-4" /> Stop camera</Button>
			{:else}
				<Button onclick={startCamera}><Camera class="size-4" /> Start camera</Button>
			{/if}
			<form class="flex min-w-60 flex-1 gap-2" onsubmit={submitTyped}>
				<Input bind:value={typed} placeholder="Or type a ticket code" aria-label="Ticket code" autocomplete="off" />
				<Button type="submit" variant="outline">Check</Button>
			</form>
		</div>
	</div>

	<aside class="flex flex-col gap-4">
		<div class="rounded-xl border p-4 text-sm">
			<p class="flex items-center gap-2 font-medium">
				{#if online}<Wifi class="size-4 text-emerald-600" /> Online{:else}<WifiOff class="size-4 text-amber-600" /> Offline{/if}
			</p>
			<p class="mt-1 text-muted-foreground">
				{tickets.length} tickets on today’s list.
				{#if queue.length}{queue.length} scan{queue.length === 1 ? '' : 's'} waiting to sync.{:else}All scans synced.{/if}
			</p>
			{#if lastSync}<p class="text-muted-foreground">Last synced {localClock(lastSync)}.</p>{/if}
			{#if !key}<p class="mt-2 text-amber-700">This browser cannot check QR signatures; tickets are checked against the list only.</p>{/if}
		</div>
		<div class="rounded-xl border p-4">
			<p class="mb-2 text-sm font-medium">Recent scans</p>
			{#if recent.length}
				<ul class="flex flex-col gap-2 text-sm">
					{#each recent as r, i (i)}
						<li class="flex items-center justify-between gap-2">
							<span class="flex items-center gap-2">
								<span
									class="size-2.5 rounded-full {r.tone === 'go' ? 'bg-emerald-600' : r.tone === 'again' ? 'bg-amber-600' : 'bg-red-600'}"
								></span>
								<span class="font-mono">{r.code}</span>
							</span>
							<span class="text-muted-foreground">{r.title} · {localClock(r.at)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground">Nothing scanned yet.</p>
			{/if}
		</div>
	</aside>
</div>
