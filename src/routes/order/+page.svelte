<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Pouch from '#lib/components/museum/Pouch.svelte';
	import Beans from '#lib/components/museum/Beans.svelte';
	import { bag } from '#lib/content/bag.js';

	const sizes = bag.sizes;
	let sizeId = $state(sizes[0].id);
	let count = $state(1);
	let way = $state<'deliver' | 'collect'>('deliver');
	const size = $derived(sizes.find((s) => s.id === sizeId) ?? sizes[0]);

	// arriving from a bag on the home page: start on the size that was picked up
	onMount(() => {
		const asked = new URLSearchParams(location.search).get('size');
		if (asked && sizes.some((s) => s.id === asked)) sizeId = asked;
	});

	const ways = [
		{ id: 'deliver', label: 'Send it to me', text: 'We reply with the price and delivery.' },
		{ id: 'collect', label: 'I will collect it', text: 'Pick it up at the museum in Jimma.' }
	] as const;

	const summary = $derived(
		`${count} × Kebena Coffee ${size.weight}, ${way === 'deliver' ? 'to be delivered' : 'to collect at the museum in Jimma'}`
	);
	const mailto = $derived(
		`mailto:${bag.contact.email}?subject=${encodeURIComponent(`Coffee order: ${count} × ${size.weight}`)}&body=${encodeURIComponent(
			`Hello Kebena,\n\nI would like to order:\n${summary}.\n\nMy name:\nMy phone:\n${way === 'deliver' ? 'Deliver to:\n' : ''}\nThank you.`
		)}`
	);
	const tel = `tel:${bag.contact.phone.replace(/\s/g, '')}`;
</script>

<svelte:head>
	<title>Order coffee · Kebena</title>
	<meta
		name="description"
		content="Order Kebena Coffee by email or phone, or collect it at the museum in Jimma."
	/>
</svelte:head>

<main class="order">
	<a class="back" href={resolve('/')}>
		<svg viewBox="0 0 14 12" aria-hidden="true"><path d="M13 6H1.5M6.5 1l-5 5 5 5" /></svg>
		Back to the museum
	</a>

	<header class="head">
		<p class="pk-label">Order</p>
		<h1>Take a bag home.</h1>
		<p class="lede">
			Choose a bag and how you want it. Your order goes to us by email or phone, and we confirm the
			price with you before anything is paid.
		</p>
	</header>

	<div class="grid">
		<div class="show" aria-hidden="true">
			<div class="spin" style:--w={`calc(clamp(150px, 24vw, 280px) * ${size.scale})`}>
				<Pouch src={bag.photo.src} weight={size.weight} eager />
			</div>
			<span class="floor"></span>
			<span class="spill"><Beans seed={4} /></span>
		</div>

		<form class="form" onsubmit={(e) => e.preventDefault()}>
			<fieldset>
				<legend>1. The bag</legend>
				<div class="opts three">
					{#each sizes as s (s.id)}
						<label class={['opt', { on: s.id === sizeId }]}>
							<input type="radio" name="size" value={s.id} bind:group={sizeId} />
							<span class="big">{s.weight}</span>
							<span class="small">{s.name}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<fieldset>
				<legend>2. How many</legend>
				<div class="count">
					<button
						type="button"
						aria-label="One bag fewer"
						disabled={count <= 1}
						onclick={() => (count = Math.max(1, count - 1))}
					>
						−
					</button>
					<output aria-live="polite">{count}</output>
					<button
						type="button"
						aria-label="One bag more"
						disabled={count >= 99}
						onclick={() => (count = Math.min(99, count + 1))}
					>
						+
					</button>
				</div>
			</fieldset>

			<fieldset>
				<legend>3. How you want it</legend>
				<div class="opts two">
					{#each ways as w (w.id)}
						<label class={['opt', { on: w.id === way }]}>
							<input type="radio" name="way" value={w.id} bind:group={way} />
							<span class="mid">{w.label}</span>
							<span class="small">{w.text}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<div class="send">
				<p class="sum" aria-live="polite">{summary}</p>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- mailto: and tel: links -->
				<a class="go" href={mailto}>
					<span>Send order by email</span>
					<svg viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6h11.5M7.5 1l5 5-5 5" /></svg>
				</a>
				<a class="call" href={tel}>Or call {bag.contact.phone}</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		</form>
	</div>
</main>

<style>
	.order {
		min-height: 100vh;
		min-height: 100dvh;
		padding: clamp(20px, 3vw, 36px) var(--pk-gutter) clamp(56px, 8vw, 96px);
		background: var(--paper-tint);
		color: var(--ink);
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		color: var(--ink);
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: 14px;
		font-weight: 500;
		letter-spacing: 0.09em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.back svg,
	.go svg {
		width: 14px;
		height: 12px;
		fill: none;
		stroke: var(--accent-ink);
		stroke-width: 1.6;
	}
	.head {
		display: grid;
		gap: 14px;
		max-width: 1120px;
		margin: clamp(28px, 5vw, 64px) auto 0;
	}
	.pk-label {
		color: var(--accent-ink);
	}
	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2.8rem, 8vw, 6.4rem);
		font-weight: 800;
		line-height: 0.94;
		letter-spacing: -0.02em;
		text-transform: uppercase;
	}
	.lede {
		margin: 0;
		max-width: 46ch;
		font-size: clamp(1.05rem, 1.4vw, 1.25rem);
		line-height: 1.5;
		color: var(--ink-soft);
		text-wrap: pretty;
	}
	.grid {
		display: grid;
		gap: clamp(28px, 5vw, 72px);
		max-width: 1120px;
		margin: clamp(32px, 5vw, 64px) auto 0;
	}
	.show {
		position: relative;
		display: grid;
		place-items: center;
		min-height: clamp(280px, 44vw, 520px);
		border: 1px solid var(--hair);
		border-radius: 24px;
		background: var(--card);
		perspective: 1300px;
	}
	.spin {
		transform-style: preserve-3d;
		animation: show 10s ease-in-out infinite;
	}
	@keyframes show {
		0%,
		100% {
			transform: rotateX(-5deg) rotateY(-30deg);
		}
		50% {
			transform: rotateX(-5deg) rotateY(210deg);
		}
	}
	.floor {
		position: absolute;
		left: 50%;
		bottom: 9%;
		width: 46%;
		height: 7%;
		margin-left: -23%;
		border-radius: 50%;
		background: radial-gradient(closest-side, rgb(25 33 27 / 0.42), transparent);
	}
	.spill {
		position: absolute;
		left: 50%;
		bottom: 5%;
		width: min(78%, 460px);
		transform: translateX(-50%);
	}
	.form {
		display: grid;
		gap: 28px;
		align-content: start;
	}
	fieldset {
		display: grid;
		gap: 12px;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		padding: 0 0 12px;
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: 14px;
		font-weight: 500;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent-ink);
	}
	.opts {
		display: grid;
		gap: 10px;
	}
	.three {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.two {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.opt {
		position: relative;
		display: grid;
		align-content: start;
		gap: 6px;
		padding: 16px 14px;
		border: 1px solid var(--hair);
		border-radius: 16px;
		cursor: pointer;
		transition:
			background-color 0.25s ease,
			border-color 0.25s ease;
	}
	.opt input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.opt.on {
		border-color: var(--accent-ink);
		background: color-mix(in srgb, var(--gold) 22%, transparent);
	}
	.opt:has(input:focus-visible) {
		outline: 2px solid var(--accent-ink);
		outline-offset: 3px;
	}
	.big {
		font-family: var(--font-display);
		font-size: clamp(1.4rem, 3vw, 2.1rem);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.02em;
	}
	.mid {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 600;
		line-height: 1.15;
	}
	.small {
		font-size: 14px;
		line-height: 1.35;
		color: var(--ink-soft);
	}
	.count {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		justify-self: start;
		padding: 4px;
		border: 1px solid var(--hair);
		border-radius: 999px;
	}
	.count button {
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--well);
		color: var(--ink);
		font-size: 20px;
		line-height: 1;
		cursor: pointer;
	}
	.count button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.count button:focus-visible,
	.back:focus-visible,
	.call:focus-visible {
		outline: 2px solid var(--accent-ink);
		outline-offset: 3px;
	}
	.count output {
		min-width: 2.4ch;
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
	.send {
		display: grid;
		gap: 14px;
		padding-top: 24px;
		border-top: 1px solid var(--hair);
	}
	.sum {
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.45;
		font-variant-numeric: tabular-nums;
	}
	.go {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		min-height: 56px;
		padding: 0 26px;
		border-radius: 999px;
		background: var(--gold);
		color: var(--bag-deep);
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: 15px;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		text-decoration: none;
		transition: background-color 0.3s ease;
	}
	.go:hover {
		background: var(--gold-soft);
	}
	.go:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}
	.go svg {
		stroke: currentColor;
	}
	.call {
		justify-self: center;
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
		text-underline-offset: 4px;
	}

	@media (min-width: 860px) {
		.grid {
			grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr);
			align-items: start;
		}
		.show {
			position: sticky;
			top: 24px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation: none;
			transform: rotateX(-5deg) rotateY(-26deg);
		}
		.opt,
		.go {
			transition: none;
		}
	}
</style>
