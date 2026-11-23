<script lang="ts">
	/** A stand-up coffee pouch built in 3D: printed front, plain back, gusseted sides, crimped seal. */
	let {
		src,
		alt = '',
		weight,
		eager = false
	}: { src: string; alt?: string; weight: string; eager?: boolean } = $props();
</script>

<!-- size it with --w; turn it with --ry and --rx (degrees) -->
<div class="pouch">
	<div class="face front">
		<img
			{src}
			{alt}
			width="452"
			height="632"
			loading={eager ? 'eager' : 'lazy'}
			decoding="async"
			draggable="false"
		/>
		<span class="wt">Net wt {weight}</span>
		<span class="light"></span>
	</div>
	<div class="face back" aria-hidden="true">
		<span class="frame"></span>
		<span class="brand">Kebena<br />Coffee</span>
		<span class="tag">From farm to cup</span>
		<svg class="art" viewBox="0 0 192 48" preserveAspectRatio="xMidYMax meet">
			<path
				d="M7 48V24a17 17 0 0 1 34 0v24M14 48V24a10 10 0 0 1 20 0v24M72 20a11 11 0 1 0 .1 0M50 48l15-15 11 10 9-8 11 13M120 45c-14-12-14-30 0-41 14 11 14 29 0 41ZM120 4v44M150 48V29h36v19M146 30l22-20 22 20"
			/>
		</svg>
		<span class="wt">Net wt {weight}</span>
	</div>
	<div class="side left" aria-hidden="true"></div>
	<div class="side right" aria-hidden="true"></div>
	<div class="seal" aria-hidden="true"></div>
</div>

<style>
	.pouch {
		--h: calc(var(--w) * 1.398);
		--d: calc(var(--w) * 0.3);
		/* the faces lean in to meet at the seal: atan(d / 2 / h) */
		--lean: 6.1deg;
		position: relative;
		width: var(--w);
		height: var(--h);
		margin-top: calc(var(--w) * 0.1);
		transform-style: preserve-3d;
		transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
	}
	.face {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: 0 0 calc(var(--w) * 0.03) calc(var(--w) * 0.03);
		transform-origin: 50% 100%;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.front {
		transform: translateZ(calc(var(--d) / 2)) rotateX(var(--lean));
		background: var(--cream);
	}
	.front img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		-webkit-user-drag: none;
		user-select: none;
	}
	.back {
		transform: rotateY(180deg) translateZ(calc(var(--d) / 2)) rotateX(var(--lean));
		display: grid;
		align-content: start;
		justify-items: center;
		gap: calc(var(--w) * 0.03);
		padding: calc(var(--w) * 0.2) calc(var(--w) * 0.1) 0;
		background: linear-gradient(100deg, #1c251e, #2a352c 45%, #1f2821);
		color: var(--on-bag);
		text-align: center;
	}
	.frame {
		position: absolute;
		inset: calc(var(--w) * 0.05);
		border: 1px solid var(--hair);
	}
	.brand {
		font-family: var(--font-display);
		font-size: calc(var(--w) * 0.15);
		font-weight: 800;
		line-height: 0.92;
		letter-spacing: -0.01em;
		text-transform: uppercase;
	}
	.tag {
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: calc(var(--w) * 0.052);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--gold);
	}
	.art {
		position: absolute;
		inset: auto calc(var(--w) * 0.1) calc(var(--w) * 0.2);
		height: calc(var(--w) * 0.2);
		fill: none;
		stroke: var(--gold);
		stroke-width: 0.8;
		opacity: 0.8;
	}
	/* the weight, printed along the foot of the bag on both faces */
	.wt {
		position: absolute;
		inset: auto 0 0;
		padding: calc(var(--w) * 0.028) 0 calc(var(--w) * 0.034);
		background: #1c251e;
		color: var(--cream);
		font-family: var(--font-display);
		font-stretch: 75%;
		font-size: calc(var(--w) * 0.05);
		font-weight: 600;
		letter-spacing: 0.14em;
		text-align: center;
		text-transform: uppercase;
	}
	/* the fall of light on a filled pouch: darker edges, a soft band where it bulges */
	.light {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				100deg,
				transparent calc(var(--shine, 34%) - 22%),
				rgb(255 255 255 / 0.22) var(--shine, 34%),
				transparent calc(var(--shine, 34%) + 22%)
			),
			linear-gradient(
				90deg,
				rgb(25 33 27 / 0.34),
				transparent 12%,
				transparent 86%,
				rgb(25 33 27 / 0.38)
			),
			linear-gradient(rgb(25 33 27 / 0.22), transparent 9%, transparent 90%, rgb(25 33 27 / 0.3));
		pointer-events: none;
	}
	/* the gussets: a wedge each side, widest at the foot */
	.side {
		position: absolute;
		top: 0;
		left: calc(50% - var(--d) / 2);
		width: var(--d);
		height: 100%;
		clip-path: polygon(50% 0, 100% 100%, 0 100%);
		background: linear-gradient(90deg, #161d18, #2b362d 50%, #161d18);
	}
	.side.left {
		transform: rotateY(-90deg) translateZ(calc(var(--w) / 2 - 0.5px));
	}
	.side.right {
		transform: rotateY(90deg) translateZ(calc(var(--w) / 2 - 0.5px));
	}
	/* the crimped seal the two faces meet in */
	.seal {
		position: absolute;
		inset: calc(var(--w) * -0.095) 0 auto;
		height: calc(var(--w) * 0.1);
		border-radius: calc(var(--w) * 0.012) calc(var(--w) * 0.012) 0 0;
		background:
			linear-gradient(rgb(255 255 255 / 0.12), transparent 40%, rgb(0 0 0 / 0.3)),
			repeating-linear-gradient(
				90deg,
				#2f3b31 0 calc(var(--w) * 0.012),
				#1f2821 calc(var(--w) * 0.012) calc(var(--w) * 0.024)
			);
	}
</style>
