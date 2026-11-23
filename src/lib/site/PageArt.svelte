<!--
	The moving pattern art behind the shop, visit and form pages: Hall 04's dotted streams
	(`kb-art--dots-side`) pouring down the left edge, the truchet ring weave turning slowly in the
	far corner, and a warm glow drifting across the top. The art is a mask in the theme's ink, like
	the museum's `.kb-art`. CSS only, transform-only animation, still under reduced motion.
-->
<div class="page-art" aria-hidden="true">
	<div class="glow"></div>
	<div class="streams"><div class="dots"></div></div>
	<div class="rings"><div class="weave"></div></div>
</div>

<style>
	.page-art {
		/* one flow-dots tile (502.15 × 637.96): the streams move down exactly one tile per loop */
		--tile-w: 560px;
		--tile-h: calc(var(--tile-w) * 637.96 / 502.15);
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
	}

	.glow {
		position: absolute;
		top: -24vmax;
		right: -12vmax;
		width: 64vmax;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--gold) 26%, transparent),
			transparent 66%
		);
		animation: drift 46s ease-in-out infinite alternate;
	}

	.streams {
		position: absolute;
		inset: 0;
		opacity: 0.42;
		mask: linear-gradient(to right, #000, transparent min(44vw, 640px));
	}
	.dots {
		position: absolute;
		inset: calc(var(--tile-h) * -1) 0 0;
		background: var(--accent-ink);
		mask: url('/art/flow-dots.svg') 0 0 / var(--tile-w) auto repeat;
		animation: pour 56s linear infinite;
	}

	.rings {
		position: absolute;
		inset: 0;
		opacity: 0.2;
		mask: radial-gradient(820px 600px at 100% 100%, #000 8%, transparent 100%);
	}
	.weave {
		position: absolute;
		right: -900px;
		bottom: -900px;
		width: 1800px;
		height: 1800px;
		background: var(--accent-ink);
		mask: url('/art/truchet.svg') center / 100% 100% no-repeat;
		animation: turn 240s linear infinite;
	}

	@keyframes pour {
		to {
			transform: translateY(var(--tile-h));
		}
	}
	@keyframes turn {
		to {
			transform: rotate(1turn);
		}
	}
	@keyframes drift {
		50% {
			transform: translate(-18vw, 10vh) scale(1.12);
		}
		to {
			transform: translate(-36vw, 4vh) scale(0.94);
		}
	}

	@media (max-width: 700px) {
		.page-art {
			--tile-w: 380px;
		}
		.streams {
			mask: linear-gradient(to right, #000, transparent 72%);
			opacity: 0.3;
		}
		.rings {
			mask: radial-gradient(420px 320px at 100% 100%, #000 10%, transparent 100%);
		}
		.weave {
			right: -560px;
			bottom: -560px;
			width: 1120px;
			height: 1120px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.glow,
		.dots,
		.weave {
			animation: none;
		}
	}
</style>
