<!-- The band between halls. Experiment: quarter-arc rings (bookofshapes.com) in place of the
     woven tibeb stitch. The art is a mask, so its colour follows the theme. -->
<div class="tibeb" aria-hidden="true"></div>

<style>
	.tibeb {
		position: relative;
		height: 104px;
		background: var(--paper-tint);
	}
	.tibeb::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--accent-ink);
		opacity: 0.55;
		/* ten tiles across the file, so one tile is exactly the band's height */
		-webkit-mask: url('/art/truchet.svg') 0 0 / 1040px auto repeat-x;
		mask: url('/art/truchet.svg') 0 0 / 1040px auto repeat-x;
	}
	@media (max-width: 600px) {
		.tibeb {
			height: 64px;
		}
		.tibeb::before {
			-webkit-mask-size: 640px auto;
			mask-size: 640px auto;
		}
	}
</style>
