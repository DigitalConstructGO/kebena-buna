<script lang="ts">
	import { tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { page } from '$app/state';
	import { renderMarkdown } from '#lib/chat/markdown.ts';
	import { deLocalizeHref, getLocale, localizeHref } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';

	/**
	 * The site assistant: a button in the corner of every public page that opens a chat with
	 * `/api/chat`. The conversation is kept for the tab (sessionStorage), so it follows the
	 * visitor from page to page.
	 */

	type Message = { role: 'user' | 'model'; text: string };

	const STORE = 'kebena-chat';
	const EMAIL = 'info@kebenageneraltrading.com';
	const suggestions = [
		m.chat_suggest_see,
		m.chat_suggest_tickets,
		m.chat_suggest_coffee,
		m.chat_suggest_history
	];

	let open = $state(false);
	let messages = $state<Message[]>(load());
	let draft = $state('');
	let busy = $state(false);
	/** The on-screen keyboard is up (phones only, see fitViewport). */
	let keyboard = $state(false);
	let failed = $state('');
	let controller: AbortController | undefined;

	let log = $state<HTMLElement>();
	let input = $state<HTMLTextAreaElement>();
	let launcher = $state<HTMLButtonElement>();

	function load(): Message[] {
		try {
			const saved = JSON.parse(sessionStorage.getItem(STORE) ?? '[]');
			return Array.isArray(saved) ? saved : [];
		} catch {
			return [];
		}
	}

	$effect(() => {
		const snapshot = JSON.stringify(messages);
		try {
			sessionStorage.setItem(STORE, snapshot);
		} catch {
			/* private mode — the chat simply forgets on reload */
		}
	});

	async function scrollDown() {
		await tick();
		log?.scrollTo({ top: log.scrollHeight });
	}

	async function toggle(next = !open) {
		open = next;
		if (open) {
			await scrollDown();
			input?.focus();
		} else {
			launcher?.focus();
		}
	}

	async function send(text = draft) {
		text = text.trim();
		if (!text || busy) return;
		draft = '';
		failed = '';
		messages.push({ role: 'user', text });
		const history = messages.map(({ role, text }) => ({ role, text }));
		messages.push({ role: 'model', text: '' });
		const reply = messages[messages.length - 1];
		busy = true;
		controller = new AbortController();
		void scrollDown();

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					messages: history,
					page: deLocalizeHref(page.url.pathname),
					locale: getLocale()
				}),
				signal: controller.signal
			}).catch((e: unknown) => {
				if (controller?.signal.aborted) throw e;
				throw new Error(m.chat_err_offline());
			});
			if (!res.ok || !res.body) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.message ?? m.chat_err_failed());
			}
			// one JSON object per line
			const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += value;
				const lines = buffer.split('\n');
				buffer = lines.pop()!;
				for (const line of lines) if (line.trim()) reply.text += JSON.parse(line).text ?? '';
				void scrollDown();
			}
			if (!reply.text) throw new Error(m.chat_err_empty());
		} catch (e) {
			if (!reply.text) messages.pop();
			if (!controller.signal.aborted) failed = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
			controller = undefined;
			void scrollDown();
			input?.focus();
		}
	}

	function retry() {
		const i = messages.findLastIndex((msg) => msg.role === 'user');
		if (i === -1) return;
		const [last] = messages.splice(i, 1);
		void send(last.text);
	}

	function restart() {
		controller?.abort();
		messages = [];
		failed = '';
		input?.focus();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			void send();
		}
	}

	// On a phone the panel covers the page, so following a link to the site should reveal it.
	function onclick(e: MouseEvent) {
		const a = (e.target as Element).closest('a');
		if (a?.getAttribute('href')?.startsWith('/') && matchMedia('(max-width: 640px)').matches)
			open = false;
	}

	/**
	 * On a phone the open chat fills the screen. The on-screen keyboard shrinks only the
	 * *visual* viewport, so a `position: fixed; inset: 0` panel stays full height and the
	 * browser pushes it up to reveal the input — header and greeting first. Sizing the panel
	 * to the visual viewport keeps all of it in the space above the keyboard, with only the
	 * messages scrolling.
	 */
	const fitViewport: Attachment<HTMLElement> = (el) => {
		const vv = window.visualViewport;
		if (!open || !vv || !matchMedia('(max-width: 640px)').matches) return;

		let lastHeight = vv.height;
		const fit = () => {
			el.style.setProperty('--vv-top', `${vv.offsetTop}px`);
			el.style.setProperty('--vv-height', `${vv.height}px`);
			keyboard = window.innerHeight - vv.height > 120;
			// keep the latest message in sight as the keyboard comes up
			if (vv.height < lastHeight) void scrollDown();
			lastHeight = vv.height;
		};
		fit();
		vv.addEventListener('resize', fit);
		vv.addEventListener('scroll', fit);

		// the page behind should not scroll under the chat
		const root = document.documentElement;
		const overflow = root.style.overflow;
		root.style.overflow = 'hidden';

		return () => {
			vv.removeEventListener('resize', fit);
			vv.removeEventListener('scroll', fit);
			el.style.removeProperty('--vv-top');
			el.style.removeProperty('--vv-height');
			keyboard = false;
			root.style.overflow = overflow;
		};
	};

	const autosize: Attachment<HTMLTextAreaElement> = (el) => {
		void draft;
		el.style.height = 'auto';
		el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
	};
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && open && toggle(false)} />

<div class={['chat', { open, keyboard }]} {@attach fitViewport}>
	{#if open}
		<section class="panel" id="kebena-chat" aria-label={m.chat_panel_label()}>
			<header>
				<span class="mark" aria-hidden="true">
					<svg viewBox="0 0 24 24">
						<path
							d="M12 3c-3.6 2.1-5.5 5.2-5.5 9s1.9 6.9 5.5 9c3.6-2.1 5.5-5.2 5.5-9S15.6 5.1 12 3z"
						/><path d="M12 3c-1.6 3-1.6 6 0 9s1.6 6 0 9" />
					</svg>
				</span>
				<div class="title">
					<strong>{m.chat_title()}</strong>
					<span>{m.chat_subtitle()}</span>
				</div>
				{#if messages.length}
					<button class="icon" onclick={restart} aria-label={m.chat_new()} title={m.chat_new()}>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" />
						</svg>
					</button>
				{/if}
				<button
					class="icon"
					onclick={() => toggle(false)}
					aria-label={m.chat_close()}
					title={m.chat_close()}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
				</button>
			</header>

			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
			<div class="log" bind:this={log} data-lenis-prevent role="log" aria-live="polite" {onclick}>
				<div class="msg model">
					<p>{m.chat_greeting()}</p>
				</div>

				{#each messages as msg, i (i)}
					<div class={['msg', msg.role]}>
						{#if msg.role === 'user'}
							<p>{msg.text}</p>
						{:else if msg.text}
							<div class="md">
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes everything it does not produce -->
								{@html renderMarkdown(msg.text, (path) => localizeHref(path))}
							</div>
						{:else}
							<span class="typing" aria-label={m.chat_thinking()}><i></i><i></i><i></i></span>
						{/if}
					</div>
				{/each}

				{#if failed}
					<div class="error" role="alert">
						<p>{failed}</p>
						<button onclick={retry}>{m.chat_retry()}</button>
						<span>{m.chat_or_contact()} <a href="mailto:{EMAIL}">{EMAIL}</a></span>
					</div>
				{/if}

				{#if !messages.length}
					<div class="suggest">
						{#each suggestions.map((s) => s()) as s (s)}
							<button onclick={() => send(s)}>{s}</button>
						{/each}
					</div>
				{/if}
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					void send();
				}}
			>
				<textarea
					bind:this={input}
					bind:value={draft}
					{@attach autosize}
					{onkeydown}
					rows="1"
					maxlength="1000"
					placeholder={m.chat_placeholder()}
					aria-label={m.chat_input_label()}></textarea>
				{#if busy}
					<button
						type="button"
						class="send"
						onclick={() => controller?.abort()}
						aria-label={m.chat_stop()}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<rect x="7" y="7" width="10" height="10" rx="2" />
						</svg>
					</button>
				{:else}
					<button type="submit" class="send" disabled={!draft.trim()} aria-label={m.chat_send()}>
						<svg class="flip" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M5 12h13M13 6l6 6-6 6" />
						</svg>
					</button>
				{/if}
			</form>
			<p class="fine">{m.chat_disclaimer()}</p>
		</section>
	{/if}

	<button
		bind:this={launcher}
		class="launcher"
		aria-expanded={open}
		aria-controls="kebena-chat"
		onclick={() => toggle()}
	>
		{#if open}
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
			<span class="sr">{m.chat_close()}</span>
		{:else}
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5z"
				/><path d="M8.5 9.5h7M8.5 12.5h4" />
			</svg>
			<span class="label">{m.chat_title()}</span>
		{/if}
	</button>
</div>

<style>
	.chat {
		position: fixed;
		inset-inline-end: max(16px, env(safe-area-inset-right));
		bottom: max(16px, env(safe-area-inset-bottom));
		z-index: 50;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 12px;
		pointer-events: none;
		font-family: var(--font-sans);
		transition: bottom 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.chat > * {
		pointer-events: auto;
	}

	svg {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* an arrow points the way the text runs */
	:global([dir='rtl']) .flip {
		scale: -1 1;
	}

	/* the museum's chrome: the same dark glass as the floor-plan dock */
	.launcher {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 52px;
		padding: 0 20px 0 16px;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 999px;
		background: var(--chrome);
		backdrop-filter: var(--glass-fx);
		-webkit-backdrop-filter: var(--glass-fx);
		color: var(--color-mist-50);
		font: 500 15px/1 var(--font-sans);
		box-shadow: 0 10px 30px -12px rgb(25 33 27 / 0.55);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition:
			scale 0.2s,
			background-color 0.2s;
	}

	.launcher svg {
		color: var(--color-leaf-400);
	}

	.launcher:hover {
		background: var(--color-forest-900);
	}

	.launcher:active {
		scale: 0.96;
	}

	.launcher:focus-visible,
	.panel button:focus-visible {
		outline: 2px solid var(--color-leaf-400);
		outline-offset: 2px;
	}

	.chat.open .launcher {
		padding: 0;
		width: 52px;
		justify-content: center;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.panel {
		width: min(400px, calc(100vw - 32px));
		height: min(620px, calc(100dvh - 120px));
		display: flex;
		flex-direction: column;
		border: 1px solid var(--glass-line);
		border-radius: 24px;
		overflow: hidden;
		color: var(--ink);
		background: var(--paper);
		box-shadow:
			var(--glass-shine),
			0 30px 60px -20px rgb(25 33 27 / 0.45);
		transform-origin: bottom right;
		animation: rise 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	:global([dir='rtl']) .panel {
		transform-origin: bottom left;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.97);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.panel {
			animation: none;
		}
	}

	header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 10px 14px 16px;
		color: var(--color-mist-50);
		background: var(--color-forest-900);
	}

	.mark {
		display: grid;
		place-items: center;
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		color: var(--color-forest-950);
		background: var(--color-leaf-400);
	}

	.mark svg {
		width: 18px;
		height: 18px;
	}

	.title {
		display: grid;
		flex: 1;
		min-width: 0;
		line-height: 1.2;
	}

	.title strong {
		font-family: var(--font-display);
		font-size: 19px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.title span {
		font-size: 12px;
		color: rgb(248 231 204 / 0.7);
	}

	.icon {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		color: rgb(248 231 204 / 0.75);
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.icon:hover {
		color: var(--color-mist-50);
		background: rgb(255 255 255 / 0.1);
	}

	.log {
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		font-size: 15px;
		line-height: 1.5;
	}

	.msg {
		max-width: 88%;
		padding: 10px 14px;
		border-radius: 18px;
		overflow-wrap: anywhere;
	}

	.msg.model {
		align-self: flex-start;
		background: var(--paper-tint);
		border: 1px solid var(--line);
		border-end-start-radius: 6px;
	}

	.msg.user {
		align-self: flex-end;
		color: var(--color-mist-50);
		background: var(--color-forest-800);
		border-end-end-radius: 6px;
		white-space: pre-wrap;
	}

	.md :global(p + p),
	.md :global(p + ul),
	.md :global(p + ol),
	.md :global(ul + p),
	.md :global(ol + p) {
		margin-top: 0.5em;
	}

	.md :global(ul),
	.md :global(ol) {
		padding-inline-start: 1.2em;
	}

	.md :global(ul) {
		list-style: disc;
	}

	.md :global(ol) {
		list-style: decimal;
	}

	.md :global(li + li) {
		margin-top: 0.2em;
	}

	.md :global(strong) {
		font-weight: 600;
	}

	.md :global(a),
	.error a {
		color: var(--accent-ink);
		font-weight: 500;
		text-decoration: underline;
		text-decoration-color: var(--accent-line);
		text-underline-offset: 3px;
	}

	.md :global(a:hover),
	.error a:hover {
		text-decoration-color: currentColor;
	}

	.typing {
		display: inline-flex;
		gap: 4px;
		padding: 6px 0;
	}

	.typing i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--caramel);
		animation: blink 1.2s infinite ease-in-out both;
	}

	.typing i:nth-child(2) {
		animation-delay: 0.15s;
	}

	.typing i:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes blink {
		0%,
		80%,
		100% {
			opacity: 0.25;
			transform: translateY(0);
		}
		40% {
			opacity: 1;
			transform: translateY(-3px);
		}
	}

	.suggest {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 4px;
	}

	.suggest button {
		padding: 8px 14px;
		border-radius: 999px;
		font-size: 13.5px;
		text-align: start;
		color: var(--accent-ink);
		background: var(--accent-wash);
		border: 1px solid var(--accent-line);
		transition: background-color 0.2s;
	}

	.suggest button:hover {
		background: var(--accent-area);
	}

	.error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
		padding: 10px 14px;
		border-radius: 14px;
		font-size: 14px;
		background: rgb(148 86 31 / 0.1);
		border: 1px solid rgb(148 86 31 / 0.3);
	}

	.error p {
		flex-basis: 100%;
	}

	.error button {
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.error span {
		color: var(--ink-soft);
	}

	form {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		margin: 0 12px;
		padding: 6px 6px 6px 14px;
		border-radius: 22px;
		background: var(--paper-soft);
		border: 1px solid var(--line);
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	:global([dir='rtl']) form {
		padding: 6px 14px 6px 6px;
	}

	form:focus-within {
		border-color: var(--accent-ink);
		box-shadow: 0 0 0 3px var(--accent-wash);
	}

	textarea {
		flex: 1;
		min-width: 0;
		resize: none;
		padding: 7px 0;
		font: inherit;
		font-size: 15px;
		line-height: 1.4;
		color: var(--ink);
		background: none;
		border: none;
		outline: none;
	}

	textarea::placeholder {
		color: var(--ink-soft);
	}

	.send {
		display: grid;
		place-items: center;
		flex: none;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		color: var(--color-mist-50);
		background: var(--color-forest-900);
		transition: opacity 0.2s;
	}

	.send:disabled {
		opacity: 0.35;
	}

	.send rect {
		fill: currentColor;
		stroke: none;
	}

	.fine {
		padding: 8px 16px 12px;
		font-size: 11.5px;
		line-height: 1.4;
		text-align: center;
		color: var(--ink-soft);
	}

	/* on museum pages, phones keep the floor-plan dock at the foot: sit above it while it shows */
	@media (max-width: 720px) {
		:global(.museum:has(.wayfinder .dock:not(.away))) .chat:not(.open) {
			bottom: calc(max(14px, env(safe-area-inset-bottom)) + 64px);
		}
	}

	@media (max-width: 640px) {
		/* the visible area above the keyboard (see fitViewport), the whole screen without it */
		.chat.open {
			inset: auto 0;
			top: var(--vv-top, 0);
			height: var(--vv-height, 100dvh);
			gap: 0;
		}

		.chat.open .panel {
			width: 100%;
			height: 100%;
			border: 0;
			border-radius: 0;
			padding-bottom: env(safe-area-inset-bottom);
		}

		/* with the keyboard up there is no home indicator to clear, and every line counts */
		.chat.open.keyboard .panel {
			padding-bottom: 8px;
		}

		.chat.open.keyboard .fine {
			display: none;
		}

		/* the panel's own close button takes over full-screen */
		.chat.open .launcher {
			display: none;
		}

		/* icon only, but still named for screen readers */
		.launcher .label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}

		.launcher {
			width: 52px;
			padding: 0;
			justify-content: center;
		}

		/* 16px stops iOS zooming into the field */
		textarea {
			font-size: 16px;
		}
	}
</style>
