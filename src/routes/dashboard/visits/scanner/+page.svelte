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
	import { SCANNER_DEVICE_HEADER } from '#lib/constants.ts';
	import {
		importQrKey,
		memberCardOf,
		parseTicketQr,
		ticketCodeOf,
		verifyTicketQr
	} from '#lib/ticketQr.ts';

	let { data } = $props();

	type Ticket = (typeof data.tickets)[number];
	type Member = (typeof data.members)[number] & { firstCheckedInAt?: Date | string | null };
	type Day = { today: string; tickets: Ticket[]; members: Member[] };
	type Queued = {
		clientScanId: string;
		raw: string;
		headcount?: number;
		scannedAt: string;
		wasOffline: boolean;
	};
	type Verdict = {
		tone: 'go' | 'again' | 'stop';
		title: string;
		detail?: string;
		/** Who it is: the audience and ticket type, or the member's plan. */
		heading?: string;
		person?: string;
		colour?: string | null;
		idCheck?: boolean;
		code?: string;
	};
	/** A group ticket or shared card waiting for the gate to say how many came in. */
	type Pending = {
		raw: string;
		heading: string;
		person: string;
		admits: number;
		left: number;
		count: number;
	};

	const QUEUE_KEY = 'kb-scan-queue';
	const LIST_KEY = 'kb-scan-day';
	const TOKEN_KEY = 'kb-scan-device';

	// svelte-ignore state_referenced_locally
	let tickets = $state<Ticket[]>(data.tickets);
	// svelte-ignore state_referenced_locally
	let today = $state(data.today);
	// svelte-ignore state_referenced_locally
	let members = $state<Member[]>(data.members);
	/** This browser's device token, and the device it names once the server has said. */
	let token = $state<string | null>(null);
	let device = $state<{ name: string; location: string | null } | null>(null);
	let deviceError = $state<string | null>(null);
	let pairing = $state(false);
	let typedToken = $state('');
	let queue = $state<Queued[]>([]);
	let online = $state(true);
	let syncing = $state(false);
	let lastSync = $state<Date | null>(null);
	let verdict = $state<Verdict | null>(null);
	let pending = $state<Pending | null>(null);
	let recent = $state<{ code: string; title: string; tone: Verdict['tone']; at: Date }[]>([]);
	let typed = $state('');
	let cameraOn = $state(false);
	let cameraError = $state<string | null>(null);
	let video = $state<HTMLVideoElement>();
	let key = $state<CryptoKey | null>(null);
	let stream: MediaStream | null = null;
	let lastRead = { raw: '', at: 0 };

	const byCode = $derived(new Map(tickets.map((t) => [t.code, t])));
	const byCard = $derived(new Map(members.map((c) => [c.card, c])));
	const inside = $derived(
		tickets.reduce((sum, t) => sum + t.checkedIn, 0) +
			members.reduce((sum, c) => sum + c.checkedIn, 0)
	);
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
	const ticketFace = (t: Ticket) => ({
		heading: label(t),
		person: who(t),
		colour: t.colour,
		idCheck: t.requiresIdCheck,
		code: t.code
	});
	const cardFace = (c: Member) => ({
		heading: `MEMBER · ${c.plan}`.toUpperCase(),
		person: c.isChild ? `${c.name} (child)` : c.name,
		colour: '#1d4ed8',
		code: c.card
	});
	const headers = (): Record<string, string> => (token ? { [SCANNER_DEVICE_HEADER]: token } : {});

	/**
	 * How many of those still to come a scan lets in: everyone on a single ticket, or a count the
	 * gate picks for a group (null until it has).
	 */
	function people(
		raw: string,
		face: { heading: string; person: string },
		admits: number,
		left: number,
		headcount?: number
	) {
		if (left > 1 && headcount === undefined) {
			pending = { raw, ...face, admits, left, count: left };
			return null;
		}
		return Math.min(headcount ?? left, left);
	}

	const firstIn = (at: Date | string | null | undefined) =>
		at ? localClock(new Date(at)) : 'earlier';

	/** A member card, checked against today's members list. */
	function handleCard(raw: string, c: Member, headcount?: number) {
		if (c.refused) {
			return show(raw, {
				tone: 'stop',
				title: c.refused,
				detail: `Card of ${c.name}, ${c.number}.`,
				...cardFace(c)
			});
		}
		const left = Math.max(c.admits - c.checkedIn, 0);
		if (left === 0) {
			return show(raw, {
				tone: 'again',
				title: 'Re-entry',
				detail: `Member card, first in at ${firstIn(c.firstCheckedInAt)}.`,
				...cardFace(c)
			});
		}
		const n = people(raw, cardFace(c), c.admits, left, headcount);
		if (n === null) return;
		c.checkedIn += n;
		c.firstCheckedInAt ??= new Date();
		show(
			raw,
			{
				tone: 'go',
				title: n === 1 ? 'Admit 1' : `Admit ${n}`,
				detail: `Membership ${c.number}`,
				...cardFace(c)
			},
			n
		);
	}

	/** Reads one scan, decides on the device, and queues it for the server. */
	async function handle(raw: string, headcount?: number) {
		const card = memberCardOf(raw);
		if (card) {
			const c = byCard.get(card);
			if (c) return handleCard(raw, c, headcount);
			return show(raw, {
				tone: 'stop',
				title: 'Unknown member card',
				detail: `${card} — check it at the desk.`
			});
		}
		const qr = parseTicketQr(raw);
		if (qr && key && !(await verifyTicketQr(qr, key))) {
			return show(raw, {
				tone: 'stop',
				title: 'Not a Kebena ticket',
				detail: 'The QR code is not signed by Kebena.'
			});
		}
		if (qr && qr.visitDate !== today) {
			return show(raw, {
				tone: 'stop',
				title: 'Wrong day',
				detail: `This ticket is for ${formatDate(qr.visitDate)}.`
			});
		}
		const code = ticketCodeOf(raw);
		const t = byCode.get(code);
		// A card code typed at the gate.
		const c = t ? undefined : byCard.get(code);
		if (c) return handleCard(raw, c, headcount);
		if (!t) {
			return show(raw, {
				tone: 'stop',
				title: 'Not on today’s list',
				detail: `${code} — check it at the desk.`
			});
		}
		const remaining = Math.max(t.admits - t.checkedIn, 0);
		if (remaining === 0) {
			return show(raw, {
				tone: 'again',
				title: 'Re-entry',
				detail: `First checked in at ${firstIn(t.firstCheckedInAt)}.`,
				...ticketFace(t)
			});
		}
		const n = people(raw, ticketFace(t), t.admits, remaining, headcount);
		if (n === null) return;
		t.checkedIn += n;
		t.firstCheckedInAt ??= new Date();
		const rest = t.admits - t.checkedIn;
		show(
			raw,
			{
				tone: 'go',
				title: n === 1 ? 'Admit 1' : `Admit ${n}`,
				detail: rest ? `${rest} more on this ticket still to come.` : undefined,
				...ticketFace(t)
			},
			n
		);
	}

	function show(raw: string, v: Verdict, headcount?: number) {
		pending = null;
		verdict = v;
		recent = [
			{ code: v.code ?? ticketCodeOf(raw), title: v.title, tone: v.tone, at: new Date() },
			...recent
		].slice(0, 8);
		enqueue({
			clientScanId: crypto.randomUUID(),
			raw,
			headcount,
			scannedAt: new Date().toISOString(),
			wasOffline: !online
		});
		navigator.vibrate?.(v.tone === 'go' ? 80 : [60, 60, 60]);
	}

	function enqueue(scan: Queued) {
		queue = [...queue, scan];
		save(QUEUE_KEY, queue);
		save(LIST_KEY, { today, tickets, members });
		void sync();
	}

	/** A 401 from the server: this device's token was revoked or mistyped. */
	function refused() {
		deviceError =
			'This device’s token no longer works: it was revoked, or mistyped. Scans wait here until it is paired again or unpaired.';
		device = null;
	}

	/** What the server said after a sync, worth flagging at the gate. */
	const LATE: Partial<Record<string, string>> = {
		duplicate_offline: 'Admitted twice while offline',
		wrong_location: 'Ticket for another site'
	};

	/** Sends the queue; what the server settled leaves it, the rest waits for the next try. */
	async function sync() {
		if (syncing || deviceError || !queue.length || !navigator.onLine) return;
		syncing = true;
		const batch = queue.slice(0, 200);
		try {
			const res = await fetch('/dashboard/visits/scanner/sync', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers() },
				body: JSON.stringify({ scans: batch })
			});
			if (res.status === 401) return refused();
			if (!res.ok) throw new Error(String(res.status));
			const { results } = (await res.json()) as {
				results: { clientScanId: string; result: string; code: string }[];
			};
			const done = new Set(results.map((r) => r.clientScanId));
			queue = queue.filter((q) => !done.has(q.clientScanId));
			save(QUEUE_KEY, queue);
			for (const r of results) {
				const title = LATE[r.result];
				if (title)
					recent = [
						{ code: r.code, title, tone: 'stop' as const, at: new Date() },
						...recent
					].slice(0, 8);
			}
			online = true;
			lastSync = new Date();
		} catch {
			online = false;
		} finally {
			syncing = false;
		}
		if (queue.length && online && !deviceError) void sync();
	}

	/** A fresh list from the server, when nothing is waiting to go up (it would be overwritten). */
	async function refresh() {
		if (queue.length || deviceError || !navigator.onLine) return;
		try {
			const res = await fetch('/dashboard/visits/scanner/sync', { headers: headers() });
			if (res.status === 401) return refused();
			if (!res.ok) throw new Error(String(res.status));
			const day = (await res.json()) as Day & { device: typeof device };
			today = day.today;
			tickets = day.tickets;
			members = day.members;
			device = day.device;
			save(LIST_KEY, { today, tickets, members });
			online = true;
			lastSync = new Date();
		} catch {
			online = false;
		}
	}

	async function startCamera() {
		cameraError = null;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' },
				audio: false
			});
			cameraOn = true;
			await Promise.resolve();
			if (video) {
				video.srcObject = stream;
				await video.play();
				void readLoop();
			}
		} catch (err) {
			cameraError =
				err instanceof Error && err.name === 'NotAllowedError'
					? 'Camera permission was refused.'
					: 'No camera could be opened.';
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
		const Detector = (
			globalThis as {
				BarcodeDetector?: new (o: { formats: string[] }) => {
					detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
				};
			}
		).BarcodeDetector;
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
					raw =
						jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
							?.data ?? null;
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

	function storedToken() {
		try {
			return localStorage.getItem(TOKEN_KEY);
		} catch {
			return null;
		}
	}

	/** Pairs this browser with a registered device: its scans then carry the device and site. */
	async function pair(value: string) {
		token = value.trim() || null;
		try {
			if (token) localStorage.setItem(TOKEN_KEY, token);
			else localStorage.removeItem(TOKEN_KEY);
		} catch {
			// without storage the pairing lasts until the page is closed
		}
		pairing = false;
		typedToken = '';
		deviceError = null;
		device = null;
		// The queue goes up first, under the new pairing, then the device's own lists come down.
		await sync();
		await refresh();
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
		const day = load<Day>(LIST_KEY);
		if (day?.today === today && saved?.length) {
			tickets = day.tickets;
			members = day.members ?? members;
		}
		// A pairing link from the devices page: `#pair=<token>`, kept and then wiped from the address.
		const linked = new URLSearchParams(location.hash.slice(1)).get('pair');
		if (linked) {
			history.replaceState(history.state, '', location.pathname + location.search);
			try {
				localStorage.setItem(TOKEN_KEY, linked);
			} catch {
				// paired for this visit only
			}
		}
		token = linked ?? storedToken();
		void importQrKey(data.publicKey).then((k) => (key = k));
		online = navigator.onLine;
		const up = () => {
			online = true;
			void sync();
		};
		const down = () => (online = false);
		window.addEventListener('online', up);
		window.addEventListener('offline', down);
		void sync().then(refresh);
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
	description="{formatDate(
		today
	)} · {inside} of {expected} in. Point the camera at a ticket QR; it keeps working offline and catches up when the network is back."
/>

<div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
	<div class="flex min-w-0 flex-col gap-4">
		<div class="relative aspect-[4/3] max-h-[70vh] w-full overflow-hidden rounded-xl bg-black">
			{#if cameraOn}
				<video bind:this={video} class="size-full object-cover" playsinline muted></video>
				<div
					class="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/70"
				></div>
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
						? (verdict.colour ?? '#15803d')
						: verdict.tone === 'again'
							? '#b45309'
							: '#b91c1c'}
					onclick={() => (verdict = null)}
					aria-live="assertive"
				>
					<span class="text-4xl font-black tracking-tight sm:text-5xl">{verdict.title}</span>
					{#if verdict.heading}
						<span class="text-xl font-bold tracking-wide">{verdict.heading}</span>
						{#if verdict.person}<span class="text-lg">{verdict.person}</span>{/if}
						{#if verdict.tone === 'go' && verdict.idCheck}
							<span class="mt-2 rounded-full bg-white/20 px-4 py-1 text-sm font-semibold">
								Check ID
							</span>
						{/if}
					{/if}
					{#if verdict.detail}<span class="text-base opacity-90">{verdict.detail}</span>{/if}
					<span class="mt-4 text-sm opacity-75">Tap for the next scan</span>
				</button>
			{/if}

			{#if pending}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 p-6 text-center text-white"
				>
					<span class="text-xl font-bold">{pending.heading}</span>
					<span>
						{pending.person} · group of {pending.admits}, {pending.left} still to come
					</span>
					<div class="flex items-center gap-4">
						<Button
							variant="secondary"
							size="lg"
							disabled={pending.count <= 1}
							onclick={() => pending && pending.count--}
						>
							−
						</Button>
						<span class="w-16 text-4xl font-black tabular-nums">{pending.count}</span>
						<Button
							variant="secondary"
							size="lg"
							disabled={pending.count >= pending.left}
							onclick={() => pending && pending.count++}
						>
							+
						</Button>
					</div>
					<div class="flex gap-3">
						<Button size="lg" onclick={() => pending && handle(pending.raw, pending.count)}>
							Admit {pending.count}
						</Button>
						<Button variant="ghost" size="lg" onclick={() => (pending = null)}>Cancel</Button>
					</div>
				</div>
			{/if}
		</div>

		<div class="flex flex-wrap gap-3">
			{#if cameraOn}
				<Button variant="outline" onclick={stopCamera}>
					<CameraOff class="size-4" /> Stop camera
				</Button>
			{:else}
				<Button onclick={startCamera}><Camera class="size-4" /> Start camera</Button>
			{/if}
			<form class="flex min-w-60 flex-1 gap-2" onsubmit={submitTyped}>
				<Input
					bind:value={typed}
					placeholder="Or type a ticket or card code"
					aria-label="Ticket or card code"
					autocomplete="off"
				/>
				<Button type="submit" variant="outline">Check</Button>
			</form>
		</div>
	</div>

	<aside class="flex flex-col gap-4">
		<div class="rounded-xl border p-4 text-sm">
			<p class="flex items-center gap-2 font-medium">
				{#if online}<Wifi class="size-4 text-emerald-600" /> Online{:else}<WifiOff
						class="size-4 text-amber-600"
					/> Offline{/if}
			</p>
			<p class="mt-1 text-muted-foreground">
				{tickets.length} tickets and {members.length} member cards on today’s list.
				{#if queue.length}{queue.length} scan{queue.length === 1 ? '' : 's'} waiting to sync.{:else}All
					scans synced.{/if}
			</p>
			{#if lastSync}<p class="text-muted-foreground">Last synced {localClock(lastSync)}.</p>{/if}
			<div class="mt-3 border-t pt-3">
				{#if deviceError}
					<p class="text-red-700">{deviceError}</p>
				{:else if device}
					<p>
						<span class="font-medium">{device.name}</span>{#if device.location}
							· {device.location}{/if}
					</p>
					<p class="text-muted-foreground">
						{device.location
							? 'Only this site’s tickets are on the list.'
							: 'This device has no site: every site’s tickets are on the list.'}
					</p>
				{:else if token}
					<p class="text-muted-foreground">Checking this device…</p>
				{:else}
					<p class="text-muted-foreground">
						Not paired: scans are not tied to a device or site, and every site’s tickets are on the
						list.
					</p>
				{/if}
				{#if pairing}
					<form
						class="mt-2 flex gap-2"
						onsubmit={(e) => {
							e.preventDefault();
							void pair(typedToken);
						}}
					>
						<Input
							bind:value={typedToken}
							placeholder="Device token"
							aria-label="Device token"
							autocomplete="off"
						/>
						<Button type="submit" size="sm">Pair</Button>
					</form>
				{:else}
					<div class="mt-2 flex gap-2">
						<Button variant="outline" size="sm" onclick={() => (pairing = true)}>
							{token ? 'Pair again' : 'Pair this device'}
						</Button>
						{#if token}
							<Button variant="ghost" size="sm" onclick={() => pair('')}>Unpair</Button>
						{/if}
					</div>
				{/if}
			</div>
			{#if !key}<p class="mt-2 text-amber-700">
					This browser cannot check QR signatures; tickets are checked against the list only.
				</p>{/if}
		</div>
		<div class="rounded-xl border p-4">
			<p class="mb-2 text-sm font-medium">Recent scans</p>
			{#if recent.length}
				<ul class="flex flex-col gap-2 text-sm">
					{#each recent as r, i (i)}
						<li class="flex items-center justify-between gap-2">
							<span class="flex items-center gap-2">
								<span
									class="size-2.5 rounded-full {r.tone === 'go'
										? 'bg-emerald-600'
										: r.tone === 'again'
											? 'bg-amber-600'
											: 'bg-red-600'}"
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
