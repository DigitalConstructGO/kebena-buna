<script lang="ts">
	/** Roasted beans spilled round the foot of a bag. `seed` changes the scatter so no two piles match. */
	let { seed = 1 }: { seed?: number } = $props();

	// a small repeatable random, so the server and the browser draw the same pile
	const scatter = (s: number) => {
		let t = s * 9301 + 49297;
		const rnd = () => ((t = (t * 233280 + 12345) % 2147483647) / 2147483647 + 1) % 1;
		const out: { x: number; y: number; r: number; k: number }[] = [];
		for (let i = 0; i < 17; i++) {
			// two heaps either side of the bag, and a few strays in front of it
			const side = i % 5 === 4 ? 0 : i % 2 ? 1 : -1;
			const x = side === 0 ? 110 + rnd() * 80 : side < 0 ? 12 + rnd() * 78 : 210 + rnd() * 78;
			const y = side === 0 ? 50 + rnd() * 12 : 22 + rnd() * 36;
			out.push({ x, y, r: rnd() * 180, k: 0.72 + (y / 62) * 0.5 });
		}
		// nearer beans are drawn last, over the ones behind
		return out.sort((a, b) => a.y - b.y);
	};
	const beans = $derived(scatter(seed));
</script>

<svg class="beans" viewBox="0 0 300 72" aria-hidden="true">
	<defs>
		<radialGradient id="bean-fill" cx="38%" cy="30%" r="80%">
			<stop offset="0" stop-color="#8a5a37" />
			<stop offset="0.45" stop-color="#5a341d" />
			<stop offset="1" stop-color="#27140a" />
		</radialGradient>
	</defs>
	{#each beans as b, i (i)}
		<g transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) scale(${b.k.toFixed(2)})`}>
			<ellipse class="shade" cx="1.5" cy="6" rx="10.5" ry="3.2" />
			<g transform={`rotate(${b.r.toFixed(0)})`}>
				<ellipse rx="10" ry="6.6" fill="url(#bean-fill)" />
				<path class="crease" d="M-8.6 .6C-4 -2.6 3.4 3.2 8.6 -.4" />
				<path class="gleam" d="M-6 -3.6C-3 -5.4 2 -5.6 5 -4.2" />
			</g>
		</g>
	{/each}
</svg>

<style>
	.beans {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		pointer-events: none;
	}
	.shade {
		fill: rgb(0 0 0 / 0.45);
	}
	.crease {
		fill: none;
		stroke: #1a0c05;
		stroke-width: 1.5;
		stroke-linecap: round;
	}
	.gleam {
		fill: none;
		stroke: rgb(255 226 190 / 0.3);
		stroke-width: 1;
		stroke-linecap: round;
	}
</style>
