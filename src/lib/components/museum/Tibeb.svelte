<!-- The tibeb band: the woven border of a shemma, used as a divider between halls.
     One 224 × 104 stitch tile from the Figma "Diamond chain", repeated across the page. -->
<div class="tibeb" aria-hidden="true"></div>

<style>
	.tibeb {
		height: 104px;
		background: #edf3ee url('/museum/tibeb.svg') 0 0 / auto 104px repeat-x;
	}
	:global([data-theme='dark']) .tibeb {
		background-color: var(--color-forest-900);
		background-image: url('/museum/tibeb-dark.svg');
	}
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .tibeb {
			background-color: var(--color-forest-900);
			background-image: url('/museum/tibeb-dark.svg');
		}
	}
	@media (max-width: 600px) {
		.tibeb {
			height: 64px;
			background-size: auto 64px;
		}
	}
</style>
